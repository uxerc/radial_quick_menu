use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Clone, Serialize)]
struct OpenPayload {
    x: f64,
    y: f64,
    shift: bool,
}

/// The overlay covers the monitor under the cursor, so the frontend can clamp the wheel to the viewport.
fn open_wheel(app: &AppHandle, shift: bool) -> Result<(), Box<dyn std::error::Error>> {
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
            shift,
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

#[derive(Deserialize)]
struct Config {
    hotkeys: Vec<String>,
}

const DEFAULT_HOTKEY: &str = "Ctrl+Shift+Space";

/// hotkeys.json in the app config dir: {"hotkeys": ["Ctrl+Alt+Space", "Ctrl+Shift+Space"]}
fn load_hotkeys(app: &AppHandle) -> Vec<Shortcut> {
    let configured = app
        .path()
        .app_config_dir()
        .ok()
        .and_then(|dir| std::fs::read_to_string(dir.join("hotkeys.json")).ok())
        .and_then(|text| serde_json::from_str::<Config>(&text).ok())
        .map(|config| config.hotkeys)
        .unwrap_or_else(|| vec![DEFAULT_HOTKEY.to_string()]);

    let mut shortcuts = Vec::new();
    for text in configured {
        match Shortcut::from_str(&text) {
            Ok(shortcut) => {
                shortcuts.push(shortcut);
                // A combo without Shift also gets a Shift twin that opens straight into layer B.
                if !shortcut.mods.contains(Modifiers::SHIFT) {
                    shortcuts.push(Shortcut::new(Some(shortcut.mods | Modifiers::SHIFT), shortcut.key));
                }
            }
            Err(error) => eprintln!("invalid hotkey '{text}': {error}"),
        }
    }
    shortcuts
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let shift = shortcut.mods.contains(Modifiers::SHIFT);
                        if let Err(error) = open_wheel(app, shift) {
                            eprintln!("failed to open wheel: {error}");
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            for shortcut in load_hotkeys(app.handle()) {
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    eprintln!("could not register hotkey (already taken?): {error}");
                }
            }
            if let Some(window) = app.get_webview_window("overlay") {
                window.set_ignore_cursor_events(true)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![close_wheel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
