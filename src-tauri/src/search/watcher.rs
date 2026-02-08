use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

use super::SearchIndex;

/// Payload emitted when files are changed (by Synology sync or external edits)
#[derive(Clone, Serialize)]
pub struct VaultFilesChangedPayload {
    pub paths: Vec<String>,
}

/// Payload emitted when files are deleted
#[derive(Clone, Serialize)]
pub struct VaultFileDeletedPayload {
    pub paths: Vec<String>,
}

/// Payload emitted when a Synology Drive conflict file is detected
#[derive(Clone, Serialize)]
pub struct SynologyConflictPayload {
    pub conflict_path: String,
    pub original_path: String,
}

/// Payload emitted when bulk sync state changes (Synology catch-up sync detected)
#[derive(Clone, Serialize)]
pub struct BulkSyncStatePayload {
    /// true = bulk sync started, false = bulk sync ended (stabilized)
    pub syncing: bool,
    /// Number of files detected in the burst
    pub file_count: usize,
}

pub struct VaultWatcher {
    _watcher: RecommendedWatcher,
}

impl VaultWatcher {
    /// Start watching a vault directory for file changes
    /// and update the search index accordingly.
    /// Optimized for NAS/cloud sync environments (Synology Drive) with smart batching.
    /// Emits Tauri events to notify the frontend of external changes.
    pub fn start(
        vault_path: &str,
        index: Arc<SearchIndex>,
        app_handle: tauri::AppHandle,
    ) -> Result<Self, String> {
        let vault = PathBuf::from(vault_path);
        let (tx, rx) = mpsc::channel();

        // Optimized settings for NAS/cloud sync environments (Synology Drive)
        // - Poll interval: 300ms (reduced CPU usage on NAS)
        // - Debounce: 250ms (longer wait to batch cloud sync bursts)
        let mut watcher = RecommendedWatcher::new(
            tx,
            Config::default().with_poll_interval(Duration::from_millis(300)),
        )
        .map_err(|e| e.to_string())?;

        watcher
            .watch(vault.as_path(), RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        // Spawn background thread to process events
        let vault_clone = vault.clone();
        let index_clone = Arc::clone(&index);
        thread::spawn(move || {
            // Track pending paths with their last event time for smart debouncing
            let mut pending_paths: HashMap<PathBuf, Instant> = HashMap::new();
            // Base debounce: 250ms (longer for NAS to batch cloud sync bursts)
            let base_debounce = Duration::from_millis(250);
            // Extended debounce for rapid changes (cloud sync can send many events)
            let extended_debounce = Duration::from_millis(500);
            // Burst sync debounce (when many files change at once, e.g. computer wake-up)
            let burst_debounce = Duration::from_secs(2);
            let burst_threshold: usize = 10;
            // Track burst window
            let mut burst_event_count: usize = 0;
            let mut burst_window_start = Instant::now();
            // Track whether we've notified frontend of bulk sync state
            let mut in_bulk_sync = false;

            loop {
                match rx.recv_timeout(base_debounce) {
                    Ok(Ok(event)) => {
                        let now = Instant::now();

                        // Burst detection: count events in sliding window
                        if burst_window_start.elapsed() > Duration::from_secs(2) {
                            // Window expired: if we were in bulk sync and events stopped,
                            // this will be resolved in the timeout handler below
                            burst_event_count = 0;
                            burst_window_start = Instant::now();
                        }
                        burst_event_count += event.paths.len();

                        // Notify frontend when bulk sync starts
                        if burst_event_count > burst_threshold && !in_bulk_sync {
                            in_bulk_sync = true;
                            let _ = app_handle.emit(
                                "synology-bulk-sync",
                                BulkSyncStatePayload { syncing: true, file_count: burst_event_count },
                            );
                        }

                        for path in &event.paths {
                            if should_process_path(path, &vault_clone) {
                                pending_paths.insert(path.clone(), now);
                            }
                        }

                        // Handle removals with slight delay (NAS might resync)
                        if matches!(event.kind, EventKind::Remove(_)) {
                            // Wait once for the entire batch (not per-file)
                            thread::sleep(Duration::from_millis(100));
                            let mut deleted_paths: Vec<String> = Vec::new();
                            for path in &event.paths {
                                if should_process_path(path, &vault_clone) && !path.exists() {
                                    if let Err(e) = index_clone.remove_file(path) {
                                        log::warn!("Failed to remove from index: {}", e);
                                    }
                                    deleted_paths.push(path.to_string_lossy().to_string());
                                }
                            }
                            for path in &event.paths {
                                pending_paths.remove(path);
                            }
                            // Notify frontend of deletions
                            if !deleted_paths.is_empty() {
                                let _ = app_handle.emit(
                                    "vault-file-deleted",
                                    VaultFileDeletedPayload { paths: deleted_paths },
                                );
                            }
                        }
                    }
                    Ok(Err(e)) => {
                        log::warn!("File watcher error: {}", e);
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Smart batching: only process paths that have been stable
                        let now = Instant::now();
                        let mut to_process = Vec::new();
                        let mut still_pending = HashMap::new();

                        // Use extended debounce during burst sync (many files changing at once)
                        let effective_debounce = if burst_event_count > burst_threshold {
                            log::debug!(
                                "[Watcher] Burst sync detected ({} events), using extended debounce",
                                burst_event_count
                            );
                            burst_debounce
                        } else {
                            extended_debounce
                        };

                        for (path, last_event) in pending_paths.drain() {
                            let elapsed = now.duration_since(last_event);
                            // If path hasn't changed for effective_debounce, it's stable
                            if elapsed >= effective_debounce {
                                to_process.push(path);
                            } else {
                                // Still receiving changes, keep waiting
                                still_pending.insert(path, last_event);
                            }
                        }

                        pending_paths = still_pending;

                        // Batch process stable paths
                        if !to_process.is_empty() {
                            log::debug!("[Watcher] Processing {} stable paths", to_process.len());
                        }

                        // Collect changed file paths for frontend notification
                        let mut changed_paths: Vec<String> = Vec::new();

                        for path in to_process {
                            if path.exists() && path.is_file() {
                                let file_name = path
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("");

                                // Check for Synology Drive conflict files
                                if is_synology_conflict_file(file_name) {
                                    if let Some(original_path) = get_original_from_conflict(&path)
                                    {
                                        log::warn!(
                                            "[Watcher] Synology conflict detected: {} -> {}",
                                            path.display(),
                                            original_path.display()
                                        );
                                        let _ = app_handle.emit(
                                            "synology-conflict-detected",
                                            SynologyConflictPayload {
                                                conflict_path: path
                                                    .to_string_lossy()
                                                    .to_string(),
                                                original_path: original_path
                                                    .to_string_lossy()
                                                    .to_string(),
                                            },
                                        );
                                    }
                                    continue; // Don't index conflict files
                                }

                                if file_name == "comments.json" {
                                    // Get the note path by removing _att suffix
                                    if let Some(att_folder) = path.parent() {
                                        if let Some(att_name) =
                                            att_folder.file_name().and_then(|n| n.to_str())
                                        {
                                            if att_name.ends_with("_att") {
                                                let note_name =
                                                    &att_name[..att_name.len() - 4];
                                                if let Some(parent_dir) = att_folder.parent() {
                                                    let note_path = parent_dir
                                                        .join(format!("{}.md", note_name));
                                                    if note_path.exists() {
                                                        if let Err(e) =
                                                            index_clone.index_file(&note_path)
                                                        {
                                                            log::warn!("Failed to reindex note after comment change {}: {}", note_path.display(), e);
                                                        }
                                                        changed_paths.push(
                                                            note_path
                                                                .to_string_lossy()
                                                                .to_string(),
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if let Err(e) = index_clone.index_file(&path) {
                                        log::warn!("Failed to index {}: {}", path.display(), e);
                                    }
                                    changed_paths
                                        .push(path.to_string_lossy().to_string());
                                }
                            }
                        }

                        // Notify frontend of changed files
                        if !changed_paths.is_empty() {
                            let _ = app_handle.emit(
                                "vault-files-changed",
                                VaultFilesChangedPayload {
                                    paths: changed_paths,
                                },
                            );
                        }

                        // Detect bulk sync end: pending_paths drained and burst was active
                        if in_bulk_sync && pending_paths.is_empty() {
                            in_bulk_sync = false;
                            burst_event_count = 0;
                            let _ = app_handle.emit(
                                "synology-bulk-sync",
                                BulkSyncStatePayload { syncing: false, file_count: 0 },
                            );
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        break;
                    }
                }
            }
        });

        Ok(VaultWatcher { _watcher: watcher })
    }
}

fn should_process_path(path: &Path, vault_path: &Path) -> bool {
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    // Skip temporary files from atomic writes
    if file_name.ends_with(".notology-tmp") {
        return false;
    }

    // Process .md files
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if extension == "md" {
        // Skip hidden directories and attachment folders
        let relative = path.strip_prefix(vault_path).unwrap_or(path);
        for component in relative.components() {
            if let std::path::Component::Normal(name) = component {
                let name_str = name.to_string_lossy();
                if name_str.starts_with('.') || name_str.ends_with("_att") {
                    return false;
                }
            }
        }
        return true;
    }

    // Also process comments.json files in _att folders
    if file_name == "comments.json" {
        return path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .map(|s| s.ends_with("_att"))
            .unwrap_or(false);
    }

    false
}

/// Check if a filename matches Synology Drive conflict patterns.
/// Synology Drive creates files like:
///   "filename (SynologyDrive Conflict).md"
///   "filename (SynologyDrive Conflict 2024-01-01).md"
///   "filename (Synology Conflict).md" (older versions)
pub fn is_synology_conflict_file(file_name: &str) -> bool {
    let lower = file_name.to_lowercase();
    lower.contains("(synologydrive conflict") || lower.contains("(synology conflict")
}

/// Extract the original file path from a Synology conflict file path.
pub fn get_original_from_conflict(conflict_path: &Path) -> Option<PathBuf> {
    let file_name = conflict_path.file_name()?.to_string_lossy().to_string();

    let re = regex::Regex::new(r" \(Synology(?:Drive)? [Cc]onflict[^)]*\)").ok()?;
    let original_name = re.replace(&file_name, "").to_string();

    if original_name == file_name {
        return None;
    }

    conflict_path.parent().map(|p| p.join(original_name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // =========================================================================
    // is_synology_conflict_file 테스트
    // =========================================================================

    #[test]
    fn test_detects_synologydrive_conflict() {
        assert!(is_synology_conflict_file("notes (SynologyDrive Conflict).md"));
    }

    #[test]
    fn test_detects_synologydrive_conflict_with_date() {
        assert!(is_synology_conflict_file("notes (SynologyDrive Conflict 2024-01-15).md"));
    }

    #[test]
    fn test_detects_synology_conflict_old_format() {
        assert!(is_synology_conflict_file("notes (Synology Conflict).md"));
    }

    #[test]
    fn test_detects_case_insensitive() {
        assert!(is_synology_conflict_file("notes (synologydrive conflict).md"));
        assert!(is_synology_conflict_file("notes (SYNOLOGYDRIVE CONFLICT).md"));
    }

    #[test]
    fn test_rejects_normal_files() {
        assert!(!is_synology_conflict_file("normal_note.md"));
        assert!(!is_synology_conflict_file("meeting (2024-01-15).md"));
        assert!(!is_synology_conflict_file("conflict_notes.md"));
    }

    #[test]
    fn test_detects_korean_filename_with_conflict() {
        assert!(is_synology_conflict_file("회의록 (SynologyDrive Conflict).md"));
    }

    // =========================================================================
    // get_original_from_conflict 테스트
    // =========================================================================

    #[test]
    fn test_extracts_original_path() {
        let conflict = PathBuf::from("/vault/notes (SynologyDrive Conflict).md");
        let original = get_original_from_conflict(&conflict);
        assert_eq!(
            original,
            Some(PathBuf::from("/vault/notes.md")),
            "충돌 파일에서 원본 경로 추출"
        );
    }

    #[test]
    fn test_extracts_original_with_date() {
        let conflict = PathBuf::from("/vault/notes (SynologyDrive Conflict 2024-01-15).md");
        let original = get_original_from_conflict(&conflict);
        assert_eq!(
            original,
            Some(PathBuf::from("/vault/notes.md")),
            "날짜 포함 충돌 파일에서 원본 경로 추출"
        );
    }

    #[test]
    fn test_extracts_original_old_format() {
        let conflict = PathBuf::from("/vault/report (Synology Conflict).md");
        let original = get_original_from_conflict(&conflict);
        assert_eq!(
            original,
            Some(PathBuf::from("/vault/report.md")),
            "구형식 충돌 파일에서 원본 경로 추출"
        );
    }

    #[test]
    fn test_returns_none_for_normal_file() {
        let normal = PathBuf::from("/vault/normal_note.md");
        let result = get_original_from_conflict(&normal);
        assert!(result.is_none(), "일반 파일에서는 None 반환");
    }

    #[test]
    fn test_preserves_directory_structure() {
        let conflict = PathBuf::from("/vault/Projects/Work/memo (SynologyDrive Conflict).md");
        let original = get_original_from_conflict(&conflict);
        assert_eq!(
            original,
            Some(PathBuf::from("/vault/Projects/Work/memo.md")),
            "디렉토리 구조가 보존되어야 함"
        );
    }

    // =========================================================================
    // should_process_path 테스트
    // =========================================================================

    #[test]
    fn test_processes_md_files() {
        let vault = PathBuf::from("/vault");
        let path = PathBuf::from("/vault/note.md");
        assert!(should_process_path(&path, &vault), ".md 파일 처리해야 함");
    }

    #[test]
    fn test_skips_tmp_files() {
        let vault = PathBuf::from("/vault");
        let path = PathBuf::from("/vault/note.md.notology-tmp");
        assert!(!should_process_path(&path, &vault), ".notology-tmp 파일 건너뛰어야 함");
    }

    #[test]
    fn test_skips_hidden_directory() {
        let vault = PathBuf::from("/vault");
        let path = PathBuf::from("/vault/.notology/cache.md");
        assert!(!should_process_path(&path, &vault), "숨김 디렉토리 건너뛰어야 함");
    }

    #[test]
    fn test_skips_att_folder() {
        let vault = PathBuf::from("/vault");
        let path = PathBuf::from("/vault/Note_att/embedded.md");
        assert!(!should_process_path(&path, &vault), "_att 폴더 건너뛰어야 함");
    }

    #[test]
    fn test_processes_comments_json_in_att() {
        let vault = PathBuf::from("/vault");
        let path = PathBuf::from("/vault/Note_att/comments.json");
        assert!(should_process_path(&path, &vault), "_att 내 comments.json은 처리해야 함");
    }

    #[test]
    fn test_skips_comments_json_not_in_att() {
        let vault = PathBuf::from("/vault");
        let path = PathBuf::from("/vault/subfolder/comments.json");
        assert!(!should_process_path(&path, &vault), "_att 외부 comments.json은 건너뛰어야 함");
    }

    #[test]
    fn test_skips_non_md_files() {
        let vault = PathBuf::from("/vault");
        assert!(!should_process_path(&PathBuf::from("/vault/image.png"), &vault));
        assert!(!should_process_path(&PathBuf::from("/vault/doc.pdf"), &vault));
        assert!(!should_process_path(&PathBuf::from("/vault/data.json"), &vault));
    }

    // =========================================================================
    // 통합: 충돌 파일은 should_process_path를 통과하지만 별도 처리
    // =========================================================================

    #[test]
    fn test_conflict_file_passes_process_check_but_detected_separately() {
        let vault = PathBuf::from("/vault");
        let conflict = PathBuf::from("/vault/note (SynologyDrive Conflict).md");

        // .md 파일이므로 should_process_path는 true
        assert!(should_process_path(&conflict, &vault), "충돌 파일도 .md이므로 처리 대상");

        // 하지만 is_synology_conflict_file로 별도 감지
        assert!(
            is_synology_conflict_file("note (SynologyDrive Conflict).md"),
            "충돌 파일로 감지되어야 함"
        );
    }
}
