#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
#[cfg(windows)]
mod window_frame;

use tauri::{
    AppHandle, Manager, PhysicalPosition, Rect, WebviewWindow, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_deep_link::DeepLinkExt;

const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "widget";
const TRAY_GAP: f64 = 8.0;

#[tauri::command]
fn open_google_login(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let parsed = tauri::Url::parse(&url).map_err(|_| "Invalid login URL")?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("accounts.google.com")
        || parsed.path() != "/o/oauth2/v2/auth"
        || parsed.port().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Invalid login URL".into());
    }
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(auth::SessionManager::default())
        .invoke_handler(tauri::generate_handler![
            quit_app,
            open_google_login,
            auth::auth_restore_session,
            auth::auth_exchange_login,
            auth::auth_get_access_token,
            auth::auth_cancel_login,
            auth::auth_logout
        ])
        .setup(|app| {
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            if app.deep_link().register_all().is_err() {
                eprintln!("Could not register invitation links; manual paste is still available.");
            }

            if app.deep_link().get_current()?.is_some() {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |_event| {
                if let Some(window) = handle.get_webview_window(MAIN_WINDOW) {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });
            #[cfg(windows)]
            if let Some(window) = app.get_webview_window(MAIN_WINDOW)
                && let Err(error) = window_frame::hide_caption_buttons(&window)
            {
                eprintln!("Couldn't hide the widget's title bar buttons: {error}");
            }

            let open = MenuItem::with_id(app, "open", "Abrir widget", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let icon = app
                .default_window_icon()
                .ok_or("Missing application icon")?;

            TrayIconBuilder::with_id(TRAY_ID)
                .icon(icon.clone())
                .tooltip("TeamDrop")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        let anchor = app
                            .tray_by_id(TRAY_ID)
                            .and_then(|tray| tray.rect().ok().flatten());
                        show_widget(app, anchor);
                    }
                    "quit" => quit_app(app.clone()),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        toggle_widget(tray.app_handle(), rect);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW {
                return;
            }

            match event {
                WindowEvent::CloseRequested { api, .. } => match window.hide() {
                    Ok(()) => api.prevent_close(),
                    Err(error) => eprintln!("Couldn't hide the widget: {error}"),
                },
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("Failed to run the Tauri app");
}

fn toggle_widget(app: &AppHandle, anchor: Rect) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        eprintln!("Couldn't find the widget window: {MAIN_WINDOW}");
        return;
    };

    let result = window.is_visible().and_then(|visible| {
        if visible && !window.is_minimized()? {
            window.hide()
        } else {
            show_widget(app, Some(anchor));
            Ok(())
        }
    });

    if let Err(error) = result {
        eprintln!("Couldn't toggle the widget: {error}");
    }
}

fn show_widget(app: &AppHandle, anchor: Option<Rect>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        eprintln!("Couldn't find the widget window: {MAIN_WINDOW}");
        return;
    };

    if let Err(error) = position_widget(&window, anchor) {
        eprintln!("Couldn't position the widget: {error}");
    }

    if let Err(error) = window
        .show()
        .and_then(|()| window.unminimize())
        .and_then(|()| window.set_focus())
    {
        eprintln!("Couldn't show the widget: {error}");
    }
}

fn position_widget(window: &WebviewWindow, anchor: Option<Rect>) -> tauri::Result<()> {
    // Windows reports tray bounds in physical screen pixels.
    let anchor = anchor.unwrap_or_default();
    let icon_size = anchor.size.to_physical::<f64>(1.0);
    let icon = if icon_size.width > 0.0 && icon_size.height > 0.0 {
        anchor.position.to_physical::<f64>(1.0)
    } else {
        window.cursor_position()?
    };
    let center_x = icon.x + icon_size.width / 2.0;
    let center_y = icon.y + icon_size.height / 2.0;

    let Some(monitor) = window.monitor_from_point(center_x, center_y)? else {
        return Ok(());
    };
    let work_area = monitor.work_area();
    let left = f64::from(work_area.position.x);
    let top = f64::from(work_area.position.y);
    let right = left + f64::from(work_area.size.width);
    let bottom = top + f64::from(work_area.size.height);

    let scale = monitor.scale_factor();
    let size = window
        .outer_size()?
        .to_logical::<f64>(window.scale_factor()?)
        .to_physical::<f64>(scale);
    let gap = TRAY_GAP * scale;

    let (x, y) = if center_x < left || center_x >= right {
        let x = if center_x < left {
            icon.x + icon_size.width + gap
        } else {
            icon.x - size.width - gap
        };
        (x, center_y - size.height / 2.0)
    } else {
        let above = icon.y - size.height - gap;
        let y = if above >= top {
            above
        } else {
            icon.y + icon_size.height + gap
        };
        (center_x - size.width / 2.0, y)
    };

    window.set_position(PhysicalPosition::new(
        x.clamp(left, (right - size.width).max(left)).round() as i32,
        y.clamp(top, (bottom - size.height).max(top)).round() as i32,
    ))
}
