mod client;
mod credential_store;
mod session;
mod types;

pub use session::SessionManager;
use tauri::State;
use types::{AuthError, LoginResult, Session};

#[tauri::command]
pub async fn auth_restore_session(
    state: State<'_, SessionManager>,
    api_base_url: String,
) -> Result<Option<Session>, AuthError> {
    state.restore(&api_base_url).await
}
#[tauri::command]
pub async fn auth_exchange_login(
    state: State<'_, SessionManager>,
    ticket: String,
    code_verifier: String,
    generation: u64,
) -> Result<LoginResult, AuthError> {
    state.exchange(&ticket, &code_verifier, generation).await
}
#[tauri::command]
pub async fn auth_get_access_token(
    state: State<'_, SessionManager>,
    rejected_token: Option<String>,
) -> Result<String, AuthError> {
    state.access_token(rejected_token.as_deref()).await
}
#[tauri::command]
pub async fn auth_cancel_login(state: State<'_, SessionManager>) -> Result<u64, AuthError> {
    state.cancel_login().await
}
#[tauri::command]
pub async fn auth_logout(state: State<'_, SessionManager>) -> Result<(), AuthError> {
    state.logout().await
}
