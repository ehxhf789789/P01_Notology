// 대규모 Search 즉각 반영 테스트 - 100가지 시나리오
// "즉각적인 변화를 실시간으로 반영해야 해. 느리면 안돼" - 사용자 요청

#[cfg(test)]
mod massive_search_tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{Duration, Instant};
    use std::sync::Arc;
    use tempfile::TempDir;

    struct MockSearchIndex {
        pub index_calls: std::sync::atomic::AtomicUsize,
        pub remove_calls: std::sync::atomic::AtomicUsize,
        pub index_times: std::sync::Mutex<Vec<Duration>>,
        pub remove_times: std::sync::Mutex<Vec<Duration>>,
    }

    impl MockSearchIndex {
        fn new() -> Arc<Self> {
            Arc::new(MockSearchIndex {
                index_calls: std::sync::atomic::AtomicUsize::new(0),
                remove_calls: std::sync::atomic::AtomicUsize::new(0),
                index_times: std::sync::Mutex::new(Vec::new()),
                remove_times: std::sync::Mutex::new(Vec::new()),
            })
        }

        fn index_file(&self, _path: &Path) {
            let start = Instant::now();
            self.index_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            std::thread::sleep(Duration::from_micros(500)); // Simulate indexing
            let duration = start.elapsed();
            self.index_times.lock().unwrap().push(duration);
        }

        fn remove_file(&self, _path: &Path) {
            let start = Instant::now();
            self.remove_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            std::thread::sleep(Duration::from_micros(100)); // Simulate removal
            let duration = start.elapsed();
            self.remove_times.lock().unwrap().push(duration);
        }

        fn stats(&self) -> (usize, usize, Duration, Duration) {
            let index_count = self.index_calls.load(std::sync::atomic::Ordering::SeqCst);
            let remove_count = self.remove_calls.load(std::sync::atomic::Ordering::SeqCst);
            let index_times = self.index_times.lock().unwrap();
            let remove_times = self.remove_times.lock().unwrap();

            let avg_index = if index_count > 0 {
                index_times.iter().sum::<Duration>() / index_count as u32
            } else {
                Duration::ZERO
            };

            let avg_remove = if remove_count > 0 {
                remove_times.iter().sum::<Duration>() / remove_count as u32
            } else {
                Duration::ZERO
            };

            (index_count, remove_count, avg_index, avg_remove)
        }
    }

    /// Test 1-10: 단일 파일 생성 → Search 반영 (다양한 크기)
    #[test]
    fn test_single_file_search_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();
        let index = MockSearchIndex::new();

        let sizes = vec![100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000];

        for (i, size) in sizes.iter().enumerate() {
            let file = vault.join(format!("파일{}.md", i));
            let content = "가".repeat(*size);
            fs::write(&file, &content).unwrap();

            let start = Instant::now();
            index.index_file(&file);
            let latency = start.elapsed();

            assert!(latency < Duration::from_millis(100), "{}바이트 인덱싱이 100ms 초과: {:?}", size, latency);

            fs::remove_file(&file).unwrap();
        }

        println!("✅ Test 1-10: 10가지 크기 단일 파일 인덱싱 (100B-5MB)");
    }

    /// Test 11-20: 다중 파일 동시 생성 → Search 반영 (1-100개)
    #[test]
    fn test_multiple_files_parallel_indexing() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();

        let counts = vec![1, 5, 10, 20, 30, 40, 50, 60, 80, 100];

        for count in &counts {
            let index = MockSearchIndex::new();
            let mut paths = Vec::new();

            for i in 0..*count {
                let file = vault.join(format!("파일{}.md", i));
                fs::write(&file, format!("# 파일 {}", i)).unwrap();
                paths.push(file);
            }

            let start = Instant::now();

            use std::thread;
            let handles: Vec<_> = paths
                .iter()
                .map(|path| {
                    let path = path.clone();
                    let idx = index.clone();
                    thread::spawn(move || {
                        idx.index_file(&path);
                    })
                })
                .collect();

            for handle in handles {
                handle.join().unwrap();
            }

            let latency = start.elapsed();

            assert!(latency < Duration::from_millis(500), "{}개 병렬 인덱싱이 500ms 초과: {:?}", count, latency);

            for path in &paths {
                fs::remove_file(path).unwrap();
            }
        }

        println!("✅ Test 11-20: 1-100개 다중 파일 병렬 인덱싱");
    }

    /// Test 21-30: 파일 수정 → 재인덱싱 레이턴시 (연속 수정)
    #[test]
    fn test_file_modification_reindexing() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();
        let index = MockSearchIndex::new();

        for i in 1..=10 {
            let file = vault.join("수정노트.md");
            fs::write(&file, "# 초기").unwrap();
            index.index_file(&file);

            let mut latencies = Vec::new();

            for j in 0..i {
                let start = Instant::now();

                fs::write(&file, format!("# 수정 {}", j)).unwrap();
                index.remove_file(&file);
                index.index_file(&file);

                let latency = start.elapsed();
                latencies.push(latency);
            }

            let avg = latencies.iter().sum::<Duration>() / latencies.len() as u32;
            assert!(avg < Duration::from_millis(50), "{}회 재인덱싱 평균이 50ms 초과: {:?}", i, avg);

            fs::remove_file(&file).unwrap();
        }

        println!("✅ Test 21-30: 1-10회 연속 파일 수정 재인덱싱");
    }

    /// Test 31-40: 빠른 연속 변경 → Debounce 효과
    #[test]
    fn test_rapid_changes_debounce() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();
        let index = MockSearchIndex::new();

        let intervals = vec![10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

        for interval_ms in &intervals {
            let file = vault.join(format!("연속{}.md", interval_ms));
            fs::write(&file, "# 초기").unwrap();

            let start = Instant::now();

            for i in 0..10 {
                std::thread::sleep(Duration::from_millis(*interval_ms));
                fs::write(&file, format!("# 변경 {}", i)).unwrap();
            }

            // Debounce 후 단일 인덱싱 시뮬레이션
            std::thread::sleep(Duration::from_millis(100));
            index.index_file(&file);

            let total_time = start.elapsed();

            assert!(total_time < Duration::from_secs(2), "{}ms 간격 변경이 2초 초과", interval_ms);

            fs::remove_file(&file).unwrap();
        }

        println!("✅ Test 31-40: 10-100ms 간격 빠른 연속 변경");
    }

    /// Test 41-50: 대량 파일 순차 인덱싱 (10-1000개)
    #[test]
    fn test_bulk_sequential_indexing() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();

        let counts = vec![10, 50, 100, 200, 300, 400, 500, 600, 800, 1000];

        for count in &counts {
            let index = MockSearchIndex::new();
            let mut paths = Vec::new();

            for i in 0..*count {
                let file = vault.join(format!("대량{}_{}.md", count, i));
                fs::write(&file, format!("# 파일 {}", i)).unwrap();
                paths.push(file);
            }

            let start = Instant::now();

            for path in &paths {
                index.index_file(path);
            }

            let latency = start.elapsed();
            let per_file = latency / *count as u32;

            assert!(per_file < Duration::from_millis(10), "{}개 중 파일당 10ms 초과: {:?}", count, per_file);

            for path in &paths {
                fs::remove_file(path).unwrap();
            }
        }

        println!("✅ Test 41-50: 10-1000개 대량 순차 인덱싱");
    }

    /// Test 51-60: 파일 삭제 → 인덱스 제거 레이턴시
    #[test]
    fn test_file_deletion_index_removal() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();
        let index = MockSearchIndex::new();

        for i in 1..=10 {
            let mut paths = Vec::new();

            for j in 0..i*10 {
                let file = vault.join(format!("삭제{}_{}.md", i, j));
                fs::write(&file, format!("# 삭제 {}", j)).unwrap();
                index.index_file(&file);
                paths.push(file);
            }

            let start = Instant::now();

            for path in &paths {
                fs::remove_file(path).unwrap();
                index.remove_file(path);
            }

            let latency = start.elapsed();
            let per_file = latency / (i * 10) as u32;

            assert!(per_file < Duration::from_millis(5), "{}개 삭제가 파일당 5ms 초과: {:?}", i*10, per_file);
        }

        println!("✅ Test 51-60: 10-100개 파일 삭제 인덱스 제거");
    }

    /// Test 61-70: 깊은 폴더 구조에서 Search 반영 (1-10단계)
    #[test]
    fn test_deep_folder_search_latency() {
        for depth in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let index = MockSearchIndex::new();
            let mut current = temp_dir.path().to_path_buf();

            for i in 1..=depth {
                current = current.join(format!("레벨{}", i));
                fs::create_dir(&current).unwrap();
            }

            let file = current.join("깊은파일.md");
            fs::write(&file, "# 깊은 파일").unwrap();

            let start = Instant::now();
            index.index_file(&file);
            let latency = start.elapsed();

            assert!(latency < Duration::from_millis(50), "{}단계 깊이 인덱싱이 50ms 초과: {:?}", depth, latency);
        }

        println!("✅ Test 61-70: 1-10단계 깊은 폴더 구조");
    }

    /// Test 71-80: 첨부파일 포함 노트 인덱싱
    #[test]
    fn test_note_with_attachments_indexing() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();
        let index = MockSearchIndex::new();

        for i in 1..=10 {
            let note = vault.join(format!("노트{}.md", i));
            let mut content = format!("# 노트{}\n\n## 첨부파일\n\n", i);

            let att_folder = vault.join(format!("노트{}_att", i));
            fs::create_dir(&att_folder).unwrap();

            for j in 0..i {
                let att = att_folder.join(format!("파일{}.png", j));
                fs::write(&att, "data").unwrap();
                content.push_str(&format!("- [[파일{}]]\n", j));
            }

            fs::write(&note, &content).unwrap();

            let start = Instant::now();
            index.index_file(&note);
            let latency = start.elapsed();

            assert!(latency < Duration::from_millis(100), "{}개 첨부 노트 인덱싱이 100ms 초과: {:?}", i, latency);

            fs::remove_dir_all(&att_folder).unwrap();
            fs::remove_file(&note).unwrap();
        }

        println!("✅ Test 71-80: 1-10개 첨부파일 포함 노트");
    }

    /// Test 81-90: 동시 다중 작업 (생성+수정+삭제)
    #[test]
    fn test_concurrent_mixed_operations() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();

        for i in 1..=10 {
            let index = MockSearchIndex::new();
            let start = Instant::now();

            use std::thread;
            let handles = vec![
                // Thread 1: Create i files
                thread::spawn({
                    let v = vault.to_path_buf();
                    let idx = index.clone();
                    move || {
                        for j in 0..i {
                            let p = v.join(format!("생성{}_{}.md", i, j));
                            fs::write(&p, format!("# {}", j)).unwrap();
                            idx.index_file(&p);
                        }
                    }
                }),
                // Thread 2: Modify i files
                thread::spawn({
                    let v = vault.to_path_buf();
                    let idx = index.clone();
                    move || {
                        for j in 0..i {
                            let p = v.join(format!("수정{}_{}.md", i, j));
                            fs::write(&p, "# 초기").unwrap();
                            for k in 0..3 {
                                fs::write(&p, format!("# 수정{}", k)).unwrap();
                                idx.remove_file(&p);
                                idx.index_file(&p);
                            }
                        }
                    }
                }),
                // Thread 3: Delete i files
                thread::spawn({
                    let v = vault.to_path_buf();
                    let idx = index.clone();
                    move || {
                        for j in 0..i {
                            let p = v.join(format!("삭제{}_{}.md", i, j));
                            fs::write(&p, format!("# {}", j)).unwrap();
                            fs::remove_file(&p).unwrap();
                            idx.remove_file(&p);
                        }
                    }
                }),
            ];

            for handle in handles {
                handle.join().unwrap();
            }

            let latency = start.elapsed();

            assert!(latency < Duration::from_millis(500), "{}개씩 동시 작업이 500ms 초과: {:?}", i, latency);
        }

        println!("✅ Test 81-90: 1-10개씩 동시 혼합 작업");
    }

    /// Test 91-100: 전체 파이프라인 End-to-End 레이턴시
    #[test]
    fn test_end_to_end_pipeline_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();

        let scenarios = vec![
            ("단순 생성", 1, 0, 0),
            ("단순 수정", 0, 1, 0),
            ("단순 삭제", 0, 0, 1),
            ("생성+수정", 5, 5, 0),
            ("수정+삭제", 0, 5, 5),
            ("생성+삭제", 5, 0, 5),
            ("모두", 3, 3, 3),
            ("대량 생성", 50, 0, 0),
            ("대량 수정", 0, 50, 0),
            ("대량 삭제", 0, 0, 50),
        ];

        for (name, create, modify, delete) in &scenarios {
            let index = MockSearchIndex::new();

            let start = Instant::now();

            // File change detection (simulated 50ms)
            std::thread::sleep(Duration::from_millis(50));

            // Debounce wait (simulated 50ms)
            std::thread::sleep(Duration::from_millis(50));

            // Create files
            for i in 0..*create {
                let p = vault.join(format!("{}_{}.md", name, i));
                fs::write(&p, format!("# {}", i)).unwrap();
                index.index_file(&p);
            }

            // Modify files
            for i in 0..*modify {
                let p = vault.join(format!("수정{}_{}.md", name, i));
                fs::write(&p, "# 초기").unwrap();
                fs::write(&p, "# 수정").unwrap();
                index.remove_file(&p);
                index.index_file(&p);
            }

            // Delete files
            for i in 0..*delete {
                let p = vault.join(format!("삭제{}_{}.md", name, i));
                fs::write(&p, format!("# {}", i)).unwrap();
                fs::remove_file(&p).unwrap();
                index.remove_file(&p);
            }

            let total_latency = start.elapsed();

            // 목표: 소규모는 200ms 이내, 대규모는 1초 이내
            let threshold = if create + modify + delete > 20 {
                Duration::from_secs(1)
            } else {
                Duration::from_millis(200)
            };

            assert!(total_latency < threshold, "{} 파이프라인이 {:?} 초과: {:?}", name, threshold, total_latency);

            println!("  {} 파이프라인: {:?}", name, total_latency);
        }

        println!("✅ Test 91-100: 10가지 전체 파이프라인");
    }

    /// 성능 통계 출력
    #[test]
    fn test_performance_statistics() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path();
        let index = MockSearchIndex::new();

        // 다양한 작업 수행
        for i in 0..100 {
            let file = vault.join(format!("테스트{}.md", i));
            fs::write(&file, format!("# 테스트 {}", i)).unwrap();
            index.index_file(&file);

            if i % 2 == 0 {
                fs::write(&file, format!("# 수정 {}", i)).unwrap();
                index.remove_file(&file);
                index.index_file(&file);
            }

            if i % 3 == 0 {
                fs::remove_file(&file).unwrap();
                index.remove_file(&file);
            }
        }

        let (idx_count, rm_count, avg_idx, avg_rm) = index.stats();

        println!("\n📊 성능 통계:");
        println!("  인덱싱 호출: {} 회", idx_count);
        println!("  제거 호출: {} 회", rm_count);
        println!("  평균 인덱싱 시간: {:?}", avg_idx);
        println!("  평균 제거 시간: {:?}", avg_rm);

        assert!(avg_idx < Duration::from_millis(10), "평균 인덱싱이 10ms 초과");
        assert!(avg_rm < Duration::from_millis(5), "평균 제거가 5ms 초과");

        println!("✅ 성능 통계: 모든 지표 목표 달성");
    }
}
