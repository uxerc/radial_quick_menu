use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Clone, Serialize)]
struct OpenPayload {
    x: f64,
    y: f64,
    shift: bool,
}

/// The overlay covers the monitor under the cursor, so the frontend can clamp the wheel to the viewport.
fn open_wheel(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("overlay").ok_or("overlay window missing")?;
    let cursor = app.cursor_position()?;
    let monitor = app
        .monitor_from_point(cursor.x, cursor.y)?
        .or(app.primary_monitor()?)
        .ok_or("no monitor")?;

    let origin: PhysicalPosition<i32> = *monitor.position();
    let size: PhysicalSize<u32> = *monitor.size();
    window.set_position(origin)?;
    window.set_size(size)?;
    window.set_ignore_cursor_events(false)?;
    window.show()?;
    window.set_focus()?;

    let scale = monitor.scale_factor();
    window.emit(
        "wheel-open",
        OpenPayload {
            x: (cursor.x - origin.x as f64) / scale,
            y: (cursor.y - origin.y as f64) / scale,
            shift: false,
        },
    )?;
    Ok(())
}

#[tauri::command]
fn close_wheel(app: AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.hide();
    }
}

pub fn run() {
    let hotkey = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &hotkey && event.state() == ShortcutState::Pressed {
                        if let Err(error) = open_wheel(app) {
                            eprintln!("failed to open wheel: {error}");
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            app.global_shortcut().register(hotkey)?;
            if let Some(window) = app.get_webview_window("overlay") {
                window.set_ignore_cursor_events(true)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![close_wheel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
