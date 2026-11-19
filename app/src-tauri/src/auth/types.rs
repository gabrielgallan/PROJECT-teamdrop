use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize)]
pub struct AuthError {
    pub code: &'static str,
    pub message: &'static str,
}
impl AuthError {
    pub const fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
    pub fn store() -> Self {
        Self::new(
            "CREDENTIAL_STORE_ERROR",
            "Não foi possível acessar o cofre do Windows. Tente novamente.",
        )
    }
    pub fn invalid_refresh() -> Self {
        Self::new(
            "INVALID_REFRESH_TOKEN",
            "Sua sessão expirou. Entre novamente.",
        )
    }
    pub fn cancelled() -> Self {
        Self::new("LOGIN_CANCELLED", "Login cancelado.")
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct Session {
    pub user: User,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredCredential {
    pub refresh_token: String,
    pub refresh_expires_at: String,
    #[serde(default)]
    pub uncertain: bool,
}
impl StoredCredential {
    pub fn expired(&self) -> Result<bool, AuthError> {
        let date = chrono::DateTime::parse_from_rfc3339(&self.refresh_expires_at)
            .map_err(|_| AuthError::store())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        Ok(date.timestamp() <= now)
    }
}

// Backend credentials are deserializable but intentionally cannot be serialized to IPC.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_expires_at: String,
}
#[derive(Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum ExchangeResponse {
    Pending,
    Complete {
        #[serde(flatten)]
        tokens: TokenPair,
        user: User,
    },
}
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum LoginResult {
    Pending,
    Complete { session: Session },
}
