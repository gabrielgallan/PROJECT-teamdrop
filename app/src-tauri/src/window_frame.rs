use std::{io, ptr};

use tauri::WebviewWindow;
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            GWL_STYLE, GetWindowLongW, STYLESTRUCT, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE, SWP_NOZORDER, SetWindowLongW, SetWindowPos, WM_NCDESTROY, WM_STYLECHANGING,
            WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_SYSMENU,
        },
    },
};

const CAPTION_BUTTON_STYLES: u32 = WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX;
const SUBCLASS_ID: usize = 1;

pub fn hide_caption_buttons(window: &WebviewWindow) -> tauri::Result<()> {
    let hwnd = window.hwnd()?.0;

    // SAFETY: setup runs on the window's owning thread, and the callback holds no borrowed data.
    unsafe {
        if SetWindowSubclass(hwnd, Some(caption_proc), SUBCLASS_ID, 0) == 0 {
            return Err(io::Error::other("Failed to subclass the widget window").into());
        }

        let style = GetWindowLongW(hwnd, GWL_STYLE);
        if style == 0
            || SetWindowLongW(hwnd, GWL_STYLE, style & !(CAPTION_BUTTON_STYLES as i32)) == 0
            || SetWindowPos(
                hwnd,
                ptr::null_mut(),
                0,
                0,
                0,
                0,
                SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
            ) == 0
        {
            return Err(io::Error::last_os_error().into());
        }
    }

    Ok(())
}

unsafe extern "system" fn caption_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    _data: usize,
) -> LRESULT {
    // Tauri reapplies the window styles when showing or hiding the widget.
    if message == WM_STYLECHANGING && wparam as i32 == GWL_STYLE {
        // SAFETY: for WM_STYLECHANGING, Windows supplies a writable STYLESTRUCT in lparam.
        unsafe { (*(lparam as *mut STYLESTRUCT)).styleNew &= !CAPTION_BUTTON_STYLES };
    } else if message == WM_NCDESTROY {
        // SAFETY: the callback is registered on this HWND under the supplied ID.
        unsafe { RemoveWindowSubclass(hwnd, Some(caption_proc), subclass_id) };
    }

    // SAFETY: forward the original message to the next window procedure.
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}
