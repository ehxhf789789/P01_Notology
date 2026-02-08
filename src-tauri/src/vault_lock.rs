//! Vault Lock System for Synology Drive environments
//!
//! Provides exclusive access to a vault across multiple devices synchronized via Synology Drive.
//! Uses a heartbeat-based lock file to ensure only one Notology instance can access a vault at a time.
//!
//! Key features:
//! - Machine ID based identification
//! - Heartbeat mechanism (30 sec interval) for detecting stale locks
//! - Graceful handling of sync delays (2 min stale threshold)
//! - Conflict-style backup when force-unlocking

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;

/// Lock file information stored in .notology/vault.lock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultLockInfo {
    /// Unique machine identifier (OS-specific)
    pub machine_id: String,
    /// Human-readable hostname
    pub hostname: String,
    /// Process ID of the locking process
    pub pid: u32,
    /// Application version
    pub app_version: String,
    /// When the lock was first acquired
    pub locked_at: DateTime<Utc>,
    /// Last heartbeat timestamp (updated every 30 seconds)
    pub heartbeat: DateTime<Utc>,
}

/// Result of attempting to acquire a vault lock
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum LockAcquireResult {
    /// Lock acquired successfully
    Success,
    /// Lock already held by this process (reconnection)
    AlreadyHeld,
    /// Lock held by another device/process
    Denied {
        holder: VaultLockInfo,
        is_stale: bool,
    },
    /// Error during lock acquisition
    Error { message: String },
}

/// Stale threshold in seconds (120 seconds for NAS/cloud sync environments like Synology Drive)
/// Higher threshold prevents false stale detection during sync delays
const STALE_THRESHOLD_SECS: i64 = 120;

/// Heartbeat interval in seconds (15 seconds for more responsive lock validation)
const HEARTBEAT_INTERVAL_SECS: u64 = 15;

/// Get the path to the lock file for a vault
fn lock_file_path(vault_path: &Path) -> PathBuf {
    vault_path.join(".notology").join("vault.lock")
}

/// Read lock file from disk
fn read_lock_file(lock_path: &Path) -> Result<VaultLockInfo, String> {
    let content =
        fs::read_to_string(lock_path).map_err(|e| format!("Failed to read lock file: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse lock file: {}", e))
}

/// Write lock file atomically (write to temp, then rename)
fn write_lock_file_atomic(lock_path: &Path, info: &VaultLockInfo) -> Result<(), String> {
    let content =
        serde_json::to_string_pretty(info).map_err(|e| format!("Failed to serialize lock: {}", e))?;

    // Write to temporary file first
    let temp_path = lock_path.with_extension("lock.tmp");
    let mut file =
        fs::File::create(&temp_path).map_err(|e| format!("Failed to create temp lock file: {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write temp lock file: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync temp lock file: {}", e))?;
    drop(file);

    // Atomic rename
    fs::rename(&temp_path, lock_path).map_err(|e| format!("Failed to rename lock file: {}", e))?;

    Ok(())
}

/// Backup the lock file with Synology conflict style naming
fn backup_lock_file(lock_path: &Path, old_info: &VaultLockInfo) {
    let timestamp = Utc::now().format("%Y-%m-%d %H-%M-%S");
    let backup_name = format!(
        "vault.lock (Notology Conflict {} from {}).json",
        timestamp, old_info.hostname
    );
    let backup_path = lock_path.parent().unwrap().join(backup_name);

    if let Err(e) = fs::copy(lock_path, &backup_path) {
        log::warn!("Failed to backup old lock file: {}", e);
    } else {
        log::info!("Old lock file backed up to {:?}", backup_path);
    }
}

/// Cached machine ID (computed once per process lifetime)
static CACHED_MACHINE_ID: Lazy<String> = Lazy::new(|| {
    #[cfg(target_os = "windows")]
    { get_windows_machine_id() }
    #[cfg(target_os = "macos")]
    { get_macos_machine_id() }
    #[cfg(target_os = "linux")]
    { get_linux_machine_id() }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { get_hostname() }
});

/// Get a unique machine identifier (cached after first call)
pub fn get_machine_id() -> String {
    CACHED_MACHINE_ID.clone()
}

#[cfg(target_os = "windows")]
fn get_windows_machine_id() -> String {
    use std::process::Command;
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("reg")
        .args([
            "query",
            r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography",
            "/v",
            "MachineGuid",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains("MachineGuid") {
                if let Some(guid) = line.split_whitespace().last() {
                    return guid.to_string();
                }
            }
        }
    }

    get_hostname()
}

#[cfg(target_os = "macos")]
fn get_macos_machine_id() -> String {
    use std::process::Command;

    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains("IOPlatformUUID") {
                if let Some(start) = line.rfind('"') {
                    let end_part = &line[..start];
                    if let Some(uuid_start) = end_part.rfind('"') {
                        return end_part[uuid_start + 1..].to_string();
                    }
                }
            }
        }
    }

    get_hostname()
}

#[cfg(target_os = "linux")]
fn get_linux_machine_id() -> String {
    if let Ok(id) = fs::read_to_string("/etc/machine-id") {
        return id.trim().to_string();
    }

    if let Ok(id) = fs::read_to_string("/var/lib/dbus/machine-id") {
        return id.trim().to_string();
    }

    get_hostname()
}

/// Get the hostname
pub fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

// ============================================================================
// Global vault lock state management
// ============================================================================

use once_cell::sync::Lazy;
use std::collections::HashMap;

/// Active lock state for a vault
struct ActiveLock {
    info: VaultLockInfo,
    heartbeat_running: Arc<AtomicBool>,
    heartbeat_handle: Option<JoinHandle<()>>,
}

/// Global registry of active locks
static ACTIVE_LOCKS: Lazy<RwLock<HashMap<String, ActiveLock>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// Acquire vault lock for the given path
pub async fn acquire_vault_lock(vault_path: &str, force: bool) -> LockAcquireResult {
    log::info!("[vault_lock] Attempting to acquire lock for: {}", vault_path);
    let path = PathBuf::from(vault_path);
    let path_key = path.to_string_lossy().to_string();
    let lock_path = lock_file_path(&path);

    // Ensure .notology directory exists
    if let Some(parent) = lock_path.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return LockAcquireResult::Error {
                    message: format!("Failed to create .notology directory: {}", e),
                };
            }
        }
    }

    let my_machine_id = get_machine_id();
    let my_pid = std::process::id();

    // Check if we already hold a lock for this vault in this process
    {
        let locks = ACTIVE_LOCKS.read().await;
        if let Some(active) = locks.get(&path_key) {
            if active.info.machine_id == my_machine_id && active.info.pid == my_pid {
                log::info!("Already holding lock for this vault");
                return LockAcquireResult::AlreadyHeld;
            }
        }
    }

    // Check for existing lock file
    if lock_path.exists() {
        match read_lock_file(&lock_path) {
            Ok(existing_lock) => {
                let now = Utc::now();
                let heartbeat_age = now.signed_duration_since(existing_lock.heartbeat);
                let is_stale = heartbeat_age.num_seconds() > STALE_THRESHOLD_SECS;

                // Check if it's our own lock (reconnection after crash)
                if existing_lock.machine_id == my_machine_id && existing_lock.pid == my_pid {
                    log::info!("Reconnecting to existing lock (same process)");
                    // Continue to acquire - will update the lock
                } else if !is_stale && !force {
                    log::warn!(
                        "Vault locked by {} ({}) - heartbeat age: {}s",
                        existing_lock.hostname,
                        existing_lock.machine_id,
                        heartbeat_age.num_seconds()
                    );
                    return LockAcquireResult::Denied {
                        holder: existing_lock,
                        is_stale: false,
                    };
                } else if is_stale && !force {
                    log::warn!(
                        "Stale lock detected from {} - heartbeat age: {}s",
                        existing_lock.hostname,
                        heartbeat_age.num_seconds()
                    );
                    return LockAcquireResult::Denied {
                        holder: existing_lock,
                        is_stale: true,
                    };
                } else if force {
                    backup_lock_file(&lock_path, &existing_lock);
                    log::info!("Force acquiring lock from {}", existing_lock.hostname);
                }
            }
            Err(e) => {
                log::warn!("Failed to read existing lock file, will overwrite: {}", e);
            }
        }
    }

    // Create new lock
    let new_lock = VaultLockInfo {
        machine_id: my_machine_id,
        hostname: get_hostname(),
        pid: my_pid,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        locked_at: Utc::now(),
        heartbeat: Utc::now(),
    };

    match write_lock_file_atomic(&lock_path, &new_lock) {
        Ok(_) => {
            log::info!("Vault lock acquired successfully");

            // Start heartbeat task
            let heartbeat_running = Arc::new(AtomicBool::new(true));
            let running_clone = Arc::clone(&heartbeat_running);
            let lock_path_clone = lock_path.clone();
            let lock_info_clone = new_lock.clone();

            let handle = tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(HEARTBEAT_INTERVAL_SECS));

                while running_clone.load(Ordering::SeqCst) {
                    interval.tick().await;

                    if !running_clone.load(Ordering::SeqCst) {
                        break;
                    }

                    let mut updated_info = lock_info_clone.clone();
                    updated_info.heartbeat = Utc::now();

                    if let Err(e) = write_lock_file_atomic(&lock_path_clone, &updated_info) {
                        log::error!("Failed to update heartbeat: {}", e);
                    } else {
                        log::debug!("Heartbeat updated");
                    }
                }

                log::debug!("Heartbeat task stopped");
            });

            // Store active lock
            {
                let mut locks = ACTIVE_LOCKS.write().await;
                locks.insert(
                    path_key,
                    ActiveLock {
                        info: new_lock,
                        heartbeat_running,
                        heartbeat_handle: Some(handle),
                    },
                );
            }

            LockAcquireResult::Success
        }
        Err(e) => LockAcquireResult::Error {
            message: format!("Failed to write lock file: {}", e),
        },
    }
}

/// Release vault lock for the given path
pub async fn release_vault_lock(vault_path: &str) -> Result<(), String> {
    let path = PathBuf::from(vault_path);
    let path_key = path.to_string_lossy().to_string();
    let lock_path = lock_file_path(&path);

    // Remove from active locks and stop heartbeat
    {
        let mut locks = ACTIVE_LOCKS.write().await;
        if let Some(mut active) = locks.remove(&path_key) {
            active.heartbeat_running.store(false, Ordering::SeqCst);
            if let Some(handle) = active.heartbeat_handle.take() {
                handle.abort();
            }
        }
    }

    // Remove lock file if it's ours
    if lock_path.exists() {
        let my_machine_id = get_machine_id();
        let my_pid = std::process::id();

        if let Ok(existing) = read_lock_file(&lock_path) {
            if existing.machine_id != my_machine_id || existing.pid != my_pid {
                log::warn!("Lock file belongs to another process, not removing");
                return Ok(());
            }
        }

        fs::remove_file(&lock_path).map_err(|e| format!("Failed to remove lock file: {}", e))?;
        log::info!("Vault lock released");
    }

    Ok(())
}

/// Check vault lock status for the given path
pub async fn check_vault_lock_status(vault_path: &str) -> Option<(VaultLockInfo, bool)> {
    let path = PathBuf::from(vault_path);
    let lock_path = lock_file_path(&path);

    if !lock_path.exists() {
        return None;
    }

    match read_lock_file(&lock_path) {
        Ok(lock_info) => {
            let now = Utc::now();
            let heartbeat_age = now.signed_duration_since(lock_info.heartbeat);
            let is_stale = heartbeat_age.num_seconds() > STALE_THRESHOLD_SECS;
            Some((lock_info, is_stale))
        }
        Err(_) => None,
    }
}

/// Release all locks held by this process (called on app shutdown)
pub async fn release_all_locks() {
    let paths: Vec<String> = {
        let locks = ACTIVE_LOCKS.read().await;
        locks.keys().cloned().collect()
    };

    for path in paths {
        if let Err(e) = release_vault_lock(&path).await {
            log::error!("Failed to release lock for {}: {}", path, e);
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockStatusResponse {
    pub is_locked: bool,
    pub holder: Option<VaultLockInfo>,
    pub is_stale: bool,
    pub is_mine: bool,
}

/// Check if a vault is locked and by whom
// UNUSED: Not invoked from frontend
#[tauri::command]
pub async fn check_vault_lock(vault_path: String) -> Result<LockStatusResponse, String> {
    let my_machine_id = get_machine_id();
    let my_pid = std::process::id();

    match check_vault_lock_status(&vault_path).await {
        Some((info, is_stale)) => {
            let is_mine = info.machine_id == my_machine_id && info.pid == my_pid;
            Ok(LockStatusResponse {
                is_locked: true,
                holder: Some(info),
                is_stale,
                is_mine,
            })
        }
        None => Ok(LockStatusResponse {
            is_locked: false,
            holder: None,
            is_stale: false,
            is_mine: false,
        }),
    }
}

/// Attempt to acquire a vault lock
#[tauri::command]
pub async fn acquire_lock(vault_path: String, force: bool) -> Result<LockAcquireResult, String> {
    Ok(acquire_vault_lock(&vault_path, force).await)
}

/// Release a vault lock
#[tauri::command]
pub async fn release_lock(vault_path: String) -> Result<(), String> {
    release_vault_lock(&vault_path).await
}

/// Get information about the current machine
// UNUSED: Not invoked from frontend
#[tauri::command]
pub fn get_machine_info() -> (String, String, u32) {
    (get_machine_id(), get_hostname(), std::process::id())
}
