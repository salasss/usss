mod common;

use axum::{
    Json, Router,
    body::Body,
    http::{Request, StatusCode, header},
    routing::get,
};
use common::{TEST_SECRET, bearer, json_body, send, sign_hs256, test_app, user_claims};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use p256::pkcs8::{EncodePrivateKey, LineEnding};
use serde_json::{Value, json};
use usss_backend::{AppState, config::Config, router};

const LEA: &str = "11111111-1111-4111-8111-111111111111";

fn me_request(authorization: Option<String>) -> Request<Body> {
    let mut builder = Request::get("/me");
    if let Some(value) = authorization {
        builder = builder.header(header::AUTHORIZATION, value);
    }
    builder.body(Body::empty()).unwrap()
}

#[tokio::test]
async fn valid_token_reaches_protected_route() {
    let token = sign_hs256(&user_claims(LEA), TEST_SECRET);
    let response = send(test_app(), me_request(Some(bearer(&token)))).await;

    assert_eq!(response.status(), StatusCode::OK);
    let body = json_body(response).await;
    assert_eq!(body["id"], LEA);
    assert_eq!(body["email"], "lea@example.com");
}

#[tokio::test]
async fn missing_token_is_rejected() {
    let response = send(test_app(), me_request(None)).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(response.headers()[header::WWW_AUTHENTICATE], "Bearer");
    assert_eq!(json_body(response).await["error"], "unauthorized");
}

#[tokio::test]
async fn garbage_token_is_rejected() {
    let response = send(test_app(), me_request(Some(bearer("not-a-jwt")))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn expired_token_is_rejected() {
    let mut claims = user_claims(LEA);
    claims["exp"] = json!(common::now() - 3600);
    let token = sign_hs256(&claims, TEST_SECRET);

    let response = send(test_app(), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn token_signed_with_another_secret_is_rejected() {
    let token = sign_hs256(
        &user_claims(LEA),
        "another-secret-of-another-project-123456",
    );
    let response = send(test_app(), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn wrong_audience_is_rejected() {
    let mut claims = user_claims(LEA);
    claims["aud"] = json!("someone-else");
    let token = sign_hs256(&claims, TEST_SECRET);

    let response = send(test_app(), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn anon_key_is_not_a_user() {
    // The public anon key is a valid JWT of the project, but not a signed-in user.
    let mut claims = user_claims(LEA);
    claims["role"] = json!("anon");
    let token = sign_hs256(&claims, TEST_SECRET);

    let response = send(test_app(), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn subject_must_be_a_user_id() {
    let token = sign_hs256(&user_claims("service"), TEST_SECRET);
    let response = send(test_app(), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// --------------------------------------------------------------------- JWKS --

/// A Supabase-like project publishing one ES256 signing key.
struct FakeProject {
    url: String,
    signing_key: EncodingKey,
}

async fn fake_project() -> FakeProject {
    let secret = p256::SecretKey::random(&mut rand_core::OsRng);
    let pem = secret.to_pkcs8_pem(LineEnding::LF).expect("pem");
    let mut jwk: Value = serde_json::from_str(&secret.public_key().to_jwk_string()).unwrap();
    jwk["kid"] = json!("test-key");
    jwk["alg"] = json!("ES256");
    jwk["use"] = json!("sig");

    let jwks = json!({ "keys": [jwk] });
    let app = Router::new().route(
        "/auth/v1/.well-known/jwks.json",
        get(move || {
            let jwks = jwks.clone();
            async move { Json(jwks) }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

    FakeProject {
        url,
        signing_key: EncodingKey::from_ec_pem(pem.as_bytes()).expect("signing key"),
    }
}

fn jwks_app(project: &FakeProject) -> Router {
    let config = Config {
        addr: "127.0.0.1:0".parse().unwrap(),
        supabase_url: Some(project.url.clone()),
        supabase_jwt_secret: None,
    };
    router(AppState::new(config).unwrap())
}

fn sign_es256(project: &FakeProject, kid: &str, claims: &Value) -> String {
    let mut header = Header::new(Algorithm::ES256);
    header.kid = Some(kid.to_owned());
    encode(&header, claims, &project.signing_key).expect("sign")
}

fn project_claims(project: &FakeProject) -> Value {
    let mut claims = user_claims(LEA);
    claims["iss"] = json!(format!("{}/auth/v1", project.url));
    claims
}

#[tokio::test]
async fn asymmetric_token_is_verified_with_the_project_keys() {
    let project = fake_project().await;
    let token = sign_es256(&project, "test-key", &project_claims(&project));

    let response = send(jwks_app(&project), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await["id"], LEA);
}

#[tokio::test]
async fn asymmetric_token_from_another_issuer_is_rejected() {
    let project = fake_project().await;
    let mut claims = project_claims(&project);
    claims["iss"] = json!("https://evil.example.com/auth/v1");
    let token = sign_es256(&project, "test-key", &claims);

    let response = send(jwks_app(&project), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn unknown_key_id_is_rejected() {
    let project = fake_project().await;
    let token = sign_es256(&project, "rotated-away", &project_claims(&project));

    let response = send(jwks_app(&project), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn shared_secret_tokens_are_refused_when_only_keys_are_configured() {
    let project = fake_project().await;
    let token = sign_hs256(&project_claims(&project), TEST_SECRET);

    let response = send(jwks_app(&project), me_request(Some(bearer(&token)))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[test]
fn configuration_requires_a_way_to_verify_tokens() {
    let config = Config {
        addr: "127.0.0.1:0".parse().unwrap(),
        supabase_url: None,
        supabase_jwt_secret: None,
    };
    assert!(AppState::new(config).is_err());
}
