use super::*;
use serde_json::{Value, json};
use std::sync::{
    Mutex as StdMutex,
    atomic::{AtomicBool, AtomicUsize},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[derive(Default)]
struct MemoryStore {
    value: StdMutex<Option<StoredCredential>>,
    fail_write: AtomicBool,
    fail_delete: AtomicBool,
    fail_read: AtomicBool,
}
impl MemoryStore {
    fn seeded() -> Arc<Self> {
        Arc::new(Self {
            value: StdMutex::new(Some(credential("r"))),
            ..Self::default()
        })
    }
}
impl CredentialStore for MemoryStore {
    fn read(&self, _: &str) -> Result<Option<StoredCredential>, AuthError> {
        if self.fail_read.load(Ordering::SeqCst) {
            return Err(AuthError::store());
        }
        Ok(self.value.lock().unwrap().clone())
    }
    fn write(&self, _: &str, value: &StoredCredential) -> Result<(), AuthError> {
        if self.fail_write.load(Ordering::SeqCst) {
            return Err(AuthError::store());
        }
        *self.value.lock().unwrap() = Some(value.clone());
        Ok(())
    }
    fn delete(&self, _: &str) -> Result<(), AuthError> {
        if self.fail_delete.load(Ordering::SeqCst) {
            return Err(AuthError::store());
        }
        *self.value.lock().unwrap() = None;
        Ok(())
    }
}
fn credential(value: &str) -> StoredCredential {
    StoredCredential {
        refresh_token: value.repeat(43),
        refresh_expires_at: "2099-01-01T00:00:00.000Z".into(),
        uncertain: false,
    }
}
fn pair(refresh: &str, number: usize) -> Value {
    json!({ "accessToken": format!("access-{number}"), "refreshToken": refresh,
        "tokenType": "Bearer", "expiresIn": 900, "refreshExpiresAt": "2099-01-01T00:00:00.000Z" })
}
fn user() -> Value {
    json!({ "id": "test-user", "email": "test@example.test", "name": null, "avatarUrl": null })
}

struct ApiState {
    refreshes: AtomicUsize,
    logouts: AtomicUsize,
    profiles: AtomicUsize,
    exchanges: AtomicUsize,
    current: StdMutex<String>,
    offline_logout: AtomicBool,
    lose_refresh: AtomicBool,
    slow_exchange: AtomicBool,
    slow_refresh: AtomicBool,
    pending_exchange: AtomicBool,
}
struct MockApi {
    url: String,
    state: Arc<ApiState>,
    task: tokio::task::JoinHandle<()>,
}
impl Drop for MockApi {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn mock_api() -> MockApi {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let state = Arc::new(ApiState {
        refreshes: AtomicUsize::new(0),
        logouts: AtomicUsize::new(0),
        profiles: AtomicUsize::new(0),
        exchanges: AtomicUsize::new(0),
        current: StdMutex::new("r".repeat(43)),
        offline_logout: AtomicBool::new(false),
        lose_refresh: AtomicBool::new(false),
        slow_exchange: AtomicBool::new(false),
        slow_refresh: AtomicBool::new(false),
        pending_exchange: AtomicBool::new(false),
    });
    let server_state = state.clone();
    let task = tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                break;
            };
            let state = server_state.clone();
            tokio::spawn(async move {
                let mut request = Vec::new();
                let (header_end, length) = loop {
                    let mut buffer = [0; 2048];
                    let count = socket.read(&mut buffer).await.unwrap_or(0);
                    if count == 0 {
                        return;
                    }
                    request.extend_from_slice(&buffer[..count]);
                    if let Some(position) =
                        request.windows(4).position(|bytes| bytes == b"\r\n\r\n")
                    {
                        let headers = String::from_utf8_lossy(&request[..position]);
                        let length = headers
                            .lines()
                            .find_map(|line| {
                                let (key, value) = line.split_once(':')?;
                                key.eq_ignore_ascii_case("content-length")
                                    .then(|| value.trim().parse::<usize>().ok())
                                    .flatten()
                            })
                            .unwrap_or(0);
                        break (position + 4, length);
                    }
                };
                while request.len() < header_end + length {
                    let mut buffer = [0; 2048];
                    let count = socket.read(&mut buffer).await.unwrap_or(0);
                    if count == 0 {
                        return;
                    }
                    request.extend_from_slice(&buffer[..count]);
                }
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let path = headers
                    .lines()
                    .next()
                    .unwrap()
                    .split_whitespace()
                    .nth(1)
                    .unwrap();
                let body: Value =
                    serde_json::from_slice(&request[header_end..]).unwrap_or_default();
                let (status, data) = match path {
                    "/api/auth/refresh" => {
                        let number = state.refreshes.fetch_add(1, Ordering::SeqCst) + 1;
                        if body["refreshToken"].as_str()
                            != Some(state.current.lock().unwrap().as_str())
                        {
                            (401, json!({ "code": "INVALID_REFRESH_TOKEN" }))
                        } else {
                            let next = ((b'a' + number as u8) as char).to_string().repeat(43);
                            *state.current.lock().unwrap() = next.clone();
                            if state.lose_refresh.load(Ordering::SeqCst) {
                                return;
                            }
                            if state.slow_refresh.load(Ordering::SeqCst) {
                                tokio::time::sleep(Duration::from_millis(100)).await;
                            }
                            (200, pair(&next, number))
                        }
                    }
                    "/api/auth/profile" => {
                        state.profiles.fetch_add(1, Ordering::SeqCst);
                        (200, json!({ "user": user() }))
                    }
                    "/api/auth/logout" => {
                        state.logouts.fetch_add(1, Ordering::SeqCst);
                        assert_eq!(
                            body["refreshToken"].as_str(),
                            Some(state.current.lock().unwrap().as_str())
                        );
                        if state.offline_logout.load(Ordering::SeqCst) {
                            (503, json!({}))
                        } else {
                            (204, json!({}))
                        }
                    }
                    "/api/auth/desktop/exchange" => {
                        state.exchanges.fetch_add(1, Ordering::SeqCst);
                        if state.slow_exchange.load(Ordering::SeqCst) {
                            tokio::time::sleep(Duration::from_millis(100)).await;
                        }
                        if state.pending_exchange.load(Ordering::SeqCst) {
                            (200, json!({ "status": "pending" }))
                        } else {
                            let mut data = pair(&"r".repeat(43), 0);
                            data["status"] = json!("complete");
                            data["user"] = user();
                            (200, data)
                        }
                    }
                    _ => (404, json!({})),
                };
                let body = if status == 204 {
                    String::new()
                } else {
                    data.to_string()
                };
                let response = format!(
                    "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = socket.write_all(response.as_bytes()).await;
            });
        }
    });
    MockApi { url, state, task }
}

#[tokio::test]
async fn restores_once_for_concurrent_callers_and_survives_a_new_manager() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    let manager = Arc::new(SessionManager::new(store.clone()));
    let mut callers = Vec::new();
    for _ in 0..8 {
        let manager = manager.clone();
        let url = api.url.clone();
        callers.push(tokio::spawn(async move {
            manager.restore(&url).await.unwrap().is_some()
        }));
    }
    for caller in callers {
        assert!(caller.await.unwrap());
    }
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 1);
    assert_eq!(api.state.profiles.load(Ordering::SeqCst), 1);
    let restored = manager.restore(&api.url).await.unwrap().unwrap();
    let serialized = serde_json::to_string(&restored).unwrap();
    assert!(!serialized.contains("refresh"));
    assert!(!serialized.contains("access"));
    let new_process = SessionManager::new(store.clone());
    assert!(new_process.restore(&api.url).await.unwrap().is_some());
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 2);
    assert_eq!(
        manager
            .restore("https://different.example")
            .await
            .err()
            .unwrap()
            .code,
        "INVALID_API_URL"
    );
}

#[tokio::test]
async fn simultaneous_expired_requests_share_one_rotation() {
    let api = mock_api().await;
    let manager = Arc::new(SessionManager::new(MemoryStore::seeded()));
    manager.restore(&api.url).await.unwrap();
    let old = manager.access_token(None).await.unwrap();
    let mut callers = Vec::new();
    for _ in 0..8 {
        let manager = manager.clone();
        let old = old.clone();
        callers.push(tokio::spawn(async move {
            manager.access_token(Some(&old)).await.unwrap()
        }));
    }
    for caller in callers {
        assert_eq!(caller.await.unwrap(), "access-2");
    }
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn write_failure_keeps_rotated_token_and_retries_only_persistence() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    store.fail_write.store(true, Ordering::SeqCst);
    let manager = SessionManager::new(store.clone());
    assert_eq!(
        manager.restore(&api.url).await.err().unwrap().code,
        "CREDENTIAL_STORE_ERROR"
    );
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 1);
    store.fail_write.store(false, Ordering::SeqCst);
    assert!(manager.restore(&api.url).await.unwrap().is_some());
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 1);
    assert_ne!(
        store.value.lock().unwrap().as_ref().unwrap().refresh_token,
        "r".repeat(43)
    );
}

#[tokio::test]
async fn invalid_or_expired_refresh_removes_credentials() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    *api.state.current.lock().unwrap() = "different".into();
    let manager = SessionManager::new(store.clone());
    assert!(manager.restore(&api.url).await.unwrap().is_none());
    assert!(store.value.lock().unwrap().is_none());
    let expired = MemoryStore::seeded();
    expired
        .value
        .lock()
        .unwrap()
        .as_mut()
        .unwrap()
        .refresh_expires_at = "2000-01-01T00:00:00Z".into();
    assert!(
        SessionManager::new(expired.clone())
            .restore(&api.url)
            .await
            .unwrap()
            .is_none()
    );
    assert!(expired.value.lock().unwrap().is_none());
}

#[tokio::test]
async fn read_failure_is_recoverable_without_becoming_anonymous() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    store.fail_read.store(true, Ordering::SeqCst);
    let manager = SessionManager::new(store.clone());
    assert_eq!(
        manager.restore(&api.url).await.err().unwrap().code,
        "CREDENTIAL_STORE_ERROR"
    );
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 0);
    store.fail_read.store(false, Ordering::SeqCst);
    assert!(manager.restore(&api.url).await.unwrap().is_some());
}

#[tokio::test]
async fn lost_refresh_response_is_not_automatically_retried_even_after_restart() {
    let api = mock_api().await;
    api.state.lose_refresh.store(true, Ordering::SeqCst);
    let store = MemoryStore::seeded();
    let manager = SessionManager::new(store.clone());
    assert_eq!(
        manager.restore(&api.url).await.err().unwrap().code,
        "REFRESH_UNCERTAIN"
    );
    assert_eq!(
        manager.restore(&api.url).await.err().unwrap().code,
        "REFRESH_UNCERTAIN"
    );
    let restarted = SessionManager::new(store.clone());
    assert_eq!(
        restarted.restore(&api.url).await.err().unwrap().code,
        "REFRESH_UNCERTAIN"
    );
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 1);
    assert!(store.value.lock().unwrap().as_ref().unwrap().uncertain);
}

#[tokio::test]
async fn offline_logout_keeps_credentials_and_can_be_retried() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    let manager = SessionManager::new(store.clone());
    manager.restore(&api.url).await.unwrap();
    api.state.offline_logout.store(true, Ordering::SeqCst);
    assert_eq!(manager.logout().await.err().unwrap().code, "API_ERROR");
    assert!(store.value.lock().unwrap().is_some());
    assert_eq!(manager.access_token(None).await.unwrap(), "access-1");
    api.state.offline_logout.store(false, Ordering::SeqCst);
    manager.logout().await.unwrap();
    assert!(store.value.lock().unwrap().is_none());
}

#[tokio::test]
async fn failed_local_logout_removal_retries_without_rotating_or_revoking_again() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    let manager = SessionManager::new(store.clone());
    manager.restore(&api.url).await.unwrap();
    store.fail_delete.store(true, Ordering::SeqCst);
    assert_eq!(
        manager.logout().await.err().unwrap().code,
        "CREDENTIAL_STORE_ERROR"
    );
    store.fail_delete.store(false, Ordering::SeqCst);
    manager.logout().await.unwrap();
    assert_eq!(api.state.logouts.load(Ordering::SeqCst), 1);
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn cancelling_in_flight_login_revokes_late_tokens_without_persisting() {
    let api = mock_api().await;
    api.state.slow_exchange.store(true, Ordering::SeqCst);
    let store = Arc::new(MemoryStore::default());
    let manager = Arc::new(SessionManager::new(store.clone()));
    assert!(manager.restore(&api.url).await.unwrap().is_none());
    let generation = manager.cancel_login().await.unwrap();
    let copy = manager.clone();
    let exchange =
        tokio::spawn(async move { copy.exchange("ticket", "verifier", generation).await });
    while api.state.exchanges.load(Ordering::SeqCst) == 0 {
        tokio::task::yield_now().await;
    }
    manager.cancel_login().await.unwrap();
    assert_eq!(
        exchange.await.unwrap().err().unwrap().code,
        "LOGIN_CANCELLED"
    );
    assert!(store.value.lock().unwrap().is_none());
    assert_eq!(api.state.logouts.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn login_is_pending_until_tokens_are_safely_saved() {
    let api = mock_api().await;
    let store = Arc::new(MemoryStore::default());
    let manager = SessionManager::new(store.clone());
    manager.restore(&api.url).await.unwrap();
    api.state.pending_exchange.store(true, Ordering::SeqCst);
    assert!(matches!(
        manager.exchange("ticket", "verifier", 0).await.unwrap(),
        LoginResult::Pending
    ));
    assert!(store.value.lock().unwrap().is_none());
    api.state.pending_exchange.store(false, Ordering::SeqCst);
    store.fail_write.store(true, Ordering::SeqCst);
    assert_eq!(
        manager
            .exchange("ticket", "verifier", 0)
            .await
            .err()
            .unwrap()
            .code,
        "CREDENTIAL_STORE_ERROR"
    );
    store.fail_write.store(false, Ordering::SeqCst);
    assert!(manager.restore(&api.url).await.unwrap().is_some());
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 0);
}

#[test]
fn validates_api_origin_and_rejects_remote_http_and_embedded_credentials() {
    for url in [
        "http://example.com",
        "https://user:pass@example.com",
        "https://example.com/path",
        "https://example.com?query=1",
        "file:///test",
        "https://example.com/#fragment",
    ] {
        assert!(AuthClient::new(url).is_err(), "{url}");
    }
    assert_eq!(
        AuthClient::new("https://EXAMPLE.com:443/")
            .unwrap()
            .base_url,
        "https://example.com"
    );
}

#[cfg(windows)]
#[test]
#[ignore = "Writes only a unique synthetic credential to the real Windows vault"]
fn windows_vault_roundtrip() {
    let service = format!(
        "Teamdrop-auth-smoke-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    let store = WindowsCredentialStore;
    assert!(store.read(&service).unwrap().is_none());
    let result = (|| {
        store.write(&service, &credential("t"))?;
        let restored = WindowsCredentialStore
            .read(&service)?
            .ok_or_else(AuthError::store)?;
        assert_eq!(restored.refresh_token, "t".repeat(43));
        let entry = WindowsCredentialStore::test_entry(&service)?;
        assert_eq!(
            entry
                .get_attributes()
                .unwrap()
                .get("persistence")
                .unwrap()
                .to_lowercase(),
            "local"
        );
        Ok::<_, AuthError>(())
    })();
    store.delete(&service).unwrap();
    assert!(store.read(&service).unwrap().is_none());
    result.unwrap();
}

#[tokio::test]
async fn logout_waits_for_renewal_and_revokes_the_replacement() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    let manager = Arc::new(SessionManager::new(store.clone()));
    manager.restore(&api.url).await.unwrap();
    let old = manager.access_token(None).await.unwrap();
    api.state.slow_refresh.store(true, Ordering::SeqCst);
    let copy = manager.clone();
    let rotation = tokio::spawn(async move { copy.access_token(Some(&old)).await });
    while api.state.refreshes.load(Ordering::SeqCst) < 2 {
        tokio::task::yield_now().await;
    }
    manager.logout().await.unwrap();
    assert!(rotation.await.unwrap().is_ok());
    assert!(store.value.lock().unwrap().is_none());
    assert_eq!(api.state.logouts.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn short_lived_access_near_session_expiry_is_not_rotated_on_every_request() {
    let api = mock_api().await;
    let store = MemoryStore::seeded();
    let manager = SessionManager::new(store.clone());
    manager.restore(&api.url).await.unwrap();
    let refresh = store
        .value
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .refresh_token
        .clone();
    let mut value = pair(&refresh, 99);
    value["expiresIn"] = json!(15);
    {
        let mut state = manager.state.lock().await;
        SessionManager::accept(
            &mut state,
            serde_json::from_value(value).unwrap(),
            Instant::now(),
        )
        .unwrap();
    }
    for _ in 0..8 {
        assert_eq!(manager.access_token(None).await.unwrap(), "access-99");
    }
    assert_eq!(api.state.refreshes.load(Ordering::SeqCst), 1);
}
