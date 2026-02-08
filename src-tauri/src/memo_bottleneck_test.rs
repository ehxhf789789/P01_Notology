// Memo (Comment) 시스템 병목 테스트
// 목표: read/write/index/query 각 단계의 성능 측정

#[cfg(test)]
mod memo_bottleneck_tests {
    use crate::memo::{MemoIndex, MemoQueryFilter, IndexedMemo};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{Duration, Instant};
    use tempfile::TempDir;

    fn create_note_with_comments(vault: &PathBuf, note_name: &str, comment_count: usize) -> PathBuf {
        // Create note file
        let note_path = vault.join(format!("{}.md", note_name));
        let note_content = format!(r#"---
title: {}
created: 2025-01-01
modified: 2025-01-01
---

Test note content for {} with some text to comment on.
"#, note_name, note_name);
        fs::write(&note_path, &note_content).unwrap();

        // Create _att directory and comments.json
        let att_dir = vault.join(format!("{}_att", note_name));
        fs::create_dir_all(&att_dir).unwrap();

        let mut comments = Vec::new();
        for i in 0..comment_count {
            let comment = serde_json::json!({
                "id": format!("comment_{}_{}", note_name, i),
                "content": format!("Comment content number {} for note {}", i, note_name),
                "position": { "from": 100 + i, "to": 120 + i },
                "anchorText": "Test anchor text",
                "created": "2025-01-01",
                "createdTime": "2025-01-01T12:00:00Z",
                "resolved": i % 3 == 0,  // Every 3rd comment is resolved
                "task": if i % 2 == 0 {
                    serde_json::json!({
                        "summary": format!("Task summary {}", i),
                        "dueDate": format!("2025-01-{:02}", (i % 28) + 1),
                        "dueTime": "14:00"
                    })
                } else {
                    serde_json::Value::Null
                }
            });
            comments.push(comment);
        }

        let comments_path = att_dir.join("comments.json");
        fs::write(&comments_path, serde_json::to_string(&comments).unwrap()).unwrap();

        note_path
    }

    // ==========================================
    // Test 1: 단일 노트 코멘트 읽기 성능
    // ==========================================
    #[test]
    fn test_01_read_comments_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 1: 단일 노트 코멘트 읽기 성능 ===");

        let comment_counts = vec![1, 10, 50, 100, 500, 1000];

        for count in comment_counts {
            let note_path = create_note_with_comments(&vault, &format!("note_{}", count), count);
            let comments_path = vault.join(format!("note_{}_att/comments.json", count));

            let start = Instant::now();
            let _content = fs::read_to_string(&comments_path).unwrap();
            let read_time = start.elapsed();

            let start = Instant::now();
            let _parsed: Vec<serde_json::Value> = serde_json::from_str(&_content).unwrap();
            let parse_time = start.elapsed();

            println!(
                "코멘트 {}개: 읽기 {:?}, 파싱 {:?}, 합계 {:?}",
                count, read_time, parse_time, read_time + parse_time
            );

            // 성능 기준: 1000개 코멘트도 10ms 이내
            assert!(
                read_time + parse_time < Duration::from_millis(10),
                "코멘트 {}개 읽기가 10ms를 초과: {:?}",
                count, read_time + parse_time
            );
        }
    }

    // ==========================================
    // Test 2: 단일 노트 코멘트 쓰기 성능
    // ==========================================
    #[test]
    fn test_02_write_comments_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 2: 단일 노트 코멘트 쓰기 성능 ===");

        let comment_counts = vec![1, 10, 50, 100, 500, 1000];

        for count in comment_counts {
            let note_name = format!("write_test_{}", count);
            let att_dir = vault.join(format!("{}_att", note_name));
            fs::create_dir_all(&att_dir).unwrap();

            let mut comments = Vec::new();
            for i in 0..count {
                comments.push(serde_json::json!({
                    "id": format!("comment_{}", i),
                    "content": format!("Content {}", i),
                    "position": { "from": i, "to": i + 10 },
                    "anchorText": "anchor",
                    "created": "2025-01-01",
                    "resolved": false
                }));
            }

            let json_str = serde_json::to_string(&comments).unwrap();
            let comments_path = att_dir.join("comments.json");

            let start = Instant::now();
            fs::write(&comments_path, &json_str).unwrap();
            let write_time = start.elapsed();

            println!("코멘트 {}개 쓰기: {:?}", count, write_time);

            // 성능 기준: 1000개 코멘트도 5ms 이내
            assert!(
                write_time < Duration::from_millis(5),
                "코멘트 {}개 쓰기가 5ms를 초과: {:?}",
                count, write_time
            );
        }
    }

    // ==========================================
    // Test 3: MemoIndex 인덱싱 성능
    // ==========================================
    #[test]
    fn test_03_memo_index_single_note() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 3: MemoIndex 단일 노트 인덱싱 성능 ===");

        let comment_counts = vec![1, 10, 50, 100, 500, 1000];

        for count in comment_counts {
            let note_path = create_note_with_comments(&vault, &format!("index_{}", count), count);
            let memo_index = MemoIndex::new(vault.to_str().unwrap());

            let start = Instant::now();
            memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();
            let index_time = start.elapsed();

            println!("코멘트 {}개 인덱싱: {:?}", count, index_time);

            // 성능 기준: 1000개 코멘트도 50ms 이내 (파일 읽기 + 파싱 + 구조체 생성)
            assert!(
                index_time < Duration::from_millis(50),
                "코멘트 {}개 인덱싱이 50ms를 초과: {:?}",
                count, index_time
            );
        }
    }

    // ==========================================
    // Test 4: MemoIndex 대량 노트 인덱싱 성능
    // ==========================================
    #[test]
    fn test_04_memo_index_many_notes() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 4: MemoIndex 대량 노트 인덱싱 성능 ===");

        let note_counts = vec![10, 50, 100, 500];
        let comments_per_note = 10;

        for note_count in note_counts {
            // Create notes
            for i in 0..note_count {
                create_note_with_comments(&vault, &format!("bulk_{}", i), comments_per_note);
            }

            let memo_index = MemoIndex::new(vault.to_str().unwrap());

            let start = Instant::now();
            memo_index.full_reindex().unwrap();
            let reindex_time = start.elapsed();

            println!(
                "노트 {}개 (각 {}개 코멘트): 전체 재인덱싱 {:?}",
                note_count, comments_per_note, reindex_time
            );

            // 성능 기준: 500개 노트 (5000개 코멘트)도 5초 이내
            assert!(
                reindex_time < Duration::from_secs(5),
                "{}개 노트 재인덱싱이 5초를 초과: {:?}",
                note_count, reindex_time
            );

            // Clean up for next iteration
            for i in 0..note_count {
                let _ = fs::remove_file(vault.join(format!("bulk_{}.md", i)));
                let _ = fs::remove_dir_all(vault.join(format!("bulk_{}_att", i)));
            }
        }
    }

    // ==========================================
    // Test 5: 쿼리 성능 - 필터 없음
    // ==========================================
    #[test]
    fn test_05_query_no_filter() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 5: 쿼리 성능 - 필터 없음 ===");

        // Setup: 100 notes with 50 comments each = 5000 total comments
        for i in 0..100 {
            create_note_with_comments(&vault, &format!("query_{}", i), 50);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: None,
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        println!(
            "5000개 코멘트 필터 없이 쿼리: {:?}, 결과 {}개",
            query_time, results.len()
        );

        assert_eq!(results.len(), 5000);
        assert!(
            query_time < Duration::from_millis(50),
            "5000개 코멘트 쿼리가 50ms를 초과: {:?}",
            query_time
        );
    }

    // ==========================================
    // Test 6: 쿼리 성능 - 날짜 필터
    // ==========================================
    #[test]
    fn test_06_query_date_filter() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 6: 쿼리 성능 - 날짜 필터 ===");

        for i in 0..100 {
            create_note_with_comments(&vault, &format!("date_{}", i), 50);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        let filter = MemoQueryFilter {
            start_date: Some("2025-01-01".to_string()),
            end_date: Some("2025-01-15".to_string()),
            tasks_only: false,
            completed: None,
            note_path: None,
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        println!(
            "날짜 범위 필터 쿼리: {:?}, 결과 {}개",
            query_time, results.len()
        );

        assert!(
            query_time < Duration::from_millis(50),
            "날짜 필터 쿼리가 50ms를 초과: {:?}",
            query_time
        );
    }

    // ==========================================
    // Test 7: 쿼리 성능 - tasks_only 필터
    // ==========================================
    #[test]
    fn test_07_query_tasks_only() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 7: 쿼리 성능 - tasks_only 필터 ===");

        for i in 0..100 {
            create_note_with_comments(&vault, &format!("task_{}", i), 50);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: true,
            completed: None,
            note_path: None,
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        println!(
            "tasks_only 필터 쿼리: {:?}, 결과 {}개 (전체 5000개 중 task 개수)",
            query_time, results.len()
        );

        // Verify we got only tasks (task field is not None)
        assert!(results.iter().all(|m| m.task.is_some()));
        assert!(
            query_time < Duration::from_millis(50),
            "tasks_only 필터 쿼리가 50ms를 초과: {:?}",
            query_time
        );
    }

    // ==========================================
    // Test 8: 쿼리 성능 - completed 필터
    // ==========================================
    #[test]
    fn test_08_query_completed_filter() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 8: 쿼리 성능 - completed 필터 ===");

        for i in 0..100 {
            create_note_with_comments(&vault, &format!("comp_{}", i), 50);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: Some(false), // Uncompleted only
            note_path: None,
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        println!(
            "completed=false 필터 쿼리: {:?}, 결과 {}개",
            query_time, results.len()
        );

        assert!(
            query_time < Duration::from_millis(50),
            "completed 필터 쿼리가 50ms를 초과: {:?}",
            query_time
        );
    }

    // ==========================================
    // Test 9: 쿼리 성능 - note_path 필터
    // ==========================================
    #[test]
    fn test_09_query_note_path_filter() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 9: 쿼리 성능 - note_path 필터 ===");

        let target_note = create_note_with_comments(&vault, "target", 100);
        for i in 0..99 {
            create_note_with_comments(&vault, &format!("other_{}", i), 50);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: Some(target_note.to_str().unwrap().to_string()),
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        println!(
            "note_path 필터 쿼리: {:?}, 결과 {}개",
            query_time, results.len()
        );

        assert_eq!(results.len(), 100);
        assert!(
            query_time < Duration::from_millis(10),
            "note_path 필터 쿼리가 10ms를 초과: {:?}",
            query_time
        );
    }

    // ==========================================
    // Test 10: 복합 필터 성능
    // ==========================================
    #[test]
    fn test_10_query_combined_filters() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 10: 쿼리 성능 - 복합 필터 ===");

        for i in 0..100 {
            create_note_with_comments(&vault, &format!("combo_{}", i), 50);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        let filter = MemoQueryFilter {
            start_date: Some("2025-01-01".to_string()),
            end_date: Some("2025-01-10".to_string()),
            tasks_only: true,
            completed: Some(false),
            note_path: None,
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        println!(
            "복합 필터 쿼리 (날짜+task+미완료): {:?}, 결과 {}개",
            query_time, results.len()
        );

        assert!(
            query_time < Duration::from_millis(50),
            "복합 필터 쿼리가 50ms를 초과: {:?}",
            query_time
        );
    }

    // ==========================================
    // Test 11: 코멘트 추가/제거 반복 성능
    // ==========================================
    #[test]
    fn test_11_incremental_index_update() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 11: 증분 인덱스 업데이트 성능 ===");

        let note_path = create_note_with_comments(&vault, "incremental", 100);
        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();

        let mut update_times = Vec::new();

        // Simulate adding/updating comments 100 times
        for i in 0..100 {
            // Update comments.json
            let att_dir = vault.join("incremental_att");
            let comments_path = att_dir.join("comments.json");

            let mut comments: Vec<serde_json::Value> =
                serde_json::from_str(&fs::read_to_string(&comments_path).unwrap()).unwrap();

            comments.push(serde_json::json!({
                "id": format!("new_comment_{}", i),
                "content": format!("New content {}", i),
                "position": { "from": 200 + i, "to": 220 + i },
                "anchorText": "new anchor",
                "created": "2025-01-02",
                "resolved": false
            }));

            fs::write(&comments_path, serde_json::to_string(&comments).unwrap()).unwrap();

            // Re-index
            let start = Instant::now();
            memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();
            update_times.push(start.elapsed());
        }

        let avg_time: Duration = update_times.iter().sum::<Duration>() / update_times.len() as u32;
        let max_time = update_times.iter().max().unwrap();

        println!(
            "100회 증분 업데이트: 평균 {:?}, 최대 {:?}",
            avg_time, max_time
        );

        assert!(
            avg_time < Duration::from_millis(10),
            "평균 업데이트 시간이 10ms를 초과: {:?}",
            avg_time
        );
    }

    // ==========================================
    // Test 12: 동시 접근 시뮬레이션
    // ==========================================
    #[test]
    fn test_12_concurrent_access() {
        use std::thread;
        use std::sync::Arc;

        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 12: 동시 접근 시뮬레이션 ===");

        for i in 0..50 {
            create_note_with_comments(&vault, &format!("concurrent_{}", i), 20);
        }

        let memo_index = Arc::new(MemoIndex::new(vault.to_str().unwrap()));
        memo_index.full_reindex().unwrap();

        let mut handles = Vec::new();

        // Spawn 10 threads doing queries
        for thread_id in 0..10 {
            let index = Arc::clone(&memo_index);
            let handle = thread::spawn(move || {
                let mut times = Vec::new();
                for _ in 0..50 {
                    let filter = MemoQueryFilter {
                        start_date: None,
                        end_date: None,
                        tasks_only: thread_id % 2 == 0,
                        completed: None,
                        note_path: None,
                    };
                    let start = Instant::now();
                    let _ = index.query_memos(&filter).unwrap();
                    times.push(start.elapsed());
                }
                times.iter().sum::<Duration>() / times.len() as u32
            });
            handles.push(handle);
        }

        let avg_times: Vec<Duration> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        let overall_avg: Duration = avg_times.iter().sum::<Duration>() / avg_times.len() as u32;

        println!(
            "10개 스레드 동시 쿼리: 전체 평균 {:?}",
            overall_avg
        );

        assert!(
            overall_avg < Duration::from_millis(10),
            "동시 접근 평균 시간이 10ms를 초과: {:?}",
            overall_avg
        );
    }

    // ==========================================
    // Test 13: 메모리 효율성 (대량 데이터)
    // ==========================================
    #[test]
    fn test_13_memory_efficiency() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 13: 대량 데이터 처리 ===");

        // Create 200 notes with 100 comments each = 20,000 total comments
        for i in 0..200 {
            create_note_with_comments(&vault, &format!("large_{}", i), 100);
        }

        let start = Instant::now();
        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();
        let index_time = start.elapsed();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: None,
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        println!(
            "20,000개 코멘트: 인덱싱 {:?}, 전체 쿼리 {:?}, 결과 {}개",
            index_time, query_time, results.len()
        );

        assert_eq!(results.len(), 20_000);
        assert!(
            index_time < Duration::from_secs(30),
            "20000개 코멘트 인덱싱이 30초를 초과: {:?}",
            index_time
        );
        assert!(
            query_time < Duration::from_millis(200),
            "20000개 코멘트 쿼리가 200ms를 초과: {:?}",
            query_time
        );
    }

    // ==========================================
    // 결과 요약 출력
    // ==========================================
    #[test]
    fn test_99_summary() {
        println!("\n");
        println!("========================================");
        println!("  Memo (Comment) 병목 테스트 완료");
        println!("========================================");
        println!("잠재적 병목 지점:");
        println!("  1. 파일 I/O: read_comments, write_comments");
        println!("  2. JSON 파싱: serde_json::from_str");
        println!("  3. Mutex lock: query_memos의 전체 스캔");
        println!("  4. full_reindex: 대형 vault 전체 스캔");
        println!("");
        println!("권장 최적화:");
        println!("  - note_path 필터 시 O(1) 조회 (HashMap 직접 접근)");
        println!("  - 비동기 파일 I/O (tokio::fs)");
        println!("  - 날짜별 인덱스 추가 시 O(n) → O(log n)");
        println!("========================================");
    }
}
