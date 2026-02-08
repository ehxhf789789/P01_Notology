//! Synology Drive 동기화 환경 시뮬레이션 테스트
//!
//! 이 테스트는 Synology Drive를 통해 여러 기기에서 동시에 접근하는 시나리오를 시뮬레이션합니다.
//!
//! 시나리오:
//! 1. 다른 기기에서 동기화된 lock 파일
//! 2. 동기화 중 파일 권한 충돌
//! 3. 부분적으로 동기화된 인덱스 파일
//! 4. 동기화 지연으로 인한 파일 불일치
//! 5. 여러 기기에서 동시 인덱싱

use std::fs::{self, File, OpenOptions};
use std::path::PathBuf;
use std::sync::{Arc, Barrier, atomic::{AtomicUsize, Ordering}};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tempfile::TempDir;

// Simulated "other device" operations that happen via Synology Drive sync

/// Simulate a lock file synced from another device (Mac, Linux, or another Windows PC)
fn simulate_synced_lock_file(index_dir: &PathBuf) {
    let lock_file = index_dir.join(".tantivy-writer.lock");
    // Synology Drive syncs files with their original content
    // This simulates a lock file from another device
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let _ = fs::write(&lock_file, format!(
        "PID: 12345\nDevice: remote-mac\nTimestamp: {}\n",
        timestamp
    ));
}

/// Simulate partial sync - index files exist but are incomplete
fn simulate_partial_sync(index_dir: &PathBuf) {
    if let Ok(entries) = fs::read_dir(index_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "term" || e == "pos") {
                // Truncate file to simulate incomplete sync
                if let Ok(metadata) = path.metadata() {
                    let new_size = metadata.len() / 2;
                    if let Ok(file) = OpenOptions::new().write(true).open(&path) {
                        let _ = file.set_len(new_size);
                    }
                }
            }
        }
    }
}

/// Simulate Synology Drive sync conflict file
fn simulate_sync_conflict(vault_dir: &PathBuf, note_index: usize) {
    let note_path = vault_dir.join(format!("note_{:05}.md", note_index));
    // Synology Drive creates conflict files like "filename (SynologyDrive Conflict).md"
    let conflict_path = vault_dir.join(format!("note_{:05} (SynologyDrive Conflict).md", note_index));

    if note_path.exists() {
        let _ = fs::copy(&note_path, &conflict_path);
        // Modify the conflict file slightly
        if let Ok(mut content) = fs::read_to_string(&conflict_path) {
            content.push_str("\n\n<!-- Conflict from another device -->\n");
            let _ = fs::write(&conflict_path, content);
        }
    }
}

/// Simulate file being locked by Synology Drive sync process
fn simulate_file_lock_during_sync(file_path: &PathBuf) -> Option<File> {
    // Try to open file with exclusive access (simulates sync in progress)
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(file_path)
        .ok()
}

/// Create a test markdown file
fn create_test_note(dir: &PathBuf, index: usize) -> PathBuf {
    let note_path = dir.join(format!("note_{:05}.md", index));
    let content = format!(
        r#"---
title: Test Note {}
type: NOTE
tags:
  - test
  - synology
created: 2024-01-{:02}
modified: 2024-01-{:02}
---

# Test Note {}

테스트 내용입니다. Synology Drive 동기화 테스트.

## 섹션 1

Lorem ipsum dolor sit amet.
한글 검색 테스트 내용.

## 링크

[[note_{:05}]]
"#,
        index,
        (index % 28) + 1,
        (index % 28) + 1,
        index,
        (index + 1) % 5000
    );
    fs::write(&note_path, content).expect("Failed to write test note");
    note_path
}

/// 테스트 1: 다른 기기에서 동기화된 lock 파일 처리
fn test_synced_lock_recovery(vault_path: &PathBuf, note_paths: &[PathBuf]) -> (usize, usize, Duration) {
    println!("\n[TEST 1] 다른 기기에서 동기화된 lock 파일 복구 테스트");

    let index_dir = vault_path.join(".notology").join("index");
    let iterations = 100;
    let mut success = 0;
    let mut failed = 0;
    let start = Instant::now();

    for i in 0..iterations {
        // 50% 확률로 다른 기기의 lock 파일 시뮬레이션
        if i % 2 == 0 && index_dir.exists() {
            simulate_synced_lock_file(&index_dir);
        }

        match app_lib::search::SearchIndex::new(vault_path.to_str().unwrap()) {
            Ok(index) => {
                if index.index_file(&note_paths[i % note_paths.len()]).is_ok() {
                    success += 1;
                } else {
                    failed += 1;
                }
            }
            Err(e) => {
                failed += 1;
                if failed <= 5 {
                    eprintln!("  Lock recovery failed: {}", e);
                }
            }
        }
    }

    let elapsed = start.elapsed();
    println!("  결과: 성공 {}/{}, 실패 {}", success, iterations, failed);
    println!("  소요 시간: {:?}", elapsed);

    (success, failed, elapsed)
}

/// 테스트 2: 동기화 중 인덱스 손상 복구
fn test_partial_sync_recovery(vault_path: &PathBuf, note_paths: &[PathBuf]) -> (usize, usize, Duration) {
    println!("\n[TEST 2] 부분 동기화(인덱스 손상) 복구 테스트");

    let index_dir = vault_path.join(".notology").join("index");
    let iterations = 50;
    let mut success = 0;
    let mut failed = 0;
    let start = Instant::now();

    for i in 0..iterations {
        // 30% 확률로 부분 동기화 시뮬레이션
        if i % 3 == 0 && index_dir.exists() {
            simulate_partial_sync(&index_dir);
        }

        match app_lib::search::SearchIndex::new(vault_path.to_str().unwrap()) {
            Ok(index) => {
                // 인덱싱과 검색 모두 테스트
                let index_ok = index.index_file(&note_paths[i % note_paths.len()]).is_ok();
                let search_ok = index.search("테스트", 10).is_ok();

                if index_ok && search_ok {
                    success += 1;
                } else {
                    failed += 1;
                }
            }
            Err(e) => {
                failed += 1;
                if failed <= 5 {
                    eprintln!("  Partial sync recovery failed: {}", e);
                }
            }
        }
    }

    let elapsed = start.elapsed();
    println!("  결과: 성공 {}/{}, 실패 {}", success, iterations, failed);
    println!("  소요 시간: {:?}", elapsed);

    (success, failed, elapsed)
}

/// 테스트 3: 여러 "기기"에서 동시 접근 시뮬레이션
fn test_multi_device_concurrent_access(vault_path: &PathBuf, note_paths: &[PathBuf]) -> (usize, usize, Duration) {
    println!("\n[TEST 3] 다중 기기 동시 접근 시뮬레이션 (4개 스레드 = 4개 기기)");

    let device_count = 4;
    let operations_per_device = 250;
    let total_ops = device_count * operations_per_device;

    let vault_path = vault_path.clone();
    let note_paths: Vec<PathBuf> = note_paths.to_vec();
    let success_count = Arc::new(AtomicUsize::new(0));
    let error_count = Arc::new(AtomicUsize::new(0));
    let barrier = Arc::new(Barrier::new(device_count));

    let start = Instant::now();

    let handles: Vec<_> = (0..device_count)
        .map(|device_id| {
            let vault = vault_path.clone();
            let notes = note_paths.clone();
            let success = Arc::clone(&success_count);
            let errors = Arc::clone(&error_count);
            let barrier = Arc::clone(&barrier);

            thread::spawn(move || {
                // 모든 "기기"가 동시에 시작
                barrier.wait();

                for i in 0..operations_per_device {
                    // 각 기기마다 약간의 시간차
                    if i % 10 == device_id {
                        thread::sleep(Duration::from_millis(1));
                    }

                    match app_lib::search::SearchIndex::new(vault.to_str().unwrap()) {
                        Ok(index) => {
                            let note_idx = (device_id * operations_per_device + i) % notes.len();

                            // 번갈아가며 읽기/쓰기 작업
                            let result = if i % 2 == 0 {
                                index.index_file(&notes[note_idx]).is_ok()
                            } else {
                                index.search("테스트", 5).is_ok()
                            };

                            if result {
                                success.fetch_add(1, Ordering::SeqCst);
                            } else {
                                errors.fetch_add(1, Ordering::SeqCst);
                            }
                        }
                        Err(_) => {
                            errors.fetch_add(1, Ordering::SeqCst);
                        }
                    }
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().expect("Thread panicked");
    }

    let elapsed = start.elapsed();
    let success = success_count.load(Ordering::SeqCst);
    let failed = error_count.load(Ordering::SeqCst);

    println!("  결과: 성공 {}/{}, 실패 {}", success, total_ops, failed);
    println!("  소요 시간: {:?}", elapsed);
    println!("  처리량: {:.2} ops/sec", total_ops as f64 / elapsed.as_secs_f64());

    (success, failed, elapsed)
}

/// 테스트 4: 빠른 연속 파일 변경 (동기화 부하 시뮬레이션)
fn test_rapid_file_changes(vault_path: &PathBuf, note_paths: &[PathBuf]) -> (usize, usize, Duration) {
    println!("\n[TEST 4] 빠른 연속 파일 변경 테스트 (동기화 부하)");

    let iterations = 500;
    let mut success = 0;
    let mut failed = 0;
    let start = Instant::now();

    let index = match app_lib::search::SearchIndex::new(vault_path.to_str().unwrap()) {
        Ok(idx) => idx,
        Err(e) => {
            println!("  인덱스 생성 실패: {}", e);
            return (0, iterations, Duration::ZERO);
        }
    };

    for i in 0..iterations {
        // 노트 내용 수정 (동기화 트리거)
        let note_idx = i % note_paths.len();
        let note_path = &note_paths[note_idx];

        // 파일 수정
        if let Ok(mut content) = fs::read_to_string(note_path) {
            content.push_str(&format!("\n<!-- Update {} -->", i));
            if fs::write(note_path, &content).is_ok() {
                // 즉시 재인덱싱 시도
                if index.index_file(note_path).is_ok() {
                    success += 1;
                } else {
                    failed += 1;
                }
            } else {
                failed += 1;
            }
        } else {
            failed += 1;
        }

        // 10%의 작업마다 검색 테스트
        if i % 10 == 0 {
            if index.search("Update", 10).is_err() {
                failed += 1;
            }
        }
    }

    let elapsed = start.elapsed();
    println!("  결과: 성공 {}/{}, 실패 {}", success, iterations, failed);
    println!("  소요 시간: {:?}", elapsed);
    println!("  처리량: {:.2} updates/sec", iterations as f64 / elapsed.as_secs_f64());

    (success, failed, elapsed)
}

/// 테스트 5: 대량 초기 인덱싱 (새 기기에서 첫 동기화 후 시나리오)
fn test_initial_bulk_indexing(vault_path: &PathBuf, note_paths: &[PathBuf]) -> (usize, usize, Duration) {
    println!("\n[TEST 5] 대량 초기 인덱싱 테스트 ({}개 노트)", note_paths.len());

    // 기존 인덱스 삭제 (새 기기 시뮬레이션)
    let index_dir = vault_path.join(".notology").join("index");
    if index_dir.exists() {
        let _ = fs::remove_dir_all(&index_dir);
    }

    let start = Instant::now();
    let mut success = 0;
    let mut failed = 0;

    let index = match app_lib::search::SearchIndex::new(vault_path.to_str().unwrap()) {
        Ok(idx) => idx,
        Err(e) => {
            println!("  인덱스 생성 실패: {}", e);
            return (0, note_paths.len(), Duration::ZERO);
        }
    };

    for (i, note_path) in note_paths.iter().enumerate() {
        if index.index_file(note_path).is_ok() {
            success += 1;
        } else {
            failed += 1;
        }

        if (i + 1) % 1000 == 0 {
            println!("  진행: {}/{}", i + 1, note_paths.len());
        }
    }

    let elapsed = start.elapsed();
    println!("  결과: 성공 {}/{}, 실패 {}", success, note_paths.len(), failed);
    println!("  소요 시간: {:?}", elapsed);
    println!("  처리량: {:.2} notes/sec", note_paths.len() as f64 / elapsed.as_secs_f64());
    println!("  평균: {:.2}ms/note", elapsed.as_millis() as f64 / note_paths.len() as f64);

    (success, failed, elapsed)
}

fn main() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║     Synology Drive 동기화 환경 스트레스 테스트 (5000건)      ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let vault_path = temp_dir.path().to_path_buf();

    // 5000개 테스트 노트 생성
    println!("[준비] 5000개 테스트 노트 생성 중...");
    let prep_start = Instant::now();
    let note_paths: Vec<PathBuf> = (0..5000)
        .map(|i| create_test_note(&vault_path, i))
        .collect();
    println!("[준비] 완료: {:?}\n", prep_start.elapsed());

    // 테스트 실행
    let mut total_success = 0;
    let mut total_failed = 0;

    let (s, f, _) = test_synced_lock_recovery(&vault_path, &note_paths);
    total_success += s;
    total_failed += f;

    let (s, f, _) = test_partial_sync_recovery(&vault_path, &note_paths);
    total_success += s;
    total_failed += f;

    let (s, f, _) = test_multi_device_concurrent_access(&vault_path, &note_paths);
    total_success += s;
    total_failed += f;

    let (s, f, _) = test_rapid_file_changes(&vault_path, &note_paths);
    total_success += s;
    total_failed += f;

    let (s, f, _) = test_initial_bulk_indexing(&vault_path, &note_paths);
    total_success += s;
    total_failed += f;

    // 최종 결과
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║                        최종 결과                              ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║ 총 성공: {:6}                                              ║", total_success);
    println!("║ 총 실패: {:6}                                              ║", total_failed);
    println!("║ 성공률:  {:5.1}%                                             ║",
        (total_success as f64 / (total_success + total_failed) as f64) * 100.0);
    println!("╚══════════════════════════════════════════════════════════════╝");

    if total_failed > 0 {
        println!("\n⚠️  일부 테스트에서 실패가 발생했습니다. 병목 지점을 확인하세요.");
    } else {
        println!("\n✅ 모든 테스트가 성공적으로 완료되었습니다!");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_synology_simulation() {
        main();
    }
}
