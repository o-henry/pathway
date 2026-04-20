#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

const API_HOST: &str = "127.0.0.1";
const API_PORT: u16 = 8000;

struct ApiProcess(Mutex<Option<Child>>);

fn repo_root(app: &AppHandle) -> PathBuf {
    if let Ok(current_dir) = std::env::current_dir() {
        if current_dir.join("apps/api/lifemap_api/main.py").exists() {
            return current_dir;
        }
    }

    app.path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn api_entry(root: &Path) -> PathBuf {
    root.join("apps/api/lifemap_api/main.py")
}

fn can_spawn_local_api(root: &Path) -> bool {
    api_entry(root).exists()
}

fn api_is_live() -> bool {
    TcpStream::connect((API_HOST, API_PORT)).is_ok()
}

fn spawn_dev_api(root: &Path) -> Result<Child, String> {
    let app_path = api_entry(root);

    Command::new("uv")
        .current_dir(root)
        .env("UV_CACHE_DIR", ".uv-cache")
        .arg("run")
        .arg("fastapi")
        .arg("run")
        .arg(app_path)
        .arg("--host")
        .arg(API_HOST)
        .arg("--port")
        .arg(API_PORT.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to launch local Pathway API: {error}"))
}

fn wait_for_api() -> bool {
    let started = Instant::now();

    while started.elapsed() < Duration::from_secs(12) {
        if api_is_live() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }

    false
}

fn start_api_if_needed(app: &AppHandle) -> Result<Option<Child>, String> {
    if api_is_live() {
        return Ok(None);
    }

    let root = repo_root(app);
    if !can_spawn_local_api(&root) {
        return Ok(None);
    }

    let child = spawn_dev_api(&root)?;
    if wait_for_api() {
        Ok(Some(child))
    } else {
        Err("Pathway desktop launched, but the local API did not become ready on http://127.0.0.1:8000.".into())
    }
}

fn main() {
    tauri::Builder::default()
        .manage(ApiProcess(Mutex::new(None)))
        .setup(|app| {
            match start_api_if_needed(app.handle()) {
                Ok(Some(child)) => {
                    let api_process = app.state::<ApiProcess>();
                    *api_process.0.lock().expect("api process mutex poisoned") = Some(child);
                }
                Ok(None) => {}
                Err(message) => {
                    eprintln!("{message}");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                let api_process = app.state::<ApiProcess>();
                let child = {
                    let mut guard = api_process
                        .0
                        .lock()
                        .expect("api process mutex poisoned");
                    guard.take()
                };

                if let Some(mut child) = child {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Pathway desktop");
}
