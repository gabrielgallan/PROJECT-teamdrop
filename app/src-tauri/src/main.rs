#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod window_frame;

use tauri::{
    AppHandle, Manager, PhysicalPosition, Rect, WebviewWindow, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "widget";
const TRAY_GAP: f64 = 8.0;

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![quit_app])
        .setup(|app| {
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
