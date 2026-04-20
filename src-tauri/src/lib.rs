use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

#[derive(Default)]
struct InitialFile(Mutex<Option<String>>);

#[derive(Default)]
struct AppState {
    is_quitting: AtomicBool,
}

#[tauri::command]
fn read_md_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_md_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn take_initial_file(state: tauri::State<'_, InitialFile>) -> Option<String> {
    state.0.lock().ok().and_then(|mut g| g.take())
}

fn show_main_window(app_handle: &tauri::AppHandle) {
    if let Some(w) = app_handle.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(InitialFile::default())
        .manage(AppState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<AppState>();
                if !state.is_quitting.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_md_file,
            write_md_file,
            take_initial_file
        ])
        .build(tauri::generate_context!())
        .expect("failed to build tauri app")
        .run(|app_handle, event| match event {
            RunEvent::Opened { urls } => {
                show_main_window(app_handle);
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        let path_str = path.to_string_lossy().to_string();
                        if app_handle.emit("open-file", path_str.clone()).is_err() {
                            if let Some(state) = app_handle.try_state::<InitialFile>() {
                                if let Ok(mut g) = state.0.lock() {
                                    *g = Some(path_str);
                                }
                            }
                        }
                    }
                }
            }
            RunEvent::Reopen { .. } => {
                show_main_window(app_handle);
            }
            RunEvent::ExitRequested { .. } => {
                let state = app_handle.state::<AppState>();
                state.is_quitting.store(true, Ordering::Relaxed);
            }
            _ => {}
        });
}
