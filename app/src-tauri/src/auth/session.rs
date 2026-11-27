use super::{
    client::AuthClient,
    credential_store::{CredentialStore, WindowsCredentialStore},
    types::{AuthError, ExchangeResponse, LoginResult, Session, StoredCredential, TokenPair, User},
};
use std::{
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

struct AccessToken {
    value: String,
    refresh_at: Instant,
}

#[derive(Default)]
struct SessionState {
    client: Option<AuthClient>,
    loaded: bool,
    credential: Option<StoredCredential>,
    access: Option<AccessToken>,
    user: Option<User>,
    dirty: bool,
    needs_delete: bool,
    logout_revoked: bool,
    login_generation: Option<u64>,
}
impl SessionState {
    fn client(&self) -> Result<AuthClient, AuthError> {
        self.client.clone().ok_or(AuthError::new(
            "NOT_INITIALIZED",
            "Inicialize a sessão antes de continuar.",
        ))
    }
    fn service(&self) -> Result<String, AuthError> {
        Ok(format!("Teamdrop:{}", self.client()?.base_url))
    }
    fn clear(&mut self) {
        self.credential = None;
        self.access = None;
        self.user = None;
        self.dirty = false;
        self.logout_revoked = false;
        self.login_generation = None;
    }
}

pub struct SessionManager {
    state: Mutex<SessionState>,
    generation: AtomicU64,
    store: Arc<dyn CredentialStore>,
}
impl Default for SessionManager {
    fn default() -> Self {
        Self::new(Arc::new(WindowsCredentialStore))
    }
}
impl SessionManager {
    pub fn new(store: Arc<dyn CredentialStore>) -> Self {
        Self {
            state: Mutex::new(SessionState::default()),
            generation: AtomicU64::new(0),
            store,
        }
    }

    async fn read(&self, state: &mut SessionState) -> Result<(), AuthError> {
        if state.needs_delete {
            self.remove(state).await?;
        }
        if state.loaded {
            return Ok(());
        }
        let store = self.store.clone();
        let service = state.service()?;
        state.credential = tauri::async_runtime::spawn_blocking(move || store.read(&service))
            .await
            .map_err(|_| AuthError::store())??;
        state.loaded = true;
        Ok(())
    }

    async fn persist(&self, state: &mut SessionState) -> Result<(), AuthError> {
        if !state.dirty {
            return Ok(());
        }
        let credential = state.credential.clone().ok_or_else(AuthError::store)?;
        let store = self.store.clone();
        let service = state.service()?;
        tauri::async_runtime::spawn_blocking(move || store.write(&service, &credential))
            .await
            .map_err(|_| AuthError::store())??;
        state.dirty = false;
        Ok(())
    }

    async fn remove(&self, state: &mut SessionState) -> Result<(), AuthError> {
        state.needs_delete = true;
        // Block access immediately, even when deleting from the vault fails.
        state.clear();
        let store = self.store.clone();
        let service = state.service()?;
        tauri::async_runtime::spawn_blocking(move || store.delete(&service))
            .await
            .map_err(|_| AuthError::store())??;
        state.needs_delete = false;
        state.loaded = true;
        Ok(())
    }

    fn accept(
        state: &mut SessionState,
        tokens: TokenPair,
        started: Instant,
    ) -> Result<(), AuthError> {
        if tokens.token_type != "Bearer"
            || tokens.expires_in == 0
            || tokens.expires_in > 900
            || tokens.access_token.is_empty()
            || tokens.refresh_token.len() != 43
        {
            return Err(AuthError::new(
                "REFRESH_UNCERTAIN",
                "A API retornou credenciais inválidas. Entre novamente.",
            ));
        }
        let credential = StoredCredential {
            refresh_token: tokens.refresh_token,
            refresh_expires_at: tokens.refresh_expires_at,
            uncertain: false,
        };
        if !matches!(credential.expired(), Ok(false)) {
            return Err(AuthError::new(
                "REFRESH_UNCERTAIN",
                "A API retornou uma validade inválida. Entre novamente.",
            ));
        }
        state.credential = Some(credential);
        state.access = Some(AccessToken {
            value: tokens.access_token,
            // Near the absolute session deadline, reuse the short token until it expires.
            refresh_at: started
                + Duration::from_secs(
                    tokens.expires_in - if tokens.expires_in > 30 { 30 } else { 0 },
                ),
        });
        state.dirty = true;
        state.loaded = true;
        state.logout_revoked = false;
        Ok(())
    }

    async fn token(
        &self,
        state: &mut SessionState,
        rejected: Option<&str>,
    ) -> Result<String, AuthError> {
        self.read(state).await?;
        if state.logout_revoked {
            return Err(AuthError::store());
        }
        self.persist(state).await?;
        let credential = state
            .credential
            .clone()
            .ok_or_else(AuthError::invalid_refresh)?;
        if credential.expired()? {
            self.remove(state).await?;
            return Err(AuthError::invalid_refresh());
        }
        if credential.uncertain {
            return Err(AuthError::new(
                "REFRESH_UNCERTAIN",
                "Não foi possível confirmar a renovação anterior. Entre novamente.",
            ));
        }
        if let Some(access) = &state.access {
            if access.refresh_at > Instant::now() && rejected != Some(access.value.as_str()) {
                return Ok(access.value.clone());
            }
        }
        let client = state.client()?;
        match client.refresh(&credential.refresh_token).await {
            Ok((tokens, started)) => {
                if let Err(error) = Self::accept(state, tokens, started) {
                    if let Some(credential) = state.credential.as_mut() {
                        credential.uncertain = true;
                    }
                    state.access = None;
                    state.dirty = true;
                    self.persist(state).await?;
                    return Err(error);
                }
                self.persist(state).await?;
                Ok(state
                    .access
                    .as_ref()
                    .expect("accepted access token")
                    .value
                    .clone())
            }
            Err(error) => {
                if error.code == "INVALID_REFRESH_TOKEN" {
                    self.remove(state).await?;
                } else if error.code == "REFRESH_UNCERTAIN" {
                    if let Some(credential) = state.credential.as_mut() {
                        credential.uncertain = true;
                    }
                    state.access = None;
                    state.dirty = true;
                    self.persist(state).await?;
                }
                Err(error)
            }
        }
    }

    pub async fn restore(&self, base_url: &str) -> Result<Option<Session>, AuthError> {
        let client = AuthClient::new(base_url)?;
        let mut state = self.state.lock().await;
        if let Some(existing) = &state.client {
            if existing.base_url != client.base_url {
                return Err(AuthError::new(
                    "INVALID_API_URL",
                    "A URL da API não pode mudar durante a execução.",
                ));
            }
        } else {
            state.client = Some(client);
        }
        self.read(&mut state).await?;
        if state.credential.is_none() {
            return Ok(None);
        }
        let access = match self.token(&mut state, None).await {
            Ok(access) => access,
            Err(error) if error.code == "INVALID_REFRESH_TOKEN" => return Ok(None),
            Err(error) => return Err(error),
        };
        if state.user.is_none() {
            match state.client()?.profile(&access).await {
                Ok(user) => state.user = Some(user),
                Err(error) if error.code == "UNAUTHORIZED" => {
                    self.remove(&mut state).await?;
                    return Ok(None);
                }
                Err(error) => return Err(error),
            }
        }
        Ok(state.user.clone().map(|user| Session { user }))
    }

    pub async fn access_token(&self, rejected: Option<&str>) -> Result<String, AuthError> {
        let mut state = self.state.lock().await;
        self.token(&mut state, rejected).await
    }

    pub async fn exchange(
        &self,
        ticket: &str,
        verifier: &str,
        generation: u64,
    ) -> Result<LoginResult, AuthError> {
        if self.generation.load(Ordering::SeqCst) != generation {
            return Err(AuthError::cancelled());
        }
        let mut state = self.state.lock().await;
        if self.generation.load(Ordering::SeqCst) != generation {
            return Err(AuthError::cancelled());
        }
        let client = state.client()?;
        if state.credential.is_some() {
            return Err(AuthError::new(
                "SESSION_EXISTS",
                "Restaure ou encerre a sessão antes de entrar novamente.",
            ));
        }
        let (response, started) = client.exchange(ticket, verifier).await?;
        match response {
            ExchangeResponse::Pending => Ok(LoginResult::Pending),
            ExchangeResponse::Complete { tokens, user } => {
                if self.generation.load(Ordering::SeqCst) != generation {
                    let _ = client.logout(&tokens.refresh_token).await;
                    return Err(AuthError::cancelled());
                }
                Self::accept(&mut state, tokens, started)?;
                state.user = Some(user.clone());
                state.login_generation = Some(generation);
                self.persist(&mut state).await?;
                if self.generation.load(Ordering::SeqCst) != generation {
                    self.discard_login(&mut state).await?;
                    return Err(AuthError::cancelled());
                }
                Ok(LoginResult::Complete {
                    session: Session { user },
                })
            }
        }
    }

    async fn discard_login(&self, state: &mut SessionState) -> Result<(), AuthError> {
        if let Some(credential) = &state.credential {
            let _ = state.client()?.logout(&credential.refresh_token).await;
        }
        self.remove(state).await
    }

    pub async fn cancel_login(&self) -> Result<u64, AuthError> {
        let previous = self.generation.fetch_add(1, Ordering::SeqCst);
        let mut state = self.state.lock().await;
        if state.login_generation == Some(previous) {
            self.discard_login(&mut state).await?;
        }
        Ok(previous + 1)
    }

    pub async fn logout(&self) -> Result<(), AuthError> {
        self.generation.fetch_add(1, Ordering::SeqCst);
        let mut state = self.state.lock().await;
        self.read(&mut state).await?;
        if !state.logout_revoked {
            if let Some(credential) = &state.credential {
                state.client()?.logout(&credential.refresh_token).await?;
            }
            state.logout_revoked = true;
        }
        // On vault failure, a retry only repeats local removal, not token renewal.
        self.remove(&mut state).await
    }
}

#[cfg(test)]
#[path = "session_tests.rs"]
mod tests;
