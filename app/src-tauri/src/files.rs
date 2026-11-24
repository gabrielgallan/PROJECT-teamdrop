use crate::auth::SessionManager;
use std::{path::Path, time::Duration};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tokio::io::AsyncWriteExt;

fn valid_file_id(id: &str) -> bool {
    id.len() == 36
        && id
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
}

async fn save_download(url: &str, target: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|_| "Não foi possível iniciar o download.")?;
    // The endpoint and its storage redirect are public; never forward a Bearer token.
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| "Não foi possível conectar para baixar o arquivo.")?;
    if !response.status().is_success() {
        return Err(if response.status().as_u16() == 404 {
            "O arquivo não está mais disponível."
        } else {
            "O servidor não conseguiu disponibilizar o arquivo."
        }
        .into());
    }
    let temporary = tempfile::NamedTempFile::new_in(target.parent().ok_or("Destino inválido.")?)
        .map_err(|_| "Não foi possível preparar o destino do download.")?;
    let mut output = tokio::fs::File::from_std(
        temporary
            .reopen()
            .map_err(|_| "Não foi possível abrir o destino.")?,
    );
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "O download foi interrompido. Tente novamente.")?
    {
        output
            .write_all(&chunk)
            .await
            .map_err(|_| "Não foi possível gravar o arquivo.")?;
    }
    output
        .flush()
        .await
        .map_err(|_| "Não foi possível concluir a gravação.")?;
    drop(output);
    temporary
        .persist(target)
        .map_err(|_| "Não foi possível salvar o arquivo no destino escolhido.")?;
    Ok(())
}

#[tauri::command]
pub async fn download_file(
    app: AppHandle,
    state: State<'_, SessionManager>,
    file_id: String,
    file_name: String,
) -> Result<bool, String> {
    if !valid_file_id(&file_id) {
        return Err("Identificador de arquivo inválido.".into());
    }
    let base = state
        .api_base_url()
        .await
        .map_err(|_| "Inicialize a sessão antes de baixar arquivos.")?;
    let name = Path::new(&file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("download")
        .to_string();
    let destination = tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().set_file_name(name).blocking_save_file()
    })
    .await
    .map_err(|_| "Não foi possível abrir o diálogo de salvar.")?;
    let Some(destination) = destination else {
        return Ok(false);
    };
    let path = destination.into_path().map_err(|_| "Destino inválido.")?;
    save_download(&format!("{base}/api/files/{file_id}/download"), &path).await?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::{io::AsyncReadExt, net::TcpListener};

    #[tokio::test]
    async fn saves_bytes_and_preserves_existing_file_when_download_fails() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("report.txt");
        std::fs::write(&target, b"original").unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/download", listener.local_addr().unwrap());
        let server = tokio::spawn(async move {
            for response in [
                "HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\npartial",
                "HTTP/1.1 302 Found\r\nLocation: /file\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                "HTTP/1.1 200 OK\r\nContent-Length: 8\r\nConnection: close\r\n\r\ndownload",
            ] {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut buffer = [0; 2048];
                let count = socket.read(&mut buffer).await.unwrap();
                assert!(
                    !String::from_utf8_lossy(&buffer[..count])
                        .to_lowercase()
                        .contains("authorization:")
                );
                socket.write_all(response.as_bytes()).await.unwrap();
            }
        });
        assert!(save_download(&url, &target).await.is_err());
        assert_eq!(std::fs::read(&target).unwrap(), b"original");
        save_download(&url, &target).await.unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"download");
        server.await.unwrap();
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }
}
