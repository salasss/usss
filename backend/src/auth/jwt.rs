use std::{
    collections::HashMap,
    time::{Duration, Instant},
};

use jsonwebtoken::{
    Algorithm, DecodingKey, Validation, decode, decode_header,
    jwk::{AlgorithmParameters, EllipticCurve, Jwk, JwkSet, KeyAlgorithm},
};
use serde::Deserialize;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::AuthUser;

/// Audience Supabase Auth puts in the access tokens of signed-in users.
const AUDIENCE: &str = "authenticated";
/// Unknown `kid`: refetch the key set at most this often.
const REFRESH_COOLDOWN: Duration = Duration::from_secs(30);
/// Known keys are refreshed after this age, to follow key rotations.
const MAX_KEYS_AGE: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, thiserror::Error)]
pub enum VerifyError {
    #[error("malformed token: {0}")]
    Malformed(jsonwebtoken::errors::Error),
    #[error("algorithm {0:?} is not accepted")]
    UnsupportedAlgorithm(Algorithm),
    #[error("no signing key matches the token")]
    UnknownKey,
    #[error("signing keys unavailable: {0}")]
    KeysUnavailable(String),
    #[error("invalid token: {0}")]
    Invalid(jsonwebtoken::errors::Error),
    #[error("token does not belong to a signed-in user")]
    NotAuthenticated,
    #[error("token subject is not a user id")]
    BadSubject,
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    email: Option<String>,
}

/// Verifies Supabase Auth access tokens.
///
/// Supports the legacy shared secret (HS256) and the asymmetric signing keys
/// (ES256 / RS256 / EdDSA) published by the project's JWKS endpoint.
pub struct JwtVerifier {
    secret: Option<DecodingKey>,
    jwks: Option<Jwks>,
    issuer: Option<String>,
}

impl JwtVerifier {
    /// `supabase_url` enables JWKS keys and the issuer check, `jwt_secret` the
    /// legacy HS256 secret. At least one of them is required.
    pub fn new(supabase_url: Option<&str>, jwt_secret: Option<&str>) -> anyhow::Result<Self> {
        if supabase_url.is_none() && jwt_secret.is_none() {
            anyhow::bail!("set SUPABASE_URL and/or SUPABASE_JWT_SECRET to verify access tokens");
        }

        let base = supabase_url.map(|url| url.trim_end_matches('/').to_owned());
        let jwks = match &base {
            Some(base) => Some(Jwks::new(format!("{base}/auth/v1/.well-known/jwks.json"))?),
            None => None,
        };

        Ok(Self {
            secret: jwt_secret.map(|secret| DecodingKey::from_secret(secret.as_bytes())),
            jwks,
            issuer: base.map(|base| format!("{base}/auth/v1")),
        })
    }

    pub async fn verify(&self, token: &str) -> Result<AuthUser, VerifyError> {
        let header = decode_header(token).map_err(VerifyError::Malformed)?;

        let (key, algorithm) = match header.alg {
            Algorithm::HS256 | Algorithm::HS384 | Algorithm::HS512 => {
                let secret = self
                    .secret
                    .as_ref()
                    .ok_or(VerifyError::UnsupportedAlgorithm(header.alg))?;
                (secret.clone(), header.alg)
            }
            alg => {
                let jwks = self
                    .jwks
                    .as_ref()
                    .ok_or(VerifyError::UnsupportedAlgorithm(alg))?;
                let kid = header.kid.as_deref().ok_or(VerifyError::UnknownKey)?;
                let (key, key_alg) = jwks.key(kid).await?;
                // The key decides the algorithm, never the token (algorithm confusion).
                if key_alg != alg {
                    return Err(VerifyError::UnsupportedAlgorithm(alg));
                }
                (key, key_alg)
            }
        };

        let mut validation = Validation::new(algorithm);
        validation.set_audience(&[AUDIENCE]);
        validation.set_required_spec_claims(&["exp", "sub", "aud"]);
        validation.leeway = 30;
        if let Some(issuer) = &self.issuer {
            validation.set_issuer(&[issuer]);
        }

        let claims = decode::<Claims>(token, &key, &validation)
            .map_err(VerifyError::Invalid)?
            .claims;

        if claims.role.as_deref() != Some(AUDIENCE) {
            return Err(VerifyError::NotAuthenticated);
        }
        let id = Uuid::parse_str(&claims.sub).map_err(|_| VerifyError::BadSubject)?;

        Ok(AuthUser {
            id,
            email: claims.email.filter(|email| !email.is_empty()),
        })
    }
}

/// Signing keys fetched from the Supabase JWKS endpoint, cached by `kid`.
struct Jwks {
    url: String,
    client: reqwest::Client,
    cache: RwLock<KeyCache>,
}

#[derive(Default)]
struct KeyCache {
    keys: HashMap<String, (DecodingKey, Algorithm)>,
    fetched_at: Option<Instant>,
}

impl KeyCache {
    fn is_fresh(&self) -> bool {
        self.fetched_at
            .is_some_and(|at| at.elapsed() < MAX_KEYS_AGE)
    }

    fn in_cooldown(&self) -> bool {
        self.fetched_at
            .is_some_and(|at| at.elapsed() < REFRESH_COOLDOWN)
    }
}

impl Jwks {
    fn new(url: String) -> anyhow::Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()?;
        Ok(Self {
            url,
            client,
            cache: RwLock::new(KeyCache::default()),
        })
    }

    async fn key(&self, kid: &str) -> Result<(DecodingKey, Algorithm), VerifyError> {
        {
            let cache = self.cache.read().await;
            if cache.is_fresh()
                && let Some(found) = cache.keys.get(kid)
            {
                return Ok(found.clone());
            }
        }

        let mut cache = self.cache.write().await;
        // Another request may have refreshed the keys while we waited.
        if let Some(found) = cache.keys.get(kid)
            && cache.is_fresh()
        {
            return Ok(found.clone());
        }
        if !cache.in_cooldown() {
            cache.keys = self.fetch().await?;
            cache.fetched_at = Some(Instant::now());
        }
        cache.keys.get(kid).cloned().ok_or(VerifyError::UnknownKey)
    }

    async fn fetch(&self) -> Result<HashMap<String, (DecodingKey, Algorithm)>, VerifyError> {
        let unavailable = |err: reqwest::Error| VerifyError::KeysUnavailable(err.to_string());
        let set: JwkSet = self
            .client
            .get(&self.url)
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(unavailable)?
            .json()
            .await
            .map_err(unavailable)?;

        let keys = set
            .keys
            .iter()
            .filter_map(|jwk| {
                let kid = jwk.common.key_id.clone()?;
                let algorithm = jwk_algorithm(jwk)?;
                let key = DecodingKey::from_jwk(jwk).ok()?;
                Some((kid, (key, algorithm)))
            })
            .collect::<HashMap<_, _>>();

        tracing::info!(count = keys.len(), "fetched Supabase signing keys");
        Ok(keys)
    }
}

/// Algorithm declared by a JWK, or inferred from its key type.
fn jwk_algorithm(jwk: &Jwk) -> Option<Algorithm> {
    if let Some(declared) = jwk.common.key_algorithm {
        return match declared {
            KeyAlgorithm::ES256 => Some(Algorithm::ES256),
            KeyAlgorithm::ES384 => Some(Algorithm::ES384),
            KeyAlgorithm::RS256 => Some(Algorithm::RS256),
            KeyAlgorithm::RS384 => Some(Algorithm::RS384),
            KeyAlgorithm::RS512 => Some(Algorithm::RS512),
            KeyAlgorithm::PS256 => Some(Algorithm::PS256),
            KeyAlgorithm::PS384 => Some(Algorithm::PS384),
            KeyAlgorithm::PS512 => Some(Algorithm::PS512),
            KeyAlgorithm::EdDSA => Some(Algorithm::EdDSA),
            _ => None,
        };
    }

    match &jwk.algorithm {
        AlgorithmParameters::EllipticCurve(params) => match params.curve {
            EllipticCurve::P256 => Some(Algorithm::ES256),
            EllipticCurve::P384 => Some(Algorithm::ES384),
            _ => None,
        },
        AlgorithmParameters::RSA(_) => Some(Algorithm::RS256),
        AlgorithmParameters::OctetKeyPair(_) => Some(Algorithm::EdDSA),
        _ => None,
    }
}
