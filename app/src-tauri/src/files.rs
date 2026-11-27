use std::{path::Path, time::Duration};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tokio::io::AsyncWriteExt;

fn preview_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "URL de preview inválida.")?;
    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("URL de preview inválida.".into());
    }
    Ok(parsed)
}

#[tauri::command]
pub fn open_file_preview(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let parsed = preview_url(&url)?;
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|_| "Não foi possível abrir o preview no navegador.".into())
}

async fn save_download(url: &str, target: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|_| "Não foi possível iniciar o download.")?;
    // The API already authorized this signed storage URL; never send a Bearer token here.
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
pub async fn download_file(app: AppHandle, url: String, file_name: String) -> Result<bool, String> {
    let parsed_url = reqwest::Url::parse(&url).map_err(|_| "URL de download inválida.")?;
    if !matches!(parsed_url.scheme(), "http" | "https")
        || parsed_url.host_str().is_none()
        || !parsed_url.username().is_empty()
        || parsed_url.password().is_some()
    {
        return Err("URL de download inválida.".into());
    }
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
    save_download(parsed_url.as_str(), &path).await?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::{io::AsyncReadExt, net::TcpListener};

    #[test]
    fn accepts_web_preview_urls_and_rejects_other_schemes_and_credentials() {
        for url in [
            "https://storage.example/file?signature=test",
            "http://localhost:10000/file?signature=test",
        ] {
            assert!(preview_url(url).is_ok());
        }
        for url in [
            "not a url",
            "file:///C:/report.pdf",
            "javascript:alert(1)",
            "teamdrop://invite?token=test",
            "https://user:password@storage.example/file",
        ] {
            assert!(preview_url(url).is_err());
        }
    }

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
