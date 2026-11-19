use super::types::{AuthError, ExchangeResponse, TokenPair, User};
use reqwest::{Client, Response, Url};
use serde::de::DeserializeOwned;
use serde_json::json;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct AuthClient {
    pub base_url: String,
    http: Client,
}

impl AuthClient {
    pub fn new(base_url: &str) -> Result<Self, AuthError> {
        let mut url = Url::parse(base_url).map_err(|_| Self::invalid_url())?;
        let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
        if !(url.scheme() == "https" || cfg!(debug_assertions) && url.scheme() == "http" && local)
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.path() != "/"
        {
            return Err(Self::invalid_url());
        }
        url.set_path("");
        let base_url = url.as_str().trim_end_matches('/').to_string();
        let http = Client::builder()
            .timeout(Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| Self::invalid_url())?;
        Ok(Self { base_url, http })
    }

    fn invalid_url() -> AuthError {
        AuthError::new(
            "INVALID_API_URL",
            "Configure uma URL HTTPS da API. HTTP local é permitido somente em desenvolvimento.",
        )
    }

    fn transport(error: reqwest::Error, rotating: bool) -> AuthError {
        if rotating && !error.is_connect() {
            AuthError::new(
                "REFRESH_UNCERTAIN",
                "A resposta da renovação foi perdida. Entre novamente para recuperar a sessão.",
            )
        } else {
            AuthError::new(
                "NETWORK_ERROR",
                "Não foi possível conectar à API. Verifique sua conexão e tente novamente.",
            )
        }
    }

    async fn checked(response: Response) -> Result<Response, AuthError> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }
        // Never expose a backend body, URL or transport error containing credentials.
        let body: serde_json::Value = response.json().await.unwrap_or_default();
        if status.as_u16() == 401 {
            return Err(match body.get("code").and_then(|code| code.as_str()) {
                Some("INVALID_REFRESH_TOKEN") => AuthError::invalid_refresh(),
                _ => AuthError::new(
                    "UNAUTHORIZED",
                    "Não foi possível autenticar. Entre novamente.",
                ),
            });
        }
        Err(AuthError::new(
            "API_ERROR",
            "A API não conseguiu concluir a solicitação. Tente novamente.",
        ))
    }

    async fn decode<T: DeserializeOwned>(response: Response) -> Result<T, AuthError> {
        Self::checked(response).await?.json().await.map_err(|_| {
            AuthError::new("INVALID_RESPONSE", "A API retornou uma resposta inválida.")
        })
    }

    pub async fn exchange(
        &self,
        ticket: &str,
        verifier: &str,
    ) -> Result<(ExchangeResponse, Instant), AuthError> {
        let started = Instant::now();
        let response = self
            .http
            .post(format!("{}/api/auth/desktop/exchange", self.base_url))
            .json(&json!({ "ticket": ticket, "codeVerifier": verifier }))
            .send()
            .await
            .map_err(|error| Self::transport(error, false))?;
        Ok((Self::decode(response).await?, started))
    }

    pub async fn refresh(&self, refresh: &str) -> Result<(TokenPair, Instant), AuthError> {
        let started = Instant::now();
        let response = self
            .http
            .post(format!("{}/api/auth/refresh", self.base_url))
            .json(&json!({ "refreshToken": refresh }))
            .send()
            .await
            .map_err(|error| Self::transport(error, true))?;
        let tokens = Self::decode(response).await.map_err(|error| {
            if matches!(error.code, "INVALID_RESPONSE" | "API_ERROR") {
                AuthError::new(
                    "REFRESH_UNCERTAIN",
                    "Não foi possível confirmar a renovação. Entre novamente.",
                )
            } else {
                error
            }
        })?;
        Ok((tokens, started))
    }

    pub async fn profile(&self, access: &str) -> Result<User, AuthError> {
        #[derive(serde::Deserialize)]
        struct Profile {
            user: User,
        }
        let response = self
            .http
            .get(format!("{}/api/auth/me", self.base_url))
            .bearer_auth(access)
            .send()
            .await
            .map_err(|error| Self::transport(error, false))?;
        Ok(Self::decode::<Profile>(response).await?.user)
    }

    pub async fn logout(&self, refresh: &str) -> Result<(), AuthError> {
        let response = self
            .http
            .post(format!("{}/api/auth/logout", self.base_url))
            .json(&json!({ "refreshToken": refresh }))
            .send()
            .await
            .map_err(|error| Self::transport(error, false))?;
        Self::checked(response).await?;
        Ok(())
    }
}
