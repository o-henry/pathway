#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const API_HOST: &str = "127.0.0.1";
const API_PORT: u16 = 8000;

#[cfg(all(target_os = "macos", debug_assertions))]
fn apply_dev_app_icon(app: &AppHandle) {
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let icon_path = repo_root(app).join("src-tauri/icons/icon.png");
    let Ok(bytes) = std::fs::read(&icon_path) else {
        eprintln!("PATHWAY dev icon not found at {}", icon_path.display());
        return;
    };

    let Some(mtm) = MainThreadMarker::new() else {
        eprintln!("PATHWAY dev icon skipped: not on main thread");
        return;
    };

    let data = NSData::with_bytes(&bytes);
    let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) else {
        eprintln!("PATHWAY dev icon skipped: failed to decode {}", icon_path.display());
        return;
    };

    let appkit = NSApplication::sharedApplication(mtm);
    unsafe {
        appkit.setApplicationIconImage(Some(&image));
    }
}

#[cfg(not(all(target_os = "macos", debug_assertions)))]
fn apply_dev_app_icon(_app: &AppHandle) {}

struct ApiProcess(Mutex<Option<Child>>);

#[derive(Clone, Serialize)]
struct CollectorHealthResult {
    provider: String,
    available: bool,
    ready: bool,
    configured: bool,
    installed: bool,
    installable: bool,
    message: String,
    capabilities: Vec<String>,
}

#[derive(Clone, Serialize)]
struct CollectorInstallResult {
    provider: String,
    installed: bool,
    message: String,
}

struct CollectorDefinition {
    id: &'static str,
    capabilities: &'static [&'static str],
    installable: bool,
}

const COLLECTOR_DEFINITIONS: [CollectorDefinition; 7] = [
    CollectorDefinition {
        id: "scrapling",
        capabilities: &["extract_document"],
        installable: true,
    },
    CollectorDefinition {
        id: "crawl4ai",
        capabilities: &["extract_document"],
        installable: true,
    },
    CollectorDefinition {
        id: "steel",
        capabilities: &["extract_document", "interactive_browser", "stateful_session"],
        installable: false,
    },
    CollectorDefinition {
        id: "playwright_local",
        capabilities: &["interactive_browser"],
        installable: true,
    },
    CollectorDefinition {
        id: "browser_use",
        capabilities: &["interactive_browser"],
        installable: true,
    },
    CollectorDefinition {
        id: "scrapy_playwright",
        capabilities: &["batch_crawl"],
        installable: true,
    },
    CollectorDefinition {
        id: "lightpanda_experimental",
        capabilities: &["interactive_browser", "stateful_session"],
        installable: false,
    },
];

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

fn collector_definition(provider: &str) -> Option<&'static CollectorDefinition> {
    COLLECTOR_DEFINITIONS.iter().find(|definition| definition.id == provider)
}

fn collector_root(app: &AppHandle, cwd: Option<String>) -> PathBuf {
    let requested = cwd
        .map(PathBuf::from)
        .filter(|path| path.exists() && path.is_dir());
    requested.unwrap_or_else(|| repo_root(app))
}

fn command_available(name: &str) -> bool {
    Command::new("which")
        .arg(name)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn run_status(command: &str, args: &[&str], cwd: &Path) -> bool {
    Command::new(command)
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn python_module_installed(root: &Path, module_name: &str) -> bool {
    if !command_available("uv") {
        return false;
    }

    let script = format!(
        "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec({module_name:?}) else 1)"
    );
    run_status("uv", &["run", "python3", "-c", &script], root)
}

fn node_cli_available(root: &Path, args: &[&str]) -> bool {
    if !command_available("pnpm") {
        return false;
    }
    run_status("pnpm", args, root)
}

fn env_configured(keys: &[&str]) -> bool {
    keys.iter().any(|key| {
        std::env::var(key)
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
    })
}

fn build_health_result(
    definition: &CollectorDefinition,
    available: bool,
    ready: bool,
    configured: bool,
    installed: bool,
    message: impl Into<String>,
) -> CollectorHealthResult {
    CollectorHealthResult {
        provider: definition.id.to_string(),
        available,
        ready,
        configured,
        installed,
        installable: definition.installable,
        message: message.into(),
        capabilities: definition.capabilities.iter().map(|value| value.to_string()).collect(),
    }
}

fn inspect_collector_provider(root: &Path, provider: &str) -> Result<CollectorHealthResult, String> {
    let definition =
        collector_definition(provider).ok_or_else(|| format!("Unknown collector provider: {provider}"))?;

    let result = match provider {
        "scrapling" => {
            let installed = python_module_installed(root, "scrapling");
            if installed {
                build_health_result(definition, true, true, true, true, "scrapling ready")
            } else {
                build_health_result(
                    definition,
                    false,
                    false,
                    true,
                    false,
                    "scrapling runtime not installed",
                )
            }
        }
        "crawl4ai" => {
            let installed = python_module_installed(root, "crawl4ai");
            if installed {
                build_health_result(definition, true, true, true, true, "crawl4ai ready")
            } else {
                build_health_result(
                    definition,
                    false,
                    false,
                    true,
                    false,
                    "crawl4ai runtime not installed",
                )
            }
        }
        "steel" => {
            let configured = env_configured(&["STEEL_API_KEY", "STEEL_BROWSER_API_KEY", "STEEL_CDP_URL"]);
            if configured {
                build_health_result(definition, true, true, true, true, "steel ready")
            } else {
                build_health_result(
                    definition,
                    false,
                    false,
                    false,
                    false,
                    "steel CDP endpoint is not configured",
                )
            }
        }
        "playwright_local" => {
            let installed = node_cli_available(root, &["--filter", "desktop", "exec", "playwright", "--version"]);
            if installed {
                build_health_result(definition, true, true, true, true, "playwright local ready")
            } else {
                build_health_result(
                    definition,
                    false,
                    false,
                    true,
                    false,
                    "playwright local runtime not installed",
                )
            }
        }
        "browser_use" => {
            let installed = python_module_installed(root, "browser_use");
            if installed {
                build_health_result(definition, true, true, true, true, "browser_use ready")
            } else {
                build_health_result(
                    definition,
                    false,
                    false,
                    true,
                    false,
                    "browser_use runtime not installed",
                )
            }
        }
        "scrapy_playwright" => {
            let installed =
                python_module_installed(root, "scrapy") && python_module_installed(root, "scrapy_playwright");
            if installed {
                build_health_result(definition, true, true, true, true, "scrapy_playwright ready")
            } else {
                build_health_result(
                    definition,
                    false,
                    false,
                    true,
                    false,
                    "scrapy_playwright runtime not installed",
                )
            }
        }
        "lightpanda_experimental" => {
            let installed = command_available("lightpanda");
            if installed {
                build_health_result(definition, true, true, true, true, "lightpanda ready")
            } else {
                build_health_result(
                    definition,
                    false,
                    false,
                    false,
                    false,
                    "lightpanda experimental runtime is not installed",
                )
            }
        }
        _ => unreachable!(),
    };

    Ok(result)
}

fn install_collector_provider(root: &Path, provider: &str) -> Result<CollectorInstallResult, String> {
    let definition =
        collector_definition(provider).ok_or_else(|| format!("Unknown collector provider: {provider}"))?;

    if !definition.installable {
        return Ok(CollectorInstallResult {
            provider: provider.to_string(),
            installed: false,
            message: format!("{provider} does not support automatic install"),
        });
    }

    let success = match provider {
        "scrapling" => run_status("uv", &["add", "scrapling", "--project", "."], root),
        "crawl4ai" => run_status("uv", &["add", "crawl4ai", "--project", "."], root),
        "playwright_local" => run_status("pnpm", &["--filter", "desktop", "add", "-D", "playwright"], root),
        "browser_use" => run_status("uv", &["add", "browser-use", "--project", "."], root),
        "scrapy_playwright" => run_status(
            "uv",
            &["add", "scrapy", "scrapy-playwright", "--project", "."],
            root,
        ),
        _ => false,
    };

    if success {
        Ok(CollectorInstallResult {
            provider: provider.to_string(),
            installed: true,
            message: format!("{provider} installed"),
        })
    } else {
        Err(format!("Failed to install {provider}"))
    }
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

#[tauri::command]
fn dashboard_crawl_provider_health(
    app: AppHandle,
    cwd: Option<String>,
    provider: String,
) -> Result<CollectorHealthResult, String> {
    let root = collector_root(&app, cwd);
    inspect_collector_provider(&root, provider.trim())
}

#[tauri::command]
fn dashboard_crawl_provider_install(
    app: AppHandle,
    cwd: Option<String>,
    provider: String,
) -> Result<CollectorInstallResult, String> {
    let root = collector_root(&app, cwd);
    install_collector_provider(&root, provider.trim())
}

fn main() {
    tauri::Builder::default()
        .manage(ApiProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            dashboard_crawl_provider_health,
            dashboard_crawl_provider_install
        ])
        .setup(|app| {
            apply_dev_app_icon(app.handle());

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
