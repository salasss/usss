//! Firebase Cloud Messaging HTTP v1 client, authenticated as a service account.
//!
//! The service account signs a short JWT (RS256) that Google's token endpoint
//! exchanges for an OAuth2 access token; that token is cached until shortly
//! before it expires. Neither the private key nor the tokens are ever logged.

use std::{
    fmt,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use anyhow::Context;
use base64::{Engine, engine::general_purpose::STANDARD};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::payload::{Notification, fcm_message};

/// Production FCM API.
pub const DEFAULT_API_URL: &str = "https://fcm.googleapis.com";
const DEFAULT_TOKEN_URI: &str = "https://oauth2.googleapis.com/token";
const SCOPE: &str = "https://www.googleapis.com/auth/firebase.messaging";
const GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:jwt-bearer";
/// Lifetime of the signed assertion: the longest Google accepts.
const ASSERTION_TTL_SECS: u64 = 3600;
/// An access token is replaced this long before it expires.
const RENEW_BEFORE: Duration = Duration::from_secs(60);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// Pause before the single retry of a send that FCM could not take.
const RETRY_DELAY: Duration = Duration::from_secs(1);

/// Key of a Firebase service account, as downloaded from the Firebase console
/// (*Project settings → Service accounts → Generate new private key*).
#[derive(Clone, Deserialize)]
pub struct ServiceAccount {
    pub project_id: String,
    pub client_email: String,
    private_key: String,
    #[serde(default)]
    private_key_id: Option<String>,
    /// OAuth2 token endpoint, also the audience of the signed assertion.
    #[serde(default = "default_token_uri")]
    pub token_uri: String,
}

fn default_token_uri() -> String {
    DEFAULT_TOKEN_URI.to_owned()
}

impl ServiceAccount {
    /// Reads the JSON key, given as is or encoded in base64.
    pub fn parse(raw: &str) -> anyhow::Result<Self> {
        let raw = raw.trim();
        let json = if raw.starts_with('{') {
            raw.to_owned()
        } else {
            let compact: String = raw.split_whitespace().collect();
            let bytes = STANDARD
                .decode(compact)
                .context("the value is neither JSON nor base64")?;
            String::from_utf8(bytes).context("the base64 value does not decode to text")?
        };

        let account: Self =
            serde_json::from_str(&json).context("the JSON is not a service account key")?;
        for (field, value) in [
            ("project_id", &account.project_id),
            ("client_email", &account.client_email),
            ("private_key", &account.private_key),
            ("token_uri", &account.token_uri),
        ] {
            if value.trim().is_empty() {
                anyhow::bail!("the service account key has an empty `{field}`");
            }
        }
        Ok(account)
    }
}

impl fmt::Debug for ServiceAccount {
    // The private key stays out of logs and panic messages.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ServiceAccount")
            .field("project_id", &self.project_id)
            .field("client_email", &self.client_email)
            .field("token_uri", &self.token_uri)
            .finish_non_exhaustive()
    }
}

/// Why a notification was not delivered.
#[derive(Debug, thiserror::Error)]
pub enum SendError {
    /// The phone uninstalled the app, or the token was never valid: forget it.
    #[error("the push token is no longer valid")]
    InvalidToken,
    #[error("FCM refused the access token")]
    Unauthorized,
    #[error("no access token: {0}")]
    Auth(String),
    #[error("FCM is unavailable: {0}")]
    Unavailable(String),
    #[error("FCM rejected the message: {0}")]
    Rejected(String),
}

/// Claims of the assertion exchanged for an access token.
#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Claims {
    pub iss: String,
    pub scope: String,
    pub aud: String,
    pub iat: u64,
    pub exp: u64,
}

struct AccessToken {
    value: String,
    renew_at: Instant,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default = "default_lifetime")]
    expires_in: u64,
}

fn default_lifetime() -> u64 {
    ASSERTION_TTL_SECS
}

/// Sends notifications through FCM on behalf of one Firebase project.
pub struct Fcm {
    account: ServiceAccount,
    key: EncodingKey,
    send_url: String,
    http: reqwest::Client,
    access: Mutex<Option<AccessToken>>,
}

impl Fcm {
    /// `api_url` is [`DEFAULT_API_URL`] except in tests.
    pub fn new(account: ServiceAccount, api_url: &str) -> anyhow::Result<Self> {
        let key = EncodingKey::from_rsa_pem(account.private_key.as_bytes())
            .context("the private key is not an RSA key in PEM format")?;
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()?;
        let send_url = format!(
            "{}/v1/projects/{}/messages:send",
            api_url.trim_end_matches('/'),
            account.project_id
        );

        let fcm = Self {
            account,
            key,
            send_url,
            http,
            access: Mutex::new(None),
        };
        // Sign once now: a broken key fails at startup, not at the first message.
        fcm.assertion(unix_now())
            .context("the private key cannot sign")?;
        Ok(fcm)
    }

    pub fn project_id(&self) -> &str {
        &self.account.project_id
    }

    /// Sends `notification` to the phone behind `token`. Retries once when
    /// the access token was refused or FCM was briefly unavailable.
    pub async fn send(
        &self,
        token: &str,
        notification: &Notification,
        couple: Uuid,
    ) -> Result<(), SendError> {
        let body = fcm_message(token, notification, couple);
        match self.try_send(&body).await {
            Err(SendError::Unauthorized) => {
                // Revoked or expired early: get a new one.
                *self.access.lock().await = None;
                self.try_send(&body).await
            }
            Err(SendError::Unavailable(_)) => {
                tokio::time::sleep(RETRY_DELAY).await;
                self.try_send(&body).await
            }
            result => result,
        }
    }

    async fn try_send(&self, body: &Value) -> Result<(), SendError> {
        let access = self.access_token().await?;
        let response = self
            .http
            .post(&self.send_url)
            .bearer_auth(access)
            .json(body)
            .send()
            .await
            .map_err(|err| SendError::Unavailable(err.to_string()))?;

        let status = response.status();
        if status.is_success() {
            return Ok(());
        }
        let text = response.text().await.unwrap_or_default();
        Err(classify(status, &text))
    }

    /// The cached access token, or a new one when it is about to expire.
    async fn access_token(&self) -> Result<String, SendError> {
        let mut cached = self.access.lock().await;
        if let Some(token) = cached.as_ref()
            && Instant::now() < token.renew_at
        {
            return Ok(token.value.clone());
        }

        let fresh = self.fetch_access_token().await?;
        let value = fresh.value.clone();
        *cached = Some(fresh);
        Ok(value)
    }

    async fn fetch_access_token(&self) -> Result<AccessToken, SendError> {
        let assertion = self
            .assertion(unix_now())
            .map_err(|err| SendError::Auth(format!("cannot sign the assertion: {err}")))?;
        let response = self
            .http
            .post(&self.account.token_uri)
            .form(&[
                ("grant_type", GRANT_TYPE),
                ("assertion", assertion.as_str()),
            ])
            .send()
            .await
            .map_err(|err| SendError::Auth(err.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            // OAuth errors (`invalid_grant`...) carry no secret.
            let text = response.text().await.unwrap_or_default();
            return Err(SendError::Auth(format!(
                "token endpoint answered {status}: {}",
                excerpt(&text)
            )));
        }
        let token: TokenResponse = response
            .json()
            .await
            .map_err(|err| SendError::Auth(format!("unexpected token response: {err}")))?;

        let lifetime = Duration::from_secs(token.expires_in);
        Ok(AccessToken {
            value: token.access_token,
            renew_at: Instant::now() + lifetime.saturating_sub(RENEW_BEFORE),
        })
    }

    /// The signed JWT that proves who we are to the token endpoint.
    pub(crate) fn assertion(&self, now: u64) -> jsonwebtoken::errors::Result<String> {
        let mut header = Header::new(Algorithm::RS256);
        header.kid = self.account.private_key_id.clone();
        let claims = Claims {
            iss: self.account.client_email.clone(),
            scope: SCOPE.to_owned(),
            aud: self.account.token_uri.clone(),
            iat: now,
            exp: now + ASSERTION_TTL_SECS,
        };
        encode(&header, &claims, &self.key)
    }
}

/// Maps an FCM error response to what the caller should do about it.
fn classify(status: StatusCode, body: &str) -> SendError {
    let json: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    let error = &json["error"];
    let message = error["message"].as_str().unwrap_or_default();
    let details = error["details"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let has_code = |code: &str| details.iter().any(|detail| detail["errorCode"] == code);
    let token_field = details.iter().any(|detail| {
        detail["fieldViolations"]
            .as_array()
            .is_some_and(|violations| violations.iter().any(|v| v["field"] == "message.token"))
    });

    // UNREGISTERED (404): the app was uninstalled or the token expired.
    // SENDER_ID_MISMATCH: the token belongs to another Firebase project.
    // INVALID_ARGUMENT about the token: it was never a valid one.
    let invalid_token = status == StatusCode::NOT_FOUND
        || has_code("UNREGISTERED")
        || has_code("SENDER_ID_MISMATCH")
        || (status == StatusCode::BAD_REQUEST
            && (token_field || message.to_ascii_lowercase().contains("registration token")));
    if invalid_token {
        return SendError::InvalidToken;
    }

    let reason = format!("{status}: {}", excerpt(message));
    match status {
        StatusCode::UNAUTHORIZED => SendError::Unauthorized,
        StatusCode::TOO_MANY_REQUESTS => SendError::Unavailable(reason),
        status if status.is_server_error() => SendError::Unavailable(reason),
        _ => SendError::Rejected(reason),
    }
}

fn excerpt(text: &str) -> String {
    text.chars().take(200).collect()
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

#[cfg(test)]
pub(crate) mod tests {
    use std::sync::LazyLock;

    use jsonwebtoken::{DecodingKey, Validation, decode, decode_header};
    use rsa::{
        RsaPrivateKey,
        pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding},
    };
    use serde_json::json;

    use super::*;

    /// A throwaway RSA key pair (PKCS#8, like Google's), generated once.
    pub(crate) static TEST_KEY: LazyLock<(String, String)> = LazyLock::new(|| {
        let key = RsaPrivateKey::new(&mut rand_core::OsRng, 2048).expect("RSA key");
        let private = key.to_pkcs8_pem(LineEnding::LF).expect("private PEM");
        let public = key
            .to_public_key()
            .to_public_key_pem(LineEnding::LF)
            .expect("public PEM");
        (private.to_string(), public)
    });

    fn account_json() -> Value {
        json!({
            "type": "service_account",
            "project_id": "usss-test",
            "private_key_id": "key-1",
            "private_key": TEST_KEY.0,
            "client_email": "push@usss-test.iam.gserviceaccount.com",
            "token_uri": "https://oauth2.example.com/token",
        })
    }

    #[test]
    fn service_account_is_read_as_json_or_base64() {
        let json = account_json().to_string();
        let account = ServiceAccount::parse(&json).expect("raw JSON");
        assert_eq!(account.project_id, "usss-test");
        assert_eq!(account.token_uri, "https://oauth2.example.com/token");

        let encoded = STANDARD.encode(&json);
        let from_base64 = ServiceAccount::parse(&format!(" {encoded}\n")).expect("base64");
        assert_eq!(from_base64.client_email, account.client_email);

        let mut without_uri = account_json();
        without_uri.as_object_mut().unwrap().remove("token_uri");
        let account = ServiceAccount::parse(&without_uri.to_string()).unwrap();
        assert_eq!(account.token_uri, DEFAULT_TOKEN_URI);
    }

    #[test]
    fn broken_service_accounts_are_refused() {
        assert!(ServiceAccount::parse("not a key").is_err());
        assert!(ServiceAccount::parse(r#"{"project_id": "usss-test"}"#).is_err());

        let mut empty = account_json();
        empty["client_email"] = json!("");
        assert!(ServiceAccount::parse(&empty.to_string()).is_err());

        let mut not_rsa = account_json();
        not_rsa["private_key"] =
            json!("-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n");
        let account = ServiceAccount::parse(&not_rsa.to_string()).unwrap();
        assert!(Fcm::new(account, DEFAULT_API_URL).is_err());
    }

    #[test]
    fn the_private_key_never_shows_in_debug_output() {
        let account = ServiceAccount::parse(&account_json().to_string()).unwrap();
        let printed = format!("{account:?}");
        assert!(printed.contains("usss-test"));
        assert!(!printed.contains("PRIVATE KEY"));
    }

    #[test]
    fn assertion_follows_the_service_account_flow() {
        let account = ServiceAccount::parse(&account_json().to_string()).unwrap();
        let fcm = Fcm::new(account, "http://127.0.0.1:1/").unwrap();
        assert_eq!(
            fcm.send_url,
            "http://127.0.0.1:1/v1/projects/usss-test/messages:send"
        );

        let now = unix_now();
        let jwt = fcm.assertion(now).unwrap();
        let header = decode_header(&jwt).unwrap();
        assert_eq!(header.alg, Algorithm::RS256);
        assert_eq!(header.kid.as_deref(), Some("key-1"));

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&["https://oauth2.example.com/token"]);
        validation.set_issuer(&["push@usss-test.iam.gserviceaccount.com"]);
        let key = DecodingKey::from_rsa_pem(TEST_KEY.1.as_bytes()).unwrap();
        let claims = decode::<Claims>(&jwt, &key, &validation).unwrap().claims;
        assert_eq!(
            claims,
            Claims {
                iss: "push@usss-test.iam.gserviceaccount.com".into(),
                scope: "https://www.googleapis.com/auth/firebase.messaging".into(),
                aud: "https://oauth2.example.com/token".into(),
                iat: now,
                exp: now + 3600,
            }
        );
    }

    fn fcm_error(status: u16, code: &str, message: &str) -> (StatusCode, String) {
        let body = json!({
            "error": {
                "code": status,
                "message": message,
                "status": "ERROR",
                "details": [{
                    "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                    "errorCode": code,
                }],
            }
        });
        (StatusCode::from_u16(status).unwrap(), body.to_string())
    }

    #[test]
    fn dead_tokens_are_recognized() {
        for (status, body) in [
            fcm_error(404, "UNREGISTERED", "Requested entity was not found."),
            fcm_error(403, "SENDER_ID_MISMATCH", "SenderId mismatch"),
            fcm_error(
                400,
                "INVALID_ARGUMENT",
                "The registration token is not a valid FCM registration token",
            ),
        ] {
            assert!(
                matches!(classify(status, &body), SendError::InvalidToken),
                "{body}"
            );
        }

        let token_violation = json!({
            "error": {
                "code": 400,
                "message": "Invalid value",
                "details": [{
                    "@type": "type.googleapis.com/google.rpc.BadRequest",
                    "fieldViolations": [{ "field": "message.token" }],
                }],
            }
        });
        assert!(matches!(
            classify(StatusCode::BAD_REQUEST, &token_violation.to_string()),
            SendError::InvalidToken
        ));
    }

    #[test]
    fn other_failures_keep_the_token() {
        let (status, body) = fcm_error(
            400,
            "INVALID_ARGUMENT",
            "Invalid value at 'message.android.priority'",
        );
        assert!(matches!(classify(status, &body), SendError::Rejected(_)));

        let (status, body) = fcm_error(503, "UNAVAILABLE", "try again");
        assert!(matches!(classify(status, &body), SendError::Unavailable(_)));
        let (status, body) = fcm_error(429, "QUOTA_EXCEEDED", "slow down");
        assert!(matches!(classify(status, &body), SendError::Unavailable(_)));
        let (status, body) = fcm_error(401, "THIRD_PARTY_AUTH_ERROR", "bad token");
        assert!(matches!(classify(status, &body), SendError::Unauthorized));
        assert!(matches!(
            classify(StatusCode::BAD_GATEWAY, "<html>proxy</html>"),
            SendError::Unavailable(_)
        ));
    }
}
