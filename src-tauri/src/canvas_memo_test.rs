// Canvas (스케치) 노트 메모 기능 통합 테스트
// 일반 노트와 Canvas 노트 모두에서 메모가 정상 작동하는지 검증

#[cfg(test)]
mod canvas_memo_tests {
    use crate::memo::{MemoIndex, MemoQueryFilter};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{Duration, Instant};
    use tempfile::TempDir;

    // ==========================================
    // 헬퍼 함수들
    // ==========================================

    fn create_regular_note(vault: &PathBuf, name: &str, content: &str) -> PathBuf {
        let note_path = vault.join(format!("{}.md", name));
        let note_content = format!(r#"---
title: {}
created: 2025-01-01
modified: 2025-01-01
---

{}
"#, name, content);
        fs::write(&note_path, &note_content).unwrap();
        note_path
    }

    fn create_canvas_note(vault: &PathBuf, name: &str, nodes: Vec<(&str, &str)>) -> PathBuf {
        let note_path = vault.join(format!("{}.md", name));

        // Create canvas JSON body
        let nodes_json: Vec<String> = nodes.iter().enumerate().map(|(i, (id, text))| {
            format!(r#"{{"id":"{}","type":"text","x":{},"y":{},"width":200,"height":100,"text":"{}"}}"#,
                id, i * 250, i * 150, text)
        }).collect();

        let canvas_json = format!(r#"{{"nodes":[{}],"edges":[]}}"#, nodes_json.join(","));

        let note_content = format!(r#"---
title: {}
created: 2025-01-01
modified: 2025-01-01
canvas: true
---

{}"#, name, canvas_json);
        fs::write(&note_path, &note_content).unwrap();
        note_path
    }

    fn create_comments_for_note(vault: &PathBuf, note_name: &str, comments: Vec<serde_json::Value>) {
        let att_dir = vault.join(format!("{}_att", note_name));
        fs::create_dir_all(&att_dir).unwrap();
        let comments_path = att_dir.join("comments.json");
        fs::write(&comments_path, serde_json::to_string(&comments).unwrap()).unwrap();
    }

    fn create_regular_comment(id: &str, content: &str, from: usize, to: usize, anchor: &str) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "content": content,
            "position": { "from": from, "to": to },
            "anchorText": anchor,
            "created": "2025-01-01",
            "createdTime": "2025-01-01T12:00:00Z",
            "resolved": false
        })
    }

    fn create_canvas_comment(id: &str, content: &str, node_id: &str, from: usize, to: usize, anchor: &str) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "content": content,
            "position": { "from": from, "to": to },
            "anchorText": anchor,
            "created": "2025-01-01",
            "createdTime": "2025-01-01T12:00:00Z",
            "resolved": false,
            "canvasNodeId": node_id,
            "canvasTextPosition": { "from": from, "to": to }
        })
    }

    // ==========================================
    // Test 1: 일반 노트 메모 기본 기능
    // ==========================================
    #[test]
    fn test_01_regular_note_memo_basic() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 1: 일반 노트 메모 기본 기능 ===");

        let note_path = create_regular_note(&vault, "regular_test", "이것은 테스트 문장입니다.");

        let comments = vec![
            create_regular_comment("c1", "메모 내용", 50, 60, "테스트"),
        ];
        create_comments_for_note(&vault, "regular_test", comments);

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: Some(note_path.to_str().unwrap().to_string()),
        };

        let results = memo_index.query_memos(&filter).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "메모 내용");
        assert_eq!(results[0].anchor_text, "테스트");

        println!("✓ 일반 노트 메모 생성 및 조회 성공");
    }

    // ==========================================
    // Test 2: Canvas 노트 메모 기본 기능
    // ==========================================
    #[test]
    fn test_02_canvas_note_memo_basic() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 2: Canvas 노트 메모 기본 기능 ===");

        let note_path = create_canvas_note(&vault, "canvas_test", vec![
            ("node-1", "Canvas 노드 텍스트입니다."),
            ("node-2", "두 번째 노드 텍스트"),
        ]);

        let comments = vec![
            create_canvas_comment("c1", "Canvas 메모", "node-1", 0, 6, "Canvas"),
            create_canvas_comment("c2", "노드 메모", "node-2", 0, 5, "두 번째"),
        ];
        create_comments_for_note(&vault, "canvas_test", comments);

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: Some(note_path.to_str().unwrap().to_string()),
        };

        let results = memo_index.query_memos(&filter).unwrap();
        assert_eq!(results.len(), 2);

        println!("✓ Canvas 노트 메모 생성 및 조회 성공 ({}개)", results.len());
    }

    // ==========================================
    // Test 3: 혼합 환경 - 일반 + Canvas 노트
    // ==========================================
    #[test]
    fn test_03_mixed_notes() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 3: 혼합 환경 테스트 ===");

        // 일반 노트 10개
        for i in 0..10 {
            let note_path = create_regular_note(&vault, &format!("regular_{}", i), "테스트 내용입니다.");
            let comments = vec![
                create_regular_comment(&format!("r{}", i), &format!("일반 메모 {}", i), 10, 20, "테스트"),
            ];
            create_comments_for_note(&vault, &format!("regular_{}", i), comments);
        }

        // Canvas 노트 10개
        for i in 0..10 {
            let note_path = create_canvas_note(&vault, &format!("canvas_{}", i), vec![
                (&format!("node-{}", i), "Canvas 노드 텍스트"),
            ]);
            let comments = vec![
                create_canvas_comment(&format!("c{}", i), &format!("Canvas 메모 {}", i), &format!("node-{}", i), 0, 6, "Canvas"),
            ];
            create_comments_for_note(&vault, &format!("canvas_{}", i), comments);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());

        let start = Instant::now();
        memo_index.full_reindex().unwrap();
        let reindex_time = start.elapsed();

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

        assert_eq!(results.len(), 20); // 10 regular + 10 canvas

        println!("✓ 혼합 환경: 20개 노트 재인덱싱 {:?}, 쿼리 {:?}", reindex_time, query_time);

        assert!(reindex_time < Duration::from_secs(1), "재인덱싱이 1초를 초과");
        assert!(query_time < Duration::from_millis(10), "쿼리가 10ms를 초과");
    }

    // ==========================================
    // Test 4: Canvas 노드별 메모 분리
    // ==========================================
    #[test]
    fn test_04_canvas_node_separation() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 4: Canvas 노드별 메모 분리 ===");

        let note_path = create_canvas_note(&vault, "multi_node", vec![
            ("node-a", "노드 A 텍스트"),
            ("node-b", "노드 B 텍스트"),
            ("node-c", "노드 C 텍스트"),
        ]);

        let comments = vec![
            create_canvas_comment("c1", "노드 A 메모 1", "node-a", 0, 4, "노드 A"),
            create_canvas_comment("c2", "노드 A 메모 2", "node-a", 5, 10, "텍스트"),
            create_canvas_comment("c3", "노드 B 메모", "node-b", 0, 4, "노드 B"),
            create_canvas_comment("c4", "노드 C 메모", "node-c", 0, 4, "노드 C"),
        ];
        create_comments_for_note(&vault, "multi_node", comments);

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: Some(note_path.to_str().unwrap().to_string()),
        };

        let results = memo_index.query_memos(&filter).unwrap();
        assert_eq!(results.len(), 4);

        // Verify each comment has correct anchor text
        let node_a_memos: Vec<_> = results.iter().filter(|m| m.anchor_text.starts_with("노드 A") || m.anchor_text == "텍스트").collect();
        assert_eq!(node_a_memos.len(), 2);

        println!("✓ 3개 노드에서 4개 메모 정상 관리");
    }

    // ==========================================
    // Test 5: 대량 Canvas 노드 성능
    // ==========================================
    #[test]
    fn test_05_large_canvas_performance() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 5: 대량 Canvas 노드 성능 ===");

        // 100개 노드가 있는 Canvas 노트
        // Create canvas note manually for 100 nodes
        let note_path = vault.join("large_canvas.md");
        let nodes_json: Vec<String> = (0..100).map(|i| {
            format!(r#"{{"id":"node-{}","type":"text","x":{},"y":{},"width":200,"height":100,"text":"노드 {} 텍스트 내용입니다."}}"#,
                i, (i % 10) * 250, (i / 10) * 150, i)
        }).collect();
        let canvas_json = format!(r#"{{"nodes":[{}],"edges":[]}}"#, nodes_json.join(","));
        let note_content = format!(r#"---
title: Large Canvas
created: 2025-01-01
canvas: true
---

{}"#, canvas_json);
        fs::write(&note_path, &note_content).unwrap();

        // Create comments for each node
        let comments: Vec<serde_json::Value> = (0..100).map(|i| {
            create_canvas_comment(
                &format!("c{}", i),
                &format!("메모 {}", i),
                &format!("node-{}", i),
                0, 4, "노드"
            )
        }).collect();
        create_comments_for_note(&vault, "large_canvas", comments);

        let memo_index = MemoIndex::new(vault.to_str().unwrap());

        let start = Instant::now();
        memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();
        let index_time = start.elapsed();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: Some(note_path.to_str().unwrap().to_string()),
        };

        let start = Instant::now();
        let results = memo_index.query_memos(&filter).unwrap();
        let query_time = start.elapsed();

        assert_eq!(results.len(), 100);

        println!("✓ 100개 노드 Canvas: 인덱싱 {:?}, 쿼리 {:?}", index_time, query_time);

        assert!(index_time < Duration::from_millis(100), "100개 노드 인덱싱이 100ms를 초과");
        assert!(query_time < Duration::from_millis(5), "100개 메모 쿼리가 5ms를 초과");
    }

    // ==========================================
    // Test 6: Task 메모 (일반 + Canvas)
    // ==========================================
    #[test]
    fn test_06_task_memos_mixed() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 6: Task 메모 혼합 테스트 ===");

        // 일반 노트 task
        create_regular_note(&vault, "regular_task", "할일 목록입니다.");
        let mut regular_comment = create_regular_comment("rt1", "일반 할일", 0, 4, "할일");
        regular_comment["task"] = serde_json::json!({
            "summary": "일반 할일",
            "dueDate": "2025-01-15",
            "dueTime": "14:00"
        });
        create_comments_for_note(&vault, "regular_task", vec![regular_comment]);

        // Canvas 노트 task
        create_canvas_note(&vault, "canvas_task", vec![
            ("node-task", "Canvas 할일 내용"),
        ]);
        let mut canvas_comment = create_canvas_comment("ct1", "Canvas 할일", "node-task", 0, 6, "Canvas");
        canvas_comment["task"] = serde_json::json!({
            "summary": "Canvas 할일",
            "dueDate": "2025-01-20",
            "dueTime": "10:00"
        });
        create_comments_for_note(&vault, "canvas_task", vec![canvas_comment]);

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        // Query tasks only
        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: true,
            completed: None,
            note_path: None,
        };

        let results = memo_index.query_memos(&filter).unwrap();
        assert_eq!(results.len(), 2);

        // Verify both have task data
        assert!(results.iter().all(|m| m.task.is_some()));

        println!("✓ 일반/Canvas Task 메모 모두 정상 조회 ({}개)", results.len());
    }

    // ==========================================
    // Test 7: 날짜 필터 (일반 + Canvas)
    // ==========================================
    #[test]
    fn test_07_date_filter_mixed() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 7: 날짜 필터 혼합 테스트 ===");

        // 다양한 날짜의 메모 생성
        create_regular_note(&vault, "note1", "내용");
        let mut c1 = create_regular_comment("r1", "1월 메모", 0, 2, "내");
        c1["created"] = serde_json::json!("2025-01-05");
        create_comments_for_note(&vault, "note1", vec![c1]);

        create_canvas_note(&vault, "note2", vec![("n1", "Canvas")]);
        let mut c2 = create_canvas_comment("c1", "1월 Canvas 메모", "n1", 0, 6, "Canvas");
        c2["created"] = serde_json::json!("2025-01-10");
        create_comments_for_note(&vault, "note2", vec![c2]);

        create_regular_note(&vault, "note3", "내용");
        let mut c3 = create_regular_comment("r2", "2월 메모", 0, 2, "내");
        c3["created"] = serde_json::json!("2025-02-15");
        create_comments_for_note(&vault, "note3", vec![c3]);

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        // 1월만 필터
        let filter = MemoQueryFilter {
            start_date: Some("2025-01-01".to_string()),
            end_date: Some("2025-01-31".to_string()),
            tasks_only: false,
            completed: None,
            note_path: None,
        };

        let results = memo_index.query_memos(&filter).unwrap();
        assert_eq!(results.len(), 2); // 1월 메모 2개 (일반 + Canvas)

        println!("✓ 날짜 필터 정상 작동: 1월 메모 {}개", results.len());
    }

    // ==========================================
    // Test 8: 동시 접근 시뮬레이션
    // ==========================================
    #[test]
    fn test_08_concurrent_access() {
        use std::thread;
        use std::sync::Arc;

        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 8: 동시 접근 시뮬레이션 ===");

        // 50개 혼합 노트 생성
        for i in 0..25 {
            create_regular_note(&vault, &format!("reg_{}", i), "테스트");
            let c = create_regular_comment(&format!("r{}", i), "메모", 0, 4, "테스트");
            create_comments_for_note(&vault, &format!("reg_{}", i), vec![c]);
        }
        for i in 0..25 {
            create_canvas_note(&vault, &format!("can_{}", i), vec![("n1", "Canvas")]);
            let c = create_canvas_comment(&format!("c{}", i), "메모", "n1", 0, 6, "Canvas");
            create_comments_for_note(&vault, &format!("can_{}", i), vec![c]);
        }

        let memo_index = Arc::new(MemoIndex::new(vault.to_str().unwrap()));
        memo_index.full_reindex().unwrap();

        let mut handles = Vec::new();

        // 10개 스레드에서 동시 쿼리
        for thread_id in 0..10 {
            let index = Arc::clone(&memo_index);
            let handle = thread::spawn(move || {
                let mut times = Vec::new();
                for _ in 0..100 {
                    let filter = MemoQueryFilter {
                        start_date: None,
                        end_date: None,
                        tasks_only: thread_id % 2 == 0,
                        completed: None,
                        note_path: None,
                    };
                    let start = Instant::now();
                    let results = index.query_memos(&filter).unwrap();
                    times.push(start.elapsed());

                    // Verify results
                    if thread_id % 2 == 0 {
                        assert!(results.is_empty() || results.iter().all(|m| m.task.is_some()));
                    } else {
                        assert!(results.len() <= 50);
                    }
                }
                times.iter().sum::<Duration>() / times.len() as u32
            });
            handles.push(handle);
        }

        let avg_times: Vec<Duration> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        let overall_avg: Duration = avg_times.iter().sum::<Duration>() / avg_times.len() as u32;

        println!("✓ 10개 스레드 동시 쿼리: 평균 {:?}", overall_avg);

        assert!(overall_avg < Duration::from_millis(5), "동시 접근 평균이 5ms를 초과");
    }

    // ==========================================
    // Test 9: 빈 Canvas 노트
    // ==========================================
    #[test]
    fn test_09_empty_canvas() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 9: 빈 Canvas 노트 ===");

        // 노드 없는 Canvas
        let note_path = vault.join("empty_canvas.md");
        let note_content = r#"---
title: Empty Canvas
created: 2025-01-01
canvas: true
---

{"nodes":[],"edges":[]}"#;
        fs::write(&note_path, note_content).unwrap();

        // 코멘트 없음
        let att_dir = vault.join("empty_canvas_att");
        fs::create_dir_all(&att_dir).unwrap();
        fs::write(att_dir.join("comments.json"), "[]").unwrap();

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.index_note_memos(note_path.to_str().unwrap()).unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: Some(note_path.to_str().unwrap().to_string()),
        };

        let results = memo_index.query_memos(&filter).unwrap();
        assert_eq!(results.len(), 0);

        println!("✓ 빈 Canvas 노트 정상 처리");
    }

    // ==========================================
    // Test 10: 특수 문자 처리
    // ==========================================
    #[test]
    fn test_10_special_characters() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 10: 특수 문자 처리 ===");

        // 특수 문자가 포함된 텍스트
        create_canvas_note(&vault, "special_chars", vec![
            ("node-1", "한글 테스트 🎉 emoji"),
            ("node-2", "\"따옴표\" & <태그>"),
            ("node-3", "줄바꿈\n포함\n텍스트"),
        ]);

        let comments = vec![
            create_canvas_comment("c1", "이모지 메모 🚀", "node-1", 0, 2, "한글"),
            create_canvas_comment("c2", "특수문자 메모", "node-2", 0, 5, "\"따옴표\""),
            create_canvas_comment("c3", "줄바꿈 메모", "node-3", 0, 3, "줄바꿈"),
        ];
        create_comments_for_note(&vault, "special_chars", comments);

        let memo_index = MemoIndex::new(vault.to_str().unwrap());
        memo_index.full_reindex().unwrap();

        let filter = MemoQueryFilter {
            start_date: None,
            end_date: None,
            tasks_only: false,
            completed: None,
            note_path: None,
        };

        let results = memo_index.query_memos(&filter).unwrap();
        assert_eq!(results.len(), 3);

        // Verify special characters preserved
        assert!(results.iter().any(|m| m.content.contains("🚀")));
        assert!(results.iter().any(|m| m.anchor_text.contains("\"따옴표\"")));

        println!("✓ 특수 문자 정상 처리 (이모지, 따옴표, 줄바꿈)");
    }

    // ==========================================
    // Test 11: 대량 데이터 스트레스 테스트
    // ==========================================
    #[test]
    fn test_11_stress_test() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 11: 대량 데이터 스트레스 테스트 ===");

        // 100개 일반 노트 + 100개 Canvas 노트 = 200개 노트
        // 각 노트에 10개 메모 = 2000개 메모

        for i in 0..100 {
            create_regular_note(&vault, &format!("stress_reg_{}", i), "스트레스 테스트 내용입니다.");
            let comments: Vec<_> = (0..10).map(|j| {
                create_regular_comment(&format!("sr{}_{}", i, j), &format!("메모 {}-{}", i, j), 0, 6, "스트레스")
            }).collect();
            create_comments_for_note(&vault, &format!("stress_reg_{}", i), comments);
        }

        for i in 0..100 {
            // Create canvas note manually
            let note_path = vault.join(format!("stress_can_{}.md", i));
            let canvas_json = r#"{"nodes":[{"id":"n1","type":"text","x":0,"y":0,"width":200,"height":100,"text":"Canvas 스트레스 테스트"}],"edges":[]}"#;
            let note_content = format!(r#"---
title: Stress Canvas {}
canvas: true
---

{}"#, i, canvas_json);
            fs::write(&note_path, note_content).unwrap();

            let comments: Vec<_> = (0..10).map(|j| {
                create_canvas_comment(&format!("sc{}_{}", i, j), &format!("Canvas 메모 {}-{}", i, j), "n1", 0, 6, "Canvas")
            }).collect();
            create_comments_for_note(&vault, &format!("stress_can_{}", i), comments);
        }

        let memo_index = MemoIndex::new(vault.to_str().unwrap());

        let start = Instant::now();
        memo_index.full_reindex().unwrap();
        let reindex_time = start.elapsed();

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

        assert_eq!(results.len(), 2000);

        println!("✓ 스트레스 테스트: 200개 노트, 2000개 메모");
        println!("  재인덱싱: {:?}", reindex_time);
        println!("  전체 쿼리: {:?}", query_time);

        assert!(reindex_time < Duration::from_secs(10), "재인덱싱이 10초를 초과");
        assert!(query_time < Duration::from_millis(100), "2000개 메모 쿼리가 100ms를 초과");
    }

    // ==========================================
    // 결과 요약
    // ==========================================
    #[test]
    fn test_99_summary() {
        println!("\n");
        println!("========================================");
        println!("  Canvas 메모 통합 테스트 완료");
        println!("========================================");
        println!("검증 항목:");
        println!("  1. 일반 노트 메모 기본 기능");
        println!("  2. Canvas 노트 메모 기본 기능");
        println!("  3. 혼합 환경 (일반 + Canvas)");
        println!("  4. Canvas 노드별 메모 분리");
        println!("  5. 대량 Canvas 노드 성능");
        println!("  6. Task 메모 (일반 + Canvas)");
        println!("  7. 날짜 필터 혼합");
        println!("  8. 동시 접근 시뮬레이션");
        println!("  9. 빈 Canvas 노트");
        println!("  10. 특수 문자 처리");
        println!("  11. 대량 데이터 스트레스 테스트");
        println!("========================================");
    }
}
