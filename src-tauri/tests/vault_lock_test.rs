//! Tests for the vault lock system
//!
//! Verifies that the lock mechanism works correctly for Synology Drive sync scenarios

use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tempfile::TempDir;

#[tokio::test]
async fn test_acquire_and_release_lock() {
    let temp_dir = TempDir::new().unwrap();
    let vault_path = temp_dir.path().to_str().unwrap();

    // Create .notology directory
    fs::create_dir_all(temp_dir.path().join(".notology")).unwrap();

    // Acquire lock
    let result = app_lib::vault_lock::acquire_vault_lock(vault_path, false).await;
    match &result {
        app_lib::vault_lock::LockAcquireResult::Success => {
            println!("Lock acquired successfully");
        }
        app_lib::vault_lock::LockAcquireResult::AlreadyHeld => {
            println!("Lock already held (reconnection)");
        }
        other => {
            panic!("Unexpected result: {:?}", other);
        }
    }

    // Verify lock file exists
    let lock_path = temp_dir.path().join(".notology").join("vault.lock");
    assert!(lock_path.exists(), "Lock file should exist");

    // Release lock
    app_lib::vault_lock::release_vault_lock(vault_path).await.unwrap();

    // Verify lock file is removed
    assert!(!lock_path.exists(), "Lock file should be removed after release");
}

#[tokio::test]
async fn test_lock_denied_by_another_device() {
    let temp_dir = TempDir::new().unwrap();
    let vault_path = temp_dir.path().to_str().unwrap();

    // Create .notology directory
    fs::create_dir_all(temp_dir.path().join(".notology")).unwrap();

    // Create a fake lock file from "another device"
    let lock_path = temp_dir.path().join(".notology").join("vault.lock");
    let fake_lock = serde_json::json!({
        "machine_id": "other-machine-id-12345",
        "hostname": "OTHER-DEVICE",
        "pid": 99999,
        "app_version": "1.0.0",
        "locked_at": chrono::Utc::now().to_rfc3339(),
        "heartbeat": chrono::Utc::now().to_rfc3339()
    });
    fs::write(&lock_path, serde_json::to_string_pretty(&fake_lock).unwrap()).unwrap();

    // Try to acquire lock - should be denied
    let result = app_lib::vault_lock::acquire_vault_lock(vault_path, false).await;
    match result {
        app_lib::vault_lock::LockAcquireResult::Denied { holder, is_stale } => {
            assert_eq!(holder.hostname, "OTHER-DEVICE");
            assert!(!is_stale, "Lock should not be stale (recent heartbeat)");
            println!("Lock correctly denied - held by: {}", holder.hostname);
        }
        other => {
            panic!("Expected Denied, got: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_stale_lock_detection() {
    let temp_dir = TempDir::new().unwrap();
    let vault_path = temp_dir.path().to_str().unwrap();

    // Create .notology directory
    fs::create_dir_all(temp_dir.path().join(".notology")).unwrap();

    // Create a stale lock file (heartbeat > 2 minutes ago)
    let lock_path = temp_dir.path().join(".notology").join("vault.lock");
    let old_time = chrono::Utc::now() - chrono::Duration::minutes(5);
    let stale_lock = serde_json::json!({
        "machine_id": "old-machine-id",
        "hostname": "STALE-DEVICE",
        "pid": 11111,
        "app_version": "1.0.0",
        "locked_at": old_time.to_rfc3339(),
        "heartbeat": old_time.to_rfc3339()  // 5 minutes old
    });
    fs::write(&lock_path, serde_json::to_string_pretty(&stale_lock).unwrap()).unwrap();

    // Try to acquire lock - should be denied but marked as stale
    let result = app_lib::vault_lock::acquire_vault_lock(vault_path, false).await;
    match result {
        app_lib::vault_lock::LockAcquireResult::Denied { holder, is_stale } => {
            assert!(is_stale, "Lock should be detected as stale");
            println!("Stale lock detected from: {}", holder.hostname);
        }
        other => {
            panic!("Expected Denied with stale flag, got: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_force_acquire_lock() {
    let temp_dir = TempDir::new().unwrap();
    let vault_path = temp_dir.path().to_str().unwrap();

    // Create .notology directory
    fs::create_dir_all(temp_dir.path().join(".notology")).unwrap();

    // Create a lock file from "another device"
    let lock_path = temp_dir.path().join(".notology").join("vault.lock");
    let other_lock = serde_json::json!({
        "machine_id": "other-machine",
        "hostname": "ANOTHER-PC",
        "pid": 55555,
        "app_version": "1.0.0",
        "locked_at": chrono::Utc::now().to_rfc3339(),
        "heartbeat": chrono::Utc::now().to_rfc3339()
    });
    fs::write(&lock_path, serde_json::to_string_pretty(&other_lock).unwrap()).unwrap();

    // Force acquire lock
    let result = app_lib::vault_lock::acquire_vault_lock(vault_path, true).await;
    match result {
        app_lib::vault_lock::LockAcquireResult::Success => {
            println!("Lock force acquired successfully");
        }
        other => {
            panic!("Expected Success on force acquire, got: {:?}", other);
        }
    }

    // Check that backup file was created (Synology conflict style)
    let notology_dir = temp_dir.path().join(".notology");
    let backup_files: Vec<_> = fs::read_dir(&notology_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().contains("Notology Conflict"))
        .collect();

    assert!(!backup_files.is_empty(), "Backup file should be created on force acquire");
    println!("Backup file created: {:?}", backup_files[0].file_name());

    // Clean up
    app_lib::vault_lock::release_vault_lock(vault_path).await.unwrap();
}

#[tokio::test]
async fn test_machine_id_generation() {
    let machine_id = app_lib::vault_lock::get_machine_id();
    let hostname = app_lib::vault_lock::get_hostname();

    println!("Machine ID: {}", machine_id);
    println!("Hostname: {}", hostname);

    assert!(!machine_id.is_empty(), "Machine ID should not be empty");
    assert!(!hostname.is_empty(), "Hostname should not be empty");
}
