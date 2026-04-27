#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
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
        eprintln!(
            "PATHWAY dev icon skipped: failed to decode {}",
            icon_path.display()
        );
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
struct CodexLoginProcess(Mutex<Option<Child>>);
struct LocalApiToken(String);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineLifecycleResult {
    state: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthProbeResult {
    state: String,
    source_method: String,
    auth_mode: String,
    raw: serde_json::Value,
    detail: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginChatgptResult {
    auth_url: String,
    device_code: Option<String>,
    raw: serde_json::Value,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UsageCheckResult {
    source_method: String,
    raw: serde_json::Value,
}

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

#[derive(Clone, Deserialize, Serialize)]
struct CollectorFetchResult {
    provider: String,
    status: String,
    url: String,
    fetched_at: String,
    summary: String,
    content: String,
    markdown_path: Option<String>,
    json_path: Option<String>,
    source_meta: serde_json::Value,
    error: Option<String>,
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
        capabilities: &[
            "extract_document",
            "interactive_browser",
            "stateful_session",
        ],
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
    if let Some(root) = repo_root_from_runtime_paths() {
        return root;
    }

    app.path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn api_entry(root: &Path) -> PathBuf {
    root.join("apps/api/lifemap_api/main.py")
}

fn find_repo_root_from(start: &Path) -> Option<PathBuf> {
    for candidate in start.ancestors() {
        if api_entry(candidate).exists() {
            return Some(candidate.to_path_buf());
        }
    }
    None
}

fn repo_root_from_runtime_paths() -> Option<PathBuf> {
    if let Ok(current_dir) = std::env::current_dir() {
        if let Some(root) = find_repo_root_from(&current_dir) {
            return Some(root);
        }
    }

    let current_exe = std::env::current_exe().ok()?;
    if let Some(root) = find_repo_root_from(&current_exe) {
        return Some(root);
    }

    let macos_dir = current_exe.parent()?;
    let contents_dir = macos_dir.parent()?;
    let resources_dir = contents_dir.join("Resources");
    if api_entry(&resources_dir).exists() {
        return Some(resources_dir);
    }

    None
}

fn collector_definition(provider: &str) -> Option<&'static CollectorDefinition> {
    COLLECTOR_DEFINITIONS
        .iter()
        .find(|definition| definition.id == provider)
}

fn collector_root(app: &AppHandle, cwd: Option<String>) -> PathBuf {
    let fallback = repo_root(app);
    let requested = cwd
        .map(PathBuf::from)
        .and_then(|path| {
            if path.is_absolute() {
                Some(path)
            } else {
                std::env::current_dir()
                    .ok()
                    .map(|current| current.join(path))
            }
        })
        .and_then(|path| path.canonicalize().ok())
        .filter(|path| path.exists() && path.is_dir())
        .filter(|path| api_entry(path).exists() || path.join("pyproject.toml").exists());
    requested.unwrap_or(fallback)
}

fn common_command_dirs() -> &'static [&'static str] {
    &[
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/opt/homebrew/sbin",
        "/usr/local/sbin",
    ]
}

fn local_user_command_dirs() -> Vec<PathBuf> {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return Vec::new();
    };

    let mut dirs = vec![
        home.join(".local/bin"),
        home.join(".cargo/bin"),
        home.join(".npm-global/bin"),
    ];

    let node_versions = home.join(".nvm/versions/node");
    if let Ok(entries) = std::fs::read_dir(node_versions) {
        let mut node_bins = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path().join("bin"))
            .filter(|path| path.exists())
            .collect::<Vec<_>>();
        node_bins.sort_by(|left, right| right.cmp(left));
        dirs.extend(node_bins);
    }

    dirs
}

fn augmented_path_entries() -> Vec<PathBuf> {
    let mut entries: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|value| std::env::split_paths(&value).collect())
        .unwrap_or_default();

    for dir in local_user_command_dirs() {
        if dir.exists() && !entries.iter().any(|entry| entry == &dir) {
            entries.push(dir);
        }
    }

    for dir in common_command_dirs() {
        let path = PathBuf::from(*dir);
        if path.exists() && !entries.iter().any(|entry| entry == &path) {
            entries.push(path);
        }
    }

    entries
}

fn augmented_path_env() -> String {
    let entries = augmented_path_entries();
    std::env::join_paths(entries.iter())
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|_| {
            entries
                .iter()
                .map(|entry| entry.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(":")
        })
}

fn resolve_command_path(name: &str) -> Option<PathBuf> {
    let requested = PathBuf::from(name);
    if requested.is_absolute() && requested.exists() {
        return Some(requested);
    }

    for dir in augmented_path_entries() {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn command_available(name: &str) -> bool {
    resolve_command_path(name).is_some()
}

fn strip_ansi(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next();
            for code_ch in chars.by_ref() {
                if code_ch.is_ascii_alphabetic() {
                    break;
                }
            }
            continue;
        }
        output.push(ch);
    }

    output
}

fn run_codex_command(args: &[&str], cwd: Option<&Path>) -> Result<(bool, String), String> {
    let codex_path = resolve_command_path("codex")
        .ok_or_else(|| "codex CLI was not found on PATH".to_string())?;
    let mut command = Command::new(codex_path);
    command
        .args(args)
        .env("PATH", augmented_path_env())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    let output = command
        .output()
        .map_err(|error| format!("Failed to run codex: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let raw = strip_ansi(&format!("{stdout}{stderr}")).trim().to_string();
    Ok((output.status.success(), raw))
}

fn parse_codex_auth_state(raw: &str) -> (String, String) {
    let normalized = raw.to_lowercase();
    if normalized.contains("not logged in")
        || normalized.contains("login required")
        || normalized.contains("not authenticated")
    {
        return ("login_required".to_string(), "unknown".to_string());
    }
    if normalized.contains("logged in") {
        let auth_mode = if normalized.contains("api key") {
            "apikey"
        } else if normalized.contains("chatgpt") {
            "chatgpt"
        } else {
            "unknown"
        };
        return ("authenticated".to_string(), auth_mode.to_string());
    }
    ("unknown".to_string(), "unknown".to_string())
}

fn sanitized_codex_status_value(state: &str, auth_mode: &str) -> serde_json::Value {
    serde_json::json!({
        "state": state,
        "authMode": auth_mode,
    })
}

fn sanitized_codex_login_value(auth_url: &str, device_code: Option<&str>) -> serde_json::Value {
    serde_json::json!({
        "authUrlPresent": !auth_url.trim().is_empty(),
        "deviceCodePresent": device_code.is_some_and(|value| !value.trim().is_empty()),
    })
}

fn build_local_api_token() -> String {
    if let Ok(token) = std::env::var("LIFEMAP_LOCAL_API_TOKEN") {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("pathway-local-{}-{nanos}", std::process::id())
}

fn parse_codex_device_login(raw: &str) -> (Option<String>, Option<String>) {
    let mut auth_url = None;
    let mut device_code = None;
    let mut previous_line_mentions_code = false;

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
            auth_url = Some(trimmed.to_string());
        }
        if previous_line_mentions_code && !trimmed.is_empty() && !trimmed.contains(' ') {
            device_code = Some(trimmed.to_string());
        }
        previous_line_mentions_code = trimmed.to_lowercase().contains("one-time code");
    }

    (auth_url, device_code)
}

fn start_codex_device_login(
    state: tauri::State<'_, CodexLoginProcess>,
    cwd: Option<&Path>,
) -> Result<LoginChatgptResult, String> {
    let codex_path = resolve_command_path("codex")
        .ok_or_else(|| "codex CLI was not found on PATH".to_string())?;

    {
        let mut guard = state.0.lock().expect("codex login mutex poisoned");
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    let mut command = Command::new(codex_path);
    command
        .arg("login")
        .arg("--device-auth")
        .env("PATH", augmented_path_env())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start codex login: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to read codex login output".to_string())?;
    let mut reader = BufReader::new(stdout);
    let started = Instant::now();
    let mut raw = String::new();
    let mut auth_url = None;
    let mut device_code = None;

    while started.elapsed() < Duration::from_secs(8) {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => {
                if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
                    let clean_raw = strip_ansi(&raw);
                    return Err(format!(
                        "codex login exited before returning a device code (status: {status}; output: {clean_raw})"
                    ));
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Ok(_) => {
                raw.push_str(&line);
                let clean_raw = strip_ansi(&raw);
                let parsed = parse_codex_device_login(&clean_raw);
                auth_url = parsed.0;
                device_code = parsed.1;
                if auth_url.is_some() && device_code.is_some() {
                    break;
                }
            }
            Err(error) => return Err(format!("Failed to read codex login output: {error}")),
        }
    }

    let clean_raw = strip_ansi(&raw);
    let Some(auth_url) = auth_url else {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!(
            "codex login did not return an auth URL: {clean_raw}"
        ));
    };

    let mut guard = state.0.lock().expect("codex login mutex poisoned");
    *guard = Some(child);

    Ok(LoginChatgptResult {
        raw: sanitized_codex_login_value(&auth_url, device_code.as_deref()),
        auth_url,
        device_code,
    })
}

fn run_status(command: &str, args: &[&str], cwd: &Path) -> bool {
    let Some(command_path) = resolve_command_path(command) else {
        return false;
    };

    let mut child = Command::new(command_path);
    child
        .args(args)
        .current_dir(cwd)
        .env("PATH", augmented_path_env())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if command == "uv" {
        child.env("UV_CACHE_DIR", cwd.join(".uv-cache"));
    }
    child
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
        capabilities: definition
            .capabilities
            .iter()
            .map(|value| value.to_string())
            .collect(),
    }
}

fn inspect_collector_provider(
    root: &Path,
    provider: &str,
) -> Result<CollectorHealthResult, String> {
    let definition = collector_definition(provider)
        .ok_or_else(|| format!("Unknown collector provider: {provider}"))?;

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
            let configured =
                env_configured(&["STEEL_API_KEY", "STEEL_BROWSER_API_KEY", "STEEL_CDP_URL"]);
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
            let installed = node_cli_available(
                root,
                &["--filter", "desktop", "exec", "playwright", "--version"],
            );
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
            let installed = python_module_installed(root, "scrapy")
                && python_module_installed(root, "scrapy_playwright");
            if installed {
                build_health_result(
                    definition,
                    true,
                    true,
                    true,
                    true,
                    "scrapy_playwright ready",
                )
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

fn install_collector_provider(
    root: &Path,
    provider: &str,
) -> Result<CollectorInstallResult, String> {
    let definition = collector_definition(provider)
        .ok_or_else(|| format!("Unknown collector provider: {provider}"))?;

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
        "playwright_local" => run_status(
            "pnpm",
            &["--filter", "desktop", "add", "-D", "playwright"],
            root,
        ),
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

const COLLECTOR_FETCH_SCRIPT: &str = r##"
from __future__ import annotations

import asyncio
import datetime as dt
import hashlib
import ipaddress
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request
from urllib import robotparser
from urllib.parse import parse_qs, unquote, urlparse

USER_AGENT = "PathwayBot/0.1 (+local-first research workspace)"
API_BASE_URL = "http://127.0.0.1:8000"


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False))


def fail(provider, url, message):
    emit({
        "provider": provider,
        "status": "error",
        "url": url,
        "fetched_at": dt.datetime.now(dt.UTC).isoformat(),
        "summary": "",
        "content": "",
        "markdown_path": None,
        "json_path": None,
        "source_meta": {},
        "error": message,
    })
    return 0


def normalize_text(value):
    return "\n".join(line.strip() for line in str(value or "").splitlines() if line.strip()).strip()


def compact_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def validate_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https URLs are allowed.")
    if not parsed.hostname:
        raise ValueError("URL is missing a hostname.")
    host = parsed.hostname.lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Localhost URLs are blocked.")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise ValueError("Private-network URLs are blocked.")
    except ValueError as error:
        if "blocked" in str(error):
            raise


def check_robots(url):
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = robotparser.RobotFileParser()
    parser.set_url(robots_url)
    try:
        request = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=8) as response:
            parser.parse(response.read().decode("utf-8", errors="ignore").splitlines())
        if not parser.can_fetch(USER_AGENT, url):
            raise ValueError("robots.txt disallows this URL for PathwayBot.")
        return "robots.txt allows fetch."
    except ValueError:
        raise
    except Exception:
        return "robots.txt unavailable; proceeding with explicit one-off fetch."


def title_from_html(html, fallback):
    match = re.search(r"<title[^>]*>(.*?)</title>", html or "", flags=re.I | re.S)
    if not match:
        return fallback
    return compact_text(re.sub(r"<[^>]+>", " ", match.group(1))) or fallback


def extract_with_trafilatura(url, html):
    import trafilatura
    from bs4 import BeautifulSoup

    extracted = trafilatura.extract(
        html,
        url=url,
        output_format="txt",
        include_links=False,
        include_images=False,
        include_tables=False,
        favor_recall=True,
    )
    if extracted:
        metadata = trafilatura.extract_metadata(html, default_url=url)
        title = metadata.title.strip() if metadata and metadata.title else title_from_html(html, urlparse(url).netloc)
        return normalize_text(extracted), title

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return normalize_text(soup.get_text("\n")), title_from_html(html, urlparse(url).netloc)


def fetch_with_httpx(url):
    import httpx

    response = httpx.get(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        follow_redirects=True,
        timeout=30.0,
    )
    response.raise_for_status()
    final_url = str(response.url)
    content_type = response.headers.get("content-type", "").lower()
    if "text/plain" in content_type:
        return normalize_text(response.text), title_from_html("", urlparse(final_url).netloc), final_url
    content, title = extract_with_trafilatura(final_url, response.text)
    return content, title, final_url


def is_duckduckgo_search_probe(url):
    parsed = urlparse(url)
    return parsed.netloc.lower().endswith("duckduckgo.com") and parsed.path.startswith("/html")


def extract_duckduckgo_result_urls(search_url):
    import httpx
    from bs4 import BeautifulSoup

    response = httpx.get(
        search_url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        follow_redirects=True,
        timeout=30.0,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    urls = []
    seen = set()
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href") or "").strip()
        parsed = urlparse(href)
        candidate = None
        if parsed.netloc.lower().endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
            uddg = parse_qs(parsed.query).get("uddg", [""])[0]
            candidate = unquote(uddg)
        elif href.startswith("/l/"):
            uddg = parse_qs(urlparse(f"https://duckduckgo.com{href}").query).get("uddg", [""])[0]
            candidate = unquote(uddg)
        elif parsed.scheme in {"http", "https"} and not parsed.netloc.lower().endswith("duckduckgo.com"):
            candidate = href
        if not candidate or candidate in seen:
            continue
        try:
            validate_url(candidate)
        except Exception:
            continue
        seen.add(candidate)
        urls.append(candidate)
    return urls


def fetch_search_probe_with_provider(provider, search_url):
    candidates = extract_duckduckgo_result_urls(search_url)
    if not candidates:
        raise ValueError("Search probe returned no safe result URLs.")
    errors = []
    for candidate_url in candidates[:5]:
        try:
            robots_status = check_robots(candidate_url)
            content, title, final_url = fetch_with_provider(provider, candidate_url)
            return content, title, final_url, f"search probe resolved via {candidate_url}; {robots_status}"
        except Exception as error:
            errors.append(f"{candidate_url}: {error}")
    raise ValueError("Search probe result fetch failed: " + " | ".join(errors[:3]))


async def fetch_with_crawl4ai(url):
    from crawl4ai import AsyncWebCrawler
    try:
        from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig
        browser_config = BrowserConfig(headless=True, user_agent=USER_AGENT)
        run_config = CrawlerRunConfig(check_robots_txt=True)
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=url, config=run_config)
    except Exception:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url)
    markdown = getattr(result, "markdown", None) or getattr(result, "cleaned_html", None) or getattr(result, "html", "")
    final_url = str(getattr(result, "url", "") or url)
    title = urlparse(final_url).netloc
    metadata = getattr(result, "metadata", None)
    if isinstance(metadata, dict):
        title = compact_text(metadata.get("title")) or title
    return normalize_text(markdown), title, final_url


def fetch_with_scrapling(url):
    from scrapling.fetchers import Fetcher

    page = Fetcher.get(url, headers={"User-Agent": USER_AGENT})
    final_url = str(getattr(page, "url", "") or url)
    html = str(getattr(page, "html", "") or page)
    content, title = extract_with_trafilatura(final_url, html)
    return content, title, final_url


def fetch_with_lightpanda(url):
    command = [
        "lightpanda",
        "fetch",
        "--dump",
        "markdown",
        "--strip-mode",
        "js,css",
        url,
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=35)
    lines = [line for line in result.stdout.splitlines() if not line.startswith("info(")]
    content = normalize_text("\n".join(lines))
    return content, urlparse(url).netloc, url


def fetch_with_provider(provider, url):
    if provider == "crawl4ai":
        return asyncio.run(fetch_with_crawl4ai(url))
    if provider == "scrapling":
        return fetch_with_scrapling(url)
    if provider == "lightpanda_experimental":
        return fetch_with_lightpanda(url)
    if provider in {"playwright_local", "browser_use", "scrapy_playwright", "steel"}:
        raise ValueError(f"{provider} fetch is not implemented in the local source bridge yet.")
    return fetch_with_httpx(url)


def write_artifacts(root, provider, url, title, content, payload):
    digest = hashlib.sha256(f"{provider}:{url}".encode("utf-8")).hexdigest()[:16]
    artifact_dir = pathlib.Path(root) / "data" / "collector_artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = artifact_dir / f"{digest}.md"
    json_path = artifact_dir / f"{digest}.json"
    markdown_path.write_text(f"# {title}\n\nSource: {url}\nProvider: {provider}\n\n{content}\n", encoding="utf-8")
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return str(markdown_path), str(json_path)


def upsert_source(provider, topic, url, title, content, robots_status):
    import httpx

    metadata = {
        "collector_used": provider,
        "collector_topic": topic,
        "layer": topic,
        "fetched_at": dt.datetime.now(dt.UTC).isoformat(),
        "robots_status": robots_status,
        "ingested_by": "dashboard_crawl_provider_fetch_url",
    }
    headers = {}
    local_api_token = os.environ.get("LIFEMAP_LOCAL_API_TOKEN", "").strip()
    if local_api_token:
        headers["Authorization"] = f"Bearer {local_api_token}"
    response = httpx.post(
        f"{API_BASE_URL}/sources/manual",
        headers=headers,
        json={
            "title": title[:200] or urlparse(url).netloc,
            "content_text": content,
            "url": url,
            "source_type": "public_url_allowed",
            "metadata": metadata,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


def should_store_metadata_only(message):
    lowered = str(message or "").lower()
    return any(
        token in lowered
        for token in [
            "robots.txt disallows",
            "401",
            "403",
            "forbidden",
            "unauthorized",
            "captcha",
            "login",
            "paywall",
            "search probe returned no safe result urls",
        ]
    )


def upsert_metadata_source(provider, topic, url, reason):
    import httpx

    parsed = urlparse(url)
    title = parsed.netloc or url
    content = normalize_text(
        f"""
        Metadata-only public source candidate.
        URL: {url}
        Collection policy: full-text fetch was not performed.
        Reason: {reason}
        Use this record only as a discovery clue or anecdotal candidate, not as evidence for page claims.
        """
    )
    metadata = {
        "collector_used": provider,
        "collector_topic": topic,
        "layer": topic,
        "fetched_at": dt.datetime.now(dt.UTC).isoformat(),
        "ingested_by": "dashboard_crawl_provider_fetch_url",
        "policy_state": "public_url_metadata",
        "metadata_only": True,
        "metadata_only_reason": str(reason)[:800],
    }
    headers = {}
    local_api_token = os.environ.get("LIFEMAP_LOCAL_API_TOKEN", "").strip()
    if local_api_token:
        headers["Authorization"] = f"Bearer {local_api_token}"
    response = httpx.post(
        f"{API_BASE_URL}/sources/manual",
        headers=headers,
        json={
            "title": title[:200],
            "content_text": content,
            "url": url,
            "source_type": "public_url_metadata",
            "metadata": metadata,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json(), title, content


def main():
    provider = sys.argv[1].strip()
    url = sys.argv[2].strip()
    topic = sys.argv[3].strip() if len(sys.argv) > 3 else "pathway_research"
    root = os.getcwd()
    try:
        validate_url(url)
        robots_status = check_robots(url)
        try:
            if is_duckduckgo_search_probe(url):
                content, title, final_url, robots_status = fetch_search_probe_with_provider(provider, url)
            else:
                content, title, final_url = fetch_with_provider(provider, url)
            provider_used = provider
        except Exception as provider_error:
            if provider in {"crawl4ai", "scrapling", "lightpanda_experimental"} and not is_duckduckgo_search_probe(url):
                content, title, final_url = fetch_with_httpx(url)
                provider_used = f"{provider}:httpx_fallback"
                robots_status = f"{robots_status}; provider fallback: {provider_error}"
            else:
                raise
        validate_url(final_url)
        if not content:
            raise ValueError("Fetched page did not yield readable content.")
        source_payload = {}
        source_error = None
        try:
            source_payload = upsert_source(provider_used, topic, final_url, title, content, robots_status)
        except Exception as error:
            source_error = str(error)
        fetched_at = dt.datetime.now(dt.UTC).isoformat()
        meta = {
            "title": title,
            "source_id": source_payload.get("id") if isinstance(source_payload, dict) else None,
            "word_count": len(content.split()),
            "provider_used": provider_used,
            "robots_status": robots_status,
            "source_library_error": source_error,
        }
        payload = {
            "provider": provider_used,
            "status": "ok",
            "url": final_url,
            "fetched_at": fetched_at,
            "summary": compact_text(content)[:420],
            "content": content[:6000],
            "markdown_path": None,
            "json_path": None,
            "source_meta": meta,
            "error": source_error,
        }
        markdown_path, json_path = write_artifacts(root, provider_used, final_url, title, content, payload)
        payload["markdown_path"] = markdown_path
        payload["json_path"] = json_path
        emit(payload)
        return 0
    except Exception as error:
        message = str(error)
        if should_store_metadata_only(message):
            source_payload = {}
            source_error = None
            try:
                validate_url(url)
                source_payload, title, content = upsert_metadata_source(provider, topic, url, message)
            except Exception as metadata_error:
                return fail(provider, url, f"{message}; metadata-only upsert failed: {metadata_error}")
            fetched_at = dt.datetime.now(dt.UTC).isoformat()
            meta = {
                "title": title,
                "source_id": source_payload.get("id") if isinstance(source_payload, dict) else None,
                "word_count": len(content.split()),
                "provider_used": provider,
                "policy_state": "public_url_metadata",
                "metadata_only": True,
                "metadata_only_reason": message[:800],
                "source_library_error": source_error,
            }
            payload = {
                "provider": provider,
                "status": "ok",
                "url": url,
                "fetched_at": fetched_at,
                "summary": compact_text(content)[:420],
                "content": content[:6000],
                "markdown_path": None,
                "json_path": None,
                "source_meta": meta,
                "error": None,
            }
            markdown_path, json_path = write_artifacts(root, f"{provider}:metadata_only", url, title, content, payload)
            payload["markdown_path"] = markdown_path
            payload["json_path"] = json_path
            emit(payload)
            return 0
        return fail(provider, url, str(error))


raise SystemExit(main())
"##;

fn fetch_url_with_collector(
    root: &Path,
    provider: &str,
    url: &str,
    topic: &str,
    local_api_token: &str,
) -> Result<CollectorFetchResult, String> {
    let Some(uv_path) = resolve_command_path("uv") else {
        return Err("uv is required to run local collector fetches".into());
    };

    let output = Command::new(uv_path)
        .current_dir(root)
        .env("PATH", augmented_path_env())
        .env("UV_CACHE_DIR", root.join(".uv-cache"))
        .env("LIFEMAP_LOCAL_API_TOKEN", local_api_token)
        .arg("run")
        .arg("python3")
        .arg("-c")
        .arg(COLLECTOR_FETCH_SCRIPT)
        .arg(provider)
        .arg(url)
        .arg(topic)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Failed to run collector fetch: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(format!(
            "Collector fetch failed{}{}",
            if stderr.is_empty() { "" } else { ": " },
            stderr
        ));
    }

    let last_json_line = stdout
        .lines()
        .rev()
        .find(|line| line.trim_start().starts_with('{'))
        .ok_or_else(|| format!("Collector fetch returned no JSON output: {stdout}"))?;
    serde_json::from_str::<CollectorFetchResult>(last_json_line).map_err(|error| {
        format!("Collector fetch returned invalid JSON: {error}; stderr: {stderr}")
    })
}

fn can_spawn_local_api(root: &Path) -> bool {
    api_entry(root).exists()
}

fn api_is_live() -> bool {
    TcpStream::connect((API_HOST, API_PORT)).is_ok()
}

fn spawn_dev_api(
    root: &Path,
    data_root: Option<&Path>,
    local_api_token: &str,
) -> Result<Child, String> {
    let app_path = api_entry(root);
    let uv_path = resolve_command_path("uv")
        .ok_or_else(|| "uv is required to launch the local Pathway API".to_string())?;

    let mut command = Command::new(uv_path);
    command
        .current_dir(root)
        .env("PATH", augmented_path_env())
        .env("UV_CACHE_DIR", root.join(".uv-cache"))
        .env("LIFEMAP_LOCAL_API_TOKEN", local_api_token);

    if let Some(data_root) = data_root {
        let data_dir = data_root.join("data");
        command
            .env("LIFEMAP_DATA_DIR", &data_dir)
            .env(
                "LIFEMAP_SQLITE_URL",
                format!("sqlite:///{}", data_dir.join("local.db").display()),
            )
            .env("LIFEMAP_LANCEDB_URI", data_dir.join("lancedb"));
    }

    command
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

    while started.elapsed() < Duration::from_secs(45) {
        if api_is_live() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }

    false
}

#[tauri::command]
async fn engine_start(
    app: AppHandle,
    local_api_token: tauri::State<'_, LocalApiToken>,
    _cwd: Option<String>,
) -> Result<EngineLifecycleResult, String> {
    let local_api_token = local_api_token.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if api_is_live() {
            return Ok(EngineLifecycleResult {
                state: "started".to_string(),
            });
        }

        {
            let api_process = app.state::<ApiProcess>();
            let mut guard = api_process.0.lock().expect("api process mutex poisoned");
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        match start_api_if_needed(&app, &local_api_token)? {
            Some(child) => {
                let api_process = app.state::<ApiProcess>();
                let mut guard = api_process.0.lock().expect("api process mutex poisoned");
                *guard = Some(child);
            }
            None => {
                if !api_is_live() {
                    return Err(
                        "Pathway local backend is not running and could not be started automatically."
                            .to_string(),
                    );
                }
            }
        }

        Ok(EngineLifecycleResult {
            state: "started".to_string(),
        })
    })
    .await
    .map_err(|error| format!("Pathway local backend start task failed: {error}"))?
}

#[tauri::command]
async fn engine_stop(app: AppHandle) -> EngineLifecycleResult {
    tauri::async_runtime::spawn_blocking(move || {
        let api_child = {
            let api_process = app.state::<ApiProcess>();
            let mut guard = api_process.0.lock().expect("api process mutex poisoned");
            guard.take()
        };

        if let Some(mut child) = api_child {
            let _ = child.kill();
            let _ = child.wait();
        }

        let login_state = app.state::<CodexLoginProcess>();
        let mut guard = login_state.0.lock().expect("codex login mutex poisoned");
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        EngineLifecycleResult {
            state: "stopped".to_string(),
        }
    })
    .await
    .unwrap_or_else(|_| EngineLifecycleResult {
        state: "stopped".to_string(),
    })
}

#[tauri::command]
fn auth_probe() -> Result<AuthProbeResult, String> {
    let (_success, raw) = run_codex_command(&["login", "status"], None)?;
    let (state, auth_mode) = parse_codex_auth_state(&raw);
    Ok(AuthProbeResult {
        raw: sanitized_codex_status_value(&state, &auth_mode),
        state,
        source_method: "codex login status".to_string(),
        auth_mode,
        detail: None,
    })
}

#[tauri::command]
fn login_chatgpt(
    login_state: tauri::State<'_, CodexLoginProcess>,
    cwd: Option<String>,
) -> Result<LoginChatgptResult, String> {
    let cwd_path = cwd.as_deref().map(Path::new);
    start_codex_device_login(login_state, cwd_path)
}

#[tauri::command]
fn logout_codex(
    login_state: tauri::State<'_, CodexLoginProcess>,
) -> Result<AuthProbeResult, String> {
    {
        let mut guard = login_state.0.lock().expect("codex login mutex poisoned");
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    let (_success, raw) = run_codex_command(&["logout"], None)?;
    let (state, auth_mode) = parse_codex_auth_state(&raw);
    Ok(AuthProbeResult {
        raw: sanitized_codex_status_value(&state, &auth_mode),
        state: "login_required".to_string(),
        source_method: "codex logout".to_string(),
        auth_mode,
        detail: None,
    })
}

#[tauri::command]
fn usage_check() -> Result<UsageCheckResult, String> {
    let (success, raw) = run_codex_command(&["login", "status"], None)?;
    if !success {
        return Err(raw);
    }
    let (state, auth_mode) = parse_codex_auth_state(&raw);
    Ok(UsageCheckResult {
        source_method: "codex login status".to_string(),
        raw: sanitized_codex_status_value(&state, &auth_mode),
    })
}

fn start_api_if_needed(app: &AppHandle, local_api_token: &str) -> Result<Option<Child>, String> {
    if api_is_live() {
        return Ok(None);
    }

    let root = repo_root(app);
    if !can_spawn_local_api(&root) {
        return Err(format!(
            "Pathway local API entry was not found under {}.",
            root.display()
        ));
    }

    let bundled_root = app
        .path()
        .resource_dir()
        .ok()
        .and_then(|path| path.canonicalize().ok());
    let root_is_bundled = bundled_root.as_ref().is_some_and(|path| path == &root);
    let app_data_dir =
        if root_is_bundled {
            Some(app.path().app_data_dir().map_err(|error| {
                format!("Failed to resolve Pathway app data directory: {error}")
            })?)
        } else {
            None
        };

    let child = spawn_dev_api(&root, app_data_dir.as_deref(), local_api_token)?;
    if wait_for_api() {
        Ok(Some(child))
    } else {
        Err("Pathway desktop launched, but the local API did not become ready on http://127.0.0.1:8000.".into())
    }
}

fn start_api_from_runtime_root(local_api_token: &str) -> Result<Option<Child>, String> {
    if api_is_live() {
        return Ok(None);
    }

    let root = repo_root_from_runtime_paths().ok_or_else(|| {
        "Pathway local API entry was not found from the current runtime paths.".to_string()
    })?;
    if !can_spawn_local_api(&root) {
        return Err(format!(
            "Pathway local API entry was not found under {}.",
            root.display()
        ));
    }

    let child = spawn_dev_api(&root, None, local_api_token)?;
    if wait_for_api() {
        Ok(Some(child))
    } else {
        Err("Pathway desktop launched, but the local API did not become ready on http://127.0.0.1:8000.".into())
    }
}

#[tauri::command]
fn local_api_auth_token(token: tauri::State<'_, LocalApiToken>) -> String {
    token.0.clone()
}

#[tauri::command]
async fn dashboard_crawl_provider_health(
    app: AppHandle,
    cwd: Option<String>,
    provider: String,
) -> Result<CollectorHealthResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = collector_root(&app, cwd);
        inspect_collector_provider(&root, provider.trim())
    })
    .await
    .map_err(|error| format!("Collector health task failed: {error}"))?
}

#[tauri::command]
async fn dashboard_crawl_provider_install(
    app: AppHandle,
    cwd: Option<String>,
    provider: String,
) -> Result<CollectorInstallResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = collector_root(&app, cwd);
        install_collector_provider(&root, provider.trim())
    })
    .await
    .map_err(|error| format!("Collector install task failed: {error}"))?
}

#[tauri::command]
async fn dashboard_crawl_provider_fetch_url(
    app: AppHandle,
    local_api_token: tauri::State<'_, LocalApiToken>,
    cwd: Option<String>,
    provider: String,
    url: String,
    topic: Option<String>,
) -> Result<CollectorFetchResult, String> {
    let local_api_token = local_api_token.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let root = collector_root(&app, cwd);
        let provider = provider.trim().to_string();
        collector_definition(&provider)
            .ok_or_else(|| format!("Unknown collector provider: {provider}"))?;
        fetch_url_with_collector(
            &root,
            &provider,
            url.trim(),
            topic.as_deref().unwrap_or("pathway_research"),
            &local_api_token,
        )
    })
    .await
    .map_err(|error| format!("Collector fetch task failed: {error}"))?
}

fn main() {
    let local_api_token = build_local_api_token();
    let initial_api_child = match start_api_from_runtime_root(&local_api_token) {
        Ok(child) => child,
        Err(message) => {
            eprintln!("Pathway desktop startup: {message}");
            None
        }
    };
    tauri::Builder::default()
        .manage(ApiProcess(Mutex::new(initial_api_child)))
        .manage(CodexLoginProcess(Mutex::new(None)))
        .manage(LocalApiToken(local_api_token))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            engine_start,
            engine_stop,
            auth_probe,
            login_chatgpt,
            logout_codex,
            usage_check,
            local_api_auth_token,
            dashboard_crawl_provider_health,
            dashboard_crawl_provider_install,
            dashboard_crawl_provider_fetch_url
        ])
        .setup(|app| {
            apply_dev_app_icon(app.handle());

            let local_api_token = app.state::<LocalApiToken>();
            let root = repo_root(app.handle());
            eprintln!(
                "Pathway desktop setup: starting local API from {}",
                root.display()
            );
            match start_api_if_needed(app.handle(), &local_api_token.0) {
                Ok(Some(child)) => {
                    let api_process = app.state::<ApiProcess>();
                    *api_process.0.lock().expect("api process mutex poisoned") = Some(child);
                    eprintln!("Pathway desktop setup: local API started on http://127.0.0.1:8000");
                }
                Ok(None) => {
                    eprintln!("Pathway desktop setup: local API already running");
                }
                Err(message) => {
                    eprintln!("Pathway desktop setup: {message}");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                let api_process = app.state::<ApiProcess>();
                let child = {
                    let mut guard = api_process.0.lock().expect("api process mutex poisoned");
                    guard.take()
                };

                if let Some(mut child) = child {
                    let _ = child.kill();
                    let _ = child.wait();
                }

                let login_process = app.state::<CodexLoginProcess>();
                let login_child = {
                    let mut guard = login_process.0.lock().expect("codex login mutex poisoned");
                    guard.take()
                };

                if let Some(mut child) = login_child {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Pathway desktop");
}
