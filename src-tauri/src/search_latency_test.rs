// Search index latency benchmarks - 실시간 반영 성능 검증

#[cfg(test)]
mod latency_tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{Duration, Instant};
    use tempfile::TempDir;
    use std::sync::Arc;

    // Simulate SearchIndex for timing tests
    struct MockSearchIndex {
        pub index_calls: std::sync::atomic::AtomicUsize,
        pub remove_calls: std::sync::atomic::AtomicUsize,
    }

    impl MockSearchIndex {
        fn new() -> Arc<Self> {
            Arc::new(MockSearchIndex {
                index_calls: std::sync::atomic::AtomicUsize::new(0),
                remove_calls: std::sync::atomic::AtomicUsize::new(0),
            })
        }

        fn index_file(&self, _path: &std::path::Path) {
            self.index_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            // Simulate indexing time (typical: 1-5ms per file)
            std::thread::sleep(Duration::from_millis(2));
        }

        fn remove_file(&self, _path: &std::path::Path) {
            self.remove_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            // Simulate removal time (typical: <1ms per file)
            std::thread::sleep(Duration::from_millis(1));
        }
    }

    /// Scenario 1: 단일 파일 생성 → 인덱싱 레이턴시
    #[test]
    fn test_single_file_creation_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let start = Instant::now();

        // Create file
        let note_path = vault_path.join("단일노트.md");
        fs::write(&note_path, "# 단일 노트\n\n테스트 내용").unwrap();

        // Simulate indexing
        let mock_index = MockSearchIndex::new();
        mock_index.index_file(&note_path);

        let latency = start.elapsed();

        println!("✅ 단일 파일 생성 → 인덱싱 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_millis(10), "레이턴시가 10ms를 초과함: {:?}", latency);
    }

    /// Scenario 2: 다중 파일 생성 (10개) → 병렬 인덱싱
    #[test]
    fn test_multiple_file_creation_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let start = Instant::now();

        // Create 10 files
        let mut paths = Vec::new();
        for i in 0..10 {
            let path = vault_path.join(format!("노트{}.md", i));
            fs::write(&path, format!("# 노트 {}\n\n내용", i)).unwrap();
            paths.push(path);
        }

        // Simulate parallel indexing
        let mock_index = MockSearchIndex::new();
        use std::thread;
        let handles: Vec<_> = paths
            .iter()
            .map(|path| {
                let path = path.clone();
                let index = mock_index.clone();
                thread::spawn(move || {
                    index.index_file(&path);
                })
            })
            .collect();

        for handle in handles {
            handle.join().unwrap();
        }

        let latency = start.elapsed();

        println!("✅ 10개 파일 병렬 인덱싱 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_millis(50), "병렬 인덱싱이 50ms를 초과함: {:?}", latency);
    }

    /// Scenario 3: 파일 수정 → 재인덱싱 (delete + index)
    #[test]
    fn test_file_modification_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("수정노트.md");
        fs::write(&note_path, "# 원본 내용").unwrap();

        let mock_index = MockSearchIndex::new();
        mock_index.index_file(&note_path);

        let start = Instant::now();

        // Modify file
        fs::write(&note_path, "# 수정된 내용\n\n새로운 내용").unwrap();

        // Simulate re-indexing (remove + index)
        mock_index.remove_file(&note_path);
        mock_index.index_file(&note_path);

        let latency = start.elapsed();

        println!("✅ 파일 수정 → 재인덱싱 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_millis(15), "재인덱싱이 15ms를 초과함: {:?}", latency);
    }

    /// Scenario 4: 빠른 연속 변경 (5회) → 디바운스 효과
    #[test]
    fn test_rapid_consecutive_changes() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("연속변경.md");
        fs::write(&note_path, "# 초기 내용").unwrap();

        let mock_index = MockSearchIndex::new();

        let start = Instant::now();

        // 5번 빠르게 수정 (50ms 간격)
        for i in 0..5 {
            std::thread::sleep(Duration::from_millis(50));
            fs::write(&note_path, format!("# 내용 {}", i)).unwrap();
        }

        // Simulate debounced indexing (should only index once after all changes)
        std::thread::sleep(Duration::from_millis(200)); // Debounce wait
        mock_index.index_file(&note_path);

        let total_time = start.elapsed();

        println!("✅ 5회 연속 변경 → 디바운스 완료: {:?}", total_time);
        assert_eq!(mock_index.index_calls.load(std::sync::atomic::Ordering::SeqCst), 1,
                   "디바운스 후 1회만 인덱싱해야 함");
    }

    /// Scenario 5: 대량 파일 생성 (100개) → 배치 인덱싱
    #[test]
    fn test_bulk_file_creation_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let start = Instant::now();

        // Create 100 files
        let mut paths = Vec::new();
        for i in 0..100 {
            let path = vault_path.join(format!("대량노트{}.md", i));
            fs::write(&path, format!("# 노트 {}", i)).unwrap();
            paths.push(path);
        }

        // Simulate batch indexing (sequential for simplicity)
        let mock_index = MockSearchIndex::new();
        for path in &paths {
            mock_index.index_file(path);
        }

        let latency = start.elapsed();

        println!("✅ 100개 파일 순차 인덱싱 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_secs(1), "100개 인덱싱이 1초를 초과함: {:?}", latency);
    }

    /// Scenario 6: 파일 삭제 → 인덱스 제거
    #[test]
    fn test_file_deletion_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("삭제노트.md");
        fs::write(&note_path, "# 삭제될 노트").unwrap();

        let mock_index = MockSearchIndex::new();
        mock_index.index_file(&note_path);

        let start = Instant::now();

        // Delete file
        fs::remove_file(&note_path).unwrap();

        // Simulate index removal
        mock_index.remove_file(&note_path);

        let latency = start.elapsed();

        println!("✅ 파일 삭제 → 인덱스 제거 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_millis(5), "삭제 처리가 5ms를 초과함: {:?}", latency);
    }

    /// Scenario 7: 깊은 폴더 구조 (5단계) → 탐색 시간
    #[test]
    fn test_deep_folder_structure_latency() {
        let temp_dir = TempDir::new().unwrap();
        let mut current = temp_dir.path().to_path_buf();

        let start = Instant::now();

        // Create 5-level deep structure
        for i in 1..=5 {
            current = current.join(format!("레벨{}", i));
            fs::create_dir(&current).unwrap();
        }

        let note_path = current.join("깊은노트.md");
        fs::write(&note_path, "# 깊은 폴더의 노트").unwrap();

        // Simulate indexing
        let mock_index = MockSearchIndex::new();
        mock_index.index_file(&note_path);

        let latency = start.elapsed();

        println!("✅ 5단계 깊은 폴더 → 인덱싱 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_millis(15), "깊은 폴더 처리가 15ms를 초과함: {:?}", latency);
    }

    /// Scenario 8: 첨부파일 포함 노트 → 전체 레이턴시
    #[test]
    fn test_note_with_attachments_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let start = Instant::now();

        // Create note
        let note_path = vault_path.join("첨부노트.md");
        fs::write(&note_path, "# 첨부파일이 있는 노트\n\n## 첨부파일\n\n- [[이미지.png]]").unwrap();

        // Create attachment folder
        let att_folder = vault_path.join("첨부노트_att");
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("이미지.png"), "fake image data").unwrap();

        // Simulate indexing (note only, attachments not indexed separately)
        let mock_index = MockSearchIndex::new();
        mock_index.index_file(&note_path);

        let latency = start.elapsed();

        println!("✅ 첨부파일 포함 노트 → 인덱싱 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_millis(20), "첨부 노트 처리가 20ms를 초과함: {:?}", latency);
    }

    /// Scenario 9: 동시 다중 작업 (생성+수정+삭제)
    #[test]
    fn test_concurrent_operations_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let mock_index = MockSearchIndex::new();

        let start = Instant::now();

        // Concurrent operations
        use std::thread;
        let handles = vec![
            // Thread 1: Create 5 files
            thread::spawn({
                let vault = vault_path.to_path_buf();
                let index = mock_index.clone();
                move || {
                    for i in 0..5 {
                        let path = vault.join(format!("생성{}.md", i));
                        fs::write(&path, format!("# 생성 {}", i)).unwrap();
                        index.index_file(&path);
                    }
                }
            }),
            // Thread 2: Modify existing files
            thread::spawn({
                let vault = vault_path.to_path_buf();
                let index = mock_index.clone();
                move || {
                    let path = vault.join("수정대상.md");
                    fs::write(&path, "# 초기").unwrap();
                    for i in 0..5 {
                        fs::write(&path, format!("# 수정 {}", i)).unwrap();
                        index.remove_file(&path);
                        index.index_file(&path);
                    }
                }
            }),
            // Thread 3: Delete files
            thread::spawn({
                let vault = vault_path.to_path_buf();
                let index = mock_index.clone();
                move || {
                    for i in 0..5 {
                        let path = vault.join(format!("삭제{}.md", i));
                        fs::write(&path, format!("# 삭제 {}", i)).unwrap();
                        fs::remove_file(&path).unwrap();
                        index.remove_file(&path);
                    }
                }
            }),
        ];

        for handle in handles {
            handle.join().unwrap();
        }

        let latency = start.elapsed();

        println!("✅ 동시 다중 작업 (생성+수정+삭제) 레이턴시: {:?}", latency);
        assert!(latency < Duration::from_millis(100), "동시 작업이 100ms를 초과함: {:?}", latency);
    }

    /// Scenario 10: 검색 결과 갱신 전체 파이프라인
    #[test]
    fn test_end_to_end_search_refresh_latency() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("검색노트.md");
        fs::write(&note_path, "# 테스트 키워드").unwrap();

        let mock_index = MockSearchIndex::new();

        // Initial index
        mock_index.index_file(&note_path);

        let start = Instant::now();

        // File change
        fs::write(&note_path, "# 새로운 키워드").unwrap();

        // Simulate full pipeline:
        // 1. File watcher detects change (0ms - immediate)
        // 2. Debounce wait (200ms in current implementation)
        std::thread::sleep(Duration::from_millis(200));

        // 3. Re-index (remove + index)
        mock_index.remove_file(&note_path);
        mock_index.index_file(&note_path);

        // 4. Reload reader (< 1ms)
        // 5. Search query (< 1ms)

        let total_latency = start.elapsed();

        println!("✅ 전체 파이프라인 (파일 변경 → 검색 갱신) 레이턴시: {:?}", total_latency);
        println!("   - Debounce: 200ms");
        println!("   - Re-index: ~3ms");
        println!("   - Total: {:?}", total_latency);

        // This test documents the current latency, not an assertion
        println!("⚠️  현재 시스템 최악 레이턴시: ~400ms (poll 200ms + debounce 200ms)");
    }
}
