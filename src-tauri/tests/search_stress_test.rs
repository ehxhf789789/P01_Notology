use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use std::thread;
use std::time::{Duration, Instant};
use tempfile::TempDir;

// Import from the main library
use app_lib::search::SearchIndex;

const SIMULATION_COUNT: usize = 5000;
const CONCURRENT_THREADS: usize = 4;

/// Create a test markdown file with frontmatter
fn create_test_note(dir: &PathBuf, index: usize) -> PathBuf {
    let note_path = dir.join(format!("note_{:05}.md", index));
    let content = format!(
        r#"---
title: Test Note {}
type: NOTE
tags:
  - test
  - simulation
created: 2024-01-{:02}
modified: 2024-01-{:02}
---

# Test Note {}

This is test content for note number {}.

## Section 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
테스트 한글 내용입니다. 검색 인덱스 테스트.

## Section 2

More content here with [[wikilink]] references.
"#,
        index,
        (index % 28) + 1,
        (index % 28) + 1,
        index,
        index
    );
    fs::write(&note_path, content).expect("Failed to write test note");
    note_path
}

/// Simulate lock file from another device (cloud sync scenario)
fn simulate_stale_lock(index_dir: &PathBuf) {
    let lock_file = index_dir.join(".tantivy-writer.lock");
    fs::write(&lock_file, "stale lock from another device").ok();
}

#[test]
fn test_sequential_indexing_5000_notes() {
    println!("\n=== Sequential Indexing Test (5000 notes) ===\n");

    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let vault_path = temp_dir.path().to_path_buf();

    // Create test notes
    println!("Creating {} test notes...", SIMULATION_COUNT);
    let start = Instant::now();
    let note_paths: Vec<PathBuf> = (0..SIMULATION_COUNT)
        .map(|i| create_test_note(&vault_path, i))
        .collect();
    println!("Notes created in {:?}", start.elapsed());

    // Initialize search index
    println!("Initializing search index...");
    let start = Instant::now();
    let index = SearchIndex::new(vault_path.to_str().unwrap())
        .expect("Failed to create search index");
    println!("Index initialized in {:?}", start.elapsed());

    // Index all notes sequentially
    println!("Indexing {} notes sequentially...", SIMULATION_COUNT);
    let start = Instant::now();
    let mut success_count = 0;
    let mut error_count = 0;

    for (i, note_path) in note_paths.iter().enumerate() {
        match index.index_file(note_path) {
            Ok(_) => success_count += 1,
            Err(e) => {
                error_count += 1;
                if error_count <= 10 {
                    println!("Error indexing note {}: {}", i, e);
                }
            }
        }

        if (i + 1) % 1000 == 0 {
            println!("  Indexed {}/{} notes...", i + 1, SIMULATION_COUNT);
        }
    }

    let elapsed = start.elapsed();
    let rate = SIMULATION_COUNT as f64 / elapsed.as_secs_f64();

    println!("\n--- Sequential Indexing Results ---");
    println!("Total time: {:?}", elapsed);
    println!("Success: {}, Errors: {}", success_count, error_count);
    println!("Rate: {:.2} notes/second", rate);
    println!("Average: {:.2}ms per note", elapsed.as_millis() as f64 / SIMULATION_COUNT as f64);

    // Test search performance
    println!("\nTesting search performance...");
    let start = Instant::now();
    let results = index.search("test", 100).expect("Search failed");
    println!("Search for 'test' returned {} results in {:?}", results.len(), start.elapsed());

    let start = Instant::now();
    let results = index.search("한글", 100).expect("Search failed");
    println!("Search for '한글' returned {} results in {:?}", results.len(), start.elapsed());

    assert_eq!(error_count, 0, "Should have no indexing errors");
}

#[test]
fn test_concurrent_indexing() {
    println!("\n=== Concurrent Indexing Test ({} threads) ===\n", CONCURRENT_THREADS);

    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let vault_path = temp_dir.path().to_path_buf();

    // Create test notes
    let notes_per_thread = SIMULATION_COUNT / CONCURRENT_THREADS;
    println!("Creating {} test notes...", SIMULATION_COUNT);
    let note_paths: Vec<PathBuf> = (0..SIMULATION_COUNT)
        .map(|i| create_test_note(&vault_path, i))
        .collect();

    // Initialize search index
    let index = Arc::new(
        SearchIndex::new(vault_path.to_str().unwrap())
            .expect("Failed to create search index")
    );

    let success_count = Arc::new(AtomicUsize::new(0));
    let error_count = Arc::new(AtomicUsize::new(0));

    println!("Starting {} concurrent threads...", CONCURRENT_THREADS);
    let start = Instant::now();

    let handles: Vec<_> = (0..CONCURRENT_THREADS)
        .map(|thread_id| {
            let index = Arc::clone(&index);
            let success = Arc::clone(&success_count);
            let errors = Arc::clone(&error_count);
            let paths: Vec<PathBuf> = note_paths[thread_id * notes_per_thread..(thread_id + 1) * notes_per_thread]
                .to_vec();

            thread::spawn(move || {
                for note_path in paths {
                    match index.index_file(&note_path) {
                        Ok(_) => { success.fetch_add(1, Ordering::SeqCst); }
                        Err(_) => { errors.fetch_add(1, Ordering::SeqCst); }
                    }
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().expect("Thread panicked");
    }

    let elapsed = start.elapsed();
    let rate = SIMULATION_COUNT as f64 / elapsed.as_secs_f64();

    println!("\n--- Concurrent Indexing Results ---");
    println!("Total time: {:?}", elapsed);
    println!("Success: {}, Errors: {}",
        success_count.load(Ordering::SeqCst),
        error_count.load(Ordering::SeqCst));
    println!("Rate: {:.2} notes/second", rate);
    println!("Threads: {}", CONCURRENT_THREADS);
}

#[test]
fn test_lock_recovery_simulation() {
    println!("\n=== Lock Recovery Simulation Test ===\n");

    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let vault_path = temp_dir.path().to_path_buf();
    let index_dir = vault_path.join(".notology").join("index");

    // Create some test notes
    let note_count = 100;
    let note_paths: Vec<PathBuf> = (0..note_count)
        .map(|i| create_test_note(&vault_path, i))
        .collect();

    let mut recovery_success = 0;
    let mut recovery_failed = 0;
    let iterations = 50;

    println!("Running {} lock recovery iterations...", iterations);

    for i in 0..iterations {
        // Simulate stale lock file (as if synced from another device)
        if index_dir.exists() {
            simulate_stale_lock(&index_dir);
        }

        // Try to open index (should recover from lock)
        match SearchIndex::new(vault_path.to_str().unwrap()) {
            Ok(index) => {
                // Try to index a note
                if index.index_file(&note_paths[i % note_count]).is_ok() {
                    recovery_success += 1;
                } else {
                    recovery_failed += 1;
                }
            }
            Err(e) => {
                recovery_failed += 1;
                println!("Recovery failed at iteration {}: {}", i, e);
            }
        }
    }

    println!("\n--- Lock Recovery Results ---");
    println!("Success: {}/{}", recovery_success, iterations);
    println!("Failed: {}/{}", recovery_failed, iterations);
    println!("Recovery rate: {:.1}%", (recovery_success as f64 / iterations as f64) * 100.0);

    assert!(recovery_failed == 0, "All lock recoveries should succeed");
}

#[test]
fn test_rapid_read_write_cycles() {
    println!("\n=== Rapid Read/Write Cycle Test ===\n");

    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let vault_path = temp_dir.path().to_path_buf();

    // Create initial notes
    let note_count = 500;
    let note_paths: Vec<PathBuf> = (0..note_count)
        .map(|i| create_test_note(&vault_path, i))
        .collect();

    let index = SearchIndex::new(vault_path.to_str().unwrap())
        .expect("Failed to create search index");

    // Initial indexing
    for path in &note_paths {
        index.index_file(path).ok();
    }

    let cycles = 1000;
    let mut write_errors = 0;
    let mut read_errors = 0;

    println!("Running {} rapid read/write cycles...", cycles);
    let start = Instant::now();

    for i in 0..cycles {
        // Write operation (re-index a note)
        let note_idx = i % note_count;
        if index.index_file(&note_paths[note_idx]).is_err() {
            write_errors += 1;
        }

        // Read operation (search)
        if index.search("test", 10).is_err() {
            read_errors += 1;
        }
    }

    let elapsed = start.elapsed();

    println!("\n--- Rapid Read/Write Results ---");
    println!("Total time: {:?}", elapsed);
    println!("Cycles: {}", cycles);
    println!("Write errors: {}", write_errors);
    println!("Read errors: {}", read_errors);
    println!("Rate: {:.2} cycles/second", cycles as f64 / elapsed.as_secs_f64());

    assert_eq!(write_errors, 0, "Should have no write errors");
    assert_eq!(read_errors, 0, "Should have no read errors");
}

#[test]
fn test_index_corruption_recovery() {
    println!("\n=== Index Corruption Recovery Test ===\n");

    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let vault_path = temp_dir.path().to_path_buf();
    let index_dir = vault_path.join(".notology").join("index");

    // Create test notes
    let note_paths: Vec<PathBuf> = (0..100)
        .map(|i| create_test_note(&vault_path, i))
        .collect();

    // Create initial index
    {
        let index = SearchIndex::new(vault_path.to_str().unwrap())
            .expect("Failed to create search index");
        for path in &note_paths {
            index.index_file(path).ok();
        }
    }

    let mut recovery_success = 0;
    let iterations = 20;

    println!("Running {} corruption recovery tests...", iterations);

    for i in 0..iterations {
        // Corrupt the index by writing garbage to meta.json
        let meta_file = index_dir.join("meta.json");
        if meta_file.exists() {
            fs::write(&meta_file, "corrupted data!!!").ok();
        }

        // Try to open index (should detect corruption and recreate)
        match SearchIndex::new(vault_path.to_str().unwrap()) {
            Ok(index) => {
                // Re-index a note to verify it works
                if index.index_file(&note_paths[0]).is_ok() {
                    recovery_success += 1;
                }
            }
            Err(e) => {
                println!("Recovery failed at iteration {}: {}", i, e);
            }
        }
    }

    println!("\n--- Corruption Recovery Results ---");
    println!("Success: {}/{}", recovery_success, iterations);
    println!("Recovery rate: {:.1}%", (recovery_success as f64 / iterations as f64) * 100.0);
}

fn main() {
    println!("Running Search Index Stress Tests");
    println!("==================================\n");

    // Run all tests
    test_sequential_indexing_5000_notes();
    test_concurrent_indexing();
    test_lock_recovery_simulation();
    test_rapid_read_write_cycles();
    test_index_corruption_recovery();

    println!("\n==================================");
    println!("All stress tests completed!");
}
