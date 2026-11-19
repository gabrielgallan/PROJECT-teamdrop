use super::types::{AuthError, StoredCredential};

pub trait CredentialStore: Send + Sync {
    fn read(&self, service: &str) -> Result<Option<StoredCredential>, AuthError>;
    fn write(&self, service: &str, credential: &StoredCredential) -> Result<(), AuthError>;
    fn delete(&self, service: &str) -> Result<(), AuthError>;
}
pub struct WindowsCredentialStore;

#[cfg(windows)]
impl WindowsCredentialStore {
    #[cfg(test)]
    pub fn test_entry(service: &str) -> Result<keyring_core::Entry, AuthError> {
        Self::entry(service)
    }
    fn entry(service: &str) -> Result<keyring_core::Entry, AuthError> {
        use std::{collections::HashMap, sync::OnceLock};
        static INITIALIZED: OnceLock<Result<(), AuthError>> = OnceLock::new();
        INITIALIZED
            .get_or_init(|| {
                let store =
                    windows_native_keyring_store::Store::new().map_err(|_| AuthError::store())?;
                keyring_core::set_default_store(store);
                Ok(())
            })
            .clone()?;
        keyring_core::Entry::new_with_modifiers(
            service,
            "session",
            &HashMap::from([("persistence", "Local")]),
        )
        .map_err(|_| AuthError::store())
    }
}

#[cfg(windows)]
impl CredentialStore for WindowsCredentialStore {
    fn read(&self, service: &str) -> Result<Option<StoredCredential>, AuthError> {
        match Self::entry(service)?.get_password() {
            Ok(value) => serde_json::from_str(&value)
                .map(Some)
                .map_err(|_| AuthError::store()),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(_) => Err(AuthError::store()),
        }
    }
    fn write(&self, service: &str, credential: &StoredCredential) -> Result<(), AuthError> {
        let value = serde_json::to_string(credential).map_err(|_| AuthError::store())?;
        Self::entry(service)?
            .set_password(&value)
            .map_err(|_| AuthError::store())
    }
    fn delete(&self, service: &str) -> Result<(), AuthError> {
        match Self::entry(service)?.delete_credential() {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(_) => Err(AuthError::store()),
        }
    }
}

#[cfg(not(windows))]
impl CredentialStore for WindowsCredentialStore {
    fn read(&self, _: &str) -> Result<Option<StoredCredential>, AuthError> {
        Err(AuthError::new(
            "UNSUPPORTED_PLATFORM",
            "A autenticação persistente está disponível no Windows.",
        ))
    }
    fn write(&self, _: &str, _: &StoredCredential) -> Result<(), AuthError> {
        Err(AuthError::store())
    }
    fn delete(&self, _: &str) -> Result<(), AuthError> {
        Err(AuthError::store())
    }
}
