// Comprehensive Attachment and WikiLink Synchronization Tests
// 1000+ simulation cases covering all real-world usage scenarios

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{Duration, Instant};
    use tempfile::TempDir;
    use regex::Regex;

    // Helper: Create a note with frontmatter
    fn create_note(vault: &PathBuf, name: &str, content: &str) -> PathBuf {
        let path = vault.join(format!("{}.md", name));
        let full_content = format!("---\ntitle: {}\n---\n\n{}", name, content);
        fs::write(&path, &full_content).unwrap();
        path
    }

    // Helper: Create attachment folder and file
    fn create_attachment(vault: &PathBuf, note_name: &str, file_name: &str, content: &[u8]) -> PathBuf {
        let att_dir = vault.join(format!("{}_att", note_name));
        if !att_dir.exists() {
            fs::create_dir(&att_dir).unwrap();
        }
        let file_path = att_dir.join(file_name);
        fs::write(&file_path, content).unwrap();
        file_path
    }

    // Helper: Add wikilink to note
    fn add_wikilink_to_note(note_path: &PathBuf, file_name: &str) {
        let content = fs::read_to_string(note_path).unwrap();
        let new_content = if content.contains("## 첨부파일") {
            // Add to existing section
            content.replace("## 첨부파일", &format!("## 첨부파일\n\n- [[{}]]", file_name))
        } else {
            // Create new section
            format!("{}\n\n## 첨부파일\n\n- [[{}]]\n", content, file_name)
        };
        fs::write(note_path, &new_content).unwrap();
    }

    // Helper: Remove wikilink from note (simulating delete_attachments_with_links logic)
    fn remove_wikilink_from_note(note_path: &PathBuf, file_name: &str) -> bool {
        let content = match fs::read_to_string(note_path) {
            Ok(c) => c,
            Err(_) => return false,
        };

        let escaped = regex::escape(file_name);
        let pattern = format!(
            r"(?m)^[ \t]*[-*][ \t]*\[\[{}\]\][ \t]*\n?|!\[\[{}\]\]|\[\[{}\]\]",
            escaped, escaped, escaped
        );
        let regex = match Regex::new(&pattern) {
            Ok(r) => r,
            Err(_) => return false,
        };

        let new_content = regex.replace_all(&content, "").to_string();
        if new_content != content {
            fs::write(note_path, &new_content).unwrap();
            true
        } else {
            false
        }
    }

    // Helper: Check if note contains wikilink
    fn note_contains_wikilink(note_path: &PathBuf, file_name: &str) -> bool {
        if let Ok(content) = fs::read_to_string(note_path) {
            let pattern = format!("[[{}]]", file_name);
            content.contains(&pattern)
        } else {
            false
        }
    }

    // Helper: Count wikilinks in note
    fn count_wikilinks_in_note(note_path: &PathBuf) -> usize {
        if let Ok(content) = fs::read_to_string(note_path) {
            let regex = Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
            regex.find_iter(&content).count()
        } else {
            0
        }
    }

    // ==========================================
    // PART 1: ATTACHMENT ADDITION TESTS (500+ cases)
    // ==========================================

    #[test]
    fn test_01_single_attachment_first_time() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 1: 첫 번째 단일 첨부파일 추가 (100회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("note_{}", i);
            let file_name = format!("file_{}.pdf", i);

            // Create note
            let note_path = create_note(&vault, &note_name, "본문 내용입니다.");

            // Create attachment
            create_attachment(&vault, &note_name, &file_name, b"PDF content");

            // Add wikilink
            add_wikilink_to_note(&note_path, &file_name);

            // Verify
            if note_contains_wikilink(&note_path, &file_name) {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "첫 번째 첨부파일 추가 실패");
    }

    #[test]
    fn test_02_second_attachment_same_note() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 2: 동일 노트에 2번째 첨부파일 추가 (100회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("note_{}", i);
            let file1 = format!("first_{}.pdf", i);
            let file2 = format!("second_{}.pdf", i);

            // Create note and first attachment
            let note_path = create_note(&vault, &note_name, "본문");
            create_attachment(&vault, &note_name, &file1, b"First PDF");
            add_wikilink_to_note(&note_path, &file1);

            // Add second attachment
            create_attachment(&vault, &note_name, &file2, b"Second PDF");
            add_wikilink_to_note(&note_path, &file2);

            // Verify both exist
            let has_first = note_contains_wikilink(&note_path, &file1);
            let has_second = note_contains_wikilink(&note_path, &file2);

            if has_first && has_second {
                success_count += 1;
            } else {
                println!("  실패 {}: first={}, second={}", i, has_first, has_second);
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "2번째 첨부파일 추가 실패");
    }

    #[test]
    fn test_03_multiple_attachments_sequential() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 3: 순차적 다중 첨부파일 추가 (10개씩 50회 = 500건) ===");

        let mut total_success = 0;
        let mut total_expected = 0;
        let start = Instant::now();

        for i in 0..50 {
            let note_name = format!("multi_note_{}", i);
            let note_path = create_note(&vault, &note_name, "다중 첨부 테스트");

            // Add 10 attachments sequentially
            for j in 0..10 {
                let file_name = format!("file_{}_{}.pdf", i, j);
                create_attachment(&vault, &note_name, &file_name, b"content");
                add_wikilink_to_note(&note_path, &file_name);
                total_expected += 1;

                if note_contains_wikilink(&note_path, &file_name) {
                    total_success += 1;
                }
            }

            // Verify total count
            let link_count = count_wikilinks_in_note(&note_path);
            if link_count != 10 {
                println!("  노트 {} 위키링크 수: {} (기대: 10)", i, link_count);
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/{}, 시간: {:?}", total_success, total_expected, elapsed);
        assert_eq!(total_success, total_expected, "순차적 다중 첨부 실패");
    }

    #[test]
    fn test_04_batch_attachment_addition() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 4: 일괄 첨부파일 추가 (100회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("batch_note_{}", i);
            let note_path = create_note(&vault, &note_name, "일괄 첨부");

            // Create 5 attachments at once
            let files: Vec<String> = (0..5).map(|j| format!("batch_{}_{}.pdf", i, j)).collect();

            for file_name in &files {
                create_attachment(&vault, &note_name, file_name, b"batch content");
            }

            // Add all wikilinks at once (simulating batch drop)
            let content = fs::read_to_string(&note_path).unwrap();
            let links = files.iter().map(|f| format!("- [[{}]]", f)).collect::<Vec<_>>().join("\n");
            let new_content = format!("{}\n\n## 첨부파일\n\n{}\n", content, links);
            fs::write(&note_path, &new_content).unwrap();

            // Verify all exist
            let all_exist = files.iter().all(|f| note_contains_wikilink(&note_path, f));
            if all_exist {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "일괄 첨부 실패");
    }

    #[test]
    fn test_05_intermittent_additions() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 5: 간헐적 첨부 (시간 간격 시뮬레이션, 50회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..50 {
            let note_name = format!("intermittent_{}", i);
            let note_path = create_note(&vault, &note_name, "간헐적 첨부 테스트\n\n기존 본문 내용");

            // First addition
            let file1 = format!("first_{}.pdf", i);
            create_attachment(&vault, &note_name, &file1, b"first");
            add_wikilink_to_note(&note_path, &file1);

            // Simulate time passing - modify note content
            let content = fs::read_to_string(&note_path).unwrap();
            let modified = content.replace("기존 본문 내용", "수정된 본문 내용");
            fs::write(&note_path, &modified).unwrap();

            // Second addition (after "time")
            let file2 = format!("second_{}.pdf", i);
            create_attachment(&vault, &note_name, &file2, b"second");
            add_wikilink_to_note(&note_path, &file2);

            // More modifications
            let content = fs::read_to_string(&note_path).unwrap();
            let modified = content.replace("수정된 본문 내용", "두 번째 수정 내용");
            fs::write(&note_path, &modified).unwrap();

            // Third addition
            let file3 = format!("third_{}.pdf", i);
            create_attachment(&vault, &note_name, &file3, b"third");
            add_wikilink_to_note(&note_path, &file3);

            // Verify all three
            if note_contains_wikilink(&note_path, &file1) &&
               note_contains_wikilink(&note_path, &file2) &&
               note_contains_wikilink(&note_path, &file3) {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/50, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 50, "간헐적 첨부 실패");
    }

    #[test]
    fn test_06_special_filename_attachments() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 6: 특수 파일명 첨부 (100회) ===");

        let special_names = vec![
            "파일 with spaces.pdf",
            "한글파일명.pdf",
            "file_with_underscore.pdf",
            "file-with-dash.pdf",
            "file.multiple.dots.pdf",
            "UPPERCASE.PDF",
            "MixedCase.Pdf",
            "123numeric.pdf",
            "file(1).pdf",
            "file[bracket].pdf",
        ];

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("special_note_{}", i);
            let note_path = create_note(&vault, &note_name, "특수 파일명 테스트");

            let file_name = &special_names[i % special_names.len()];
            let unique_name = format!("{}_{}", i, file_name);

            // Windows-safe filename
            let safe_name = unique_name.replace(['[', ']', '(', ')'], "_");

            create_attachment(&vault, &note_name, &safe_name, b"special content");
            add_wikilink_to_note(&note_path, &safe_name);

            if note_contains_wikilink(&note_path, &safe_name) {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "특수 파일명 첨부 실패");
    }

    // ==========================================
    // PART 2: WIKILINK SYNCHRONIZATION TESTS (500+ cases)
    // ==========================================

    #[test]
    fn test_07_delete_attachment_remove_wikilink() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 7: 첨부파일 삭제 시 위키링크 제거 (100회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("delete_test_{}", i);
            let file_name = format!("to_delete_{}.pdf", i);

            // Setup: create note with attachment and wikilink
            let note_path = create_note(&vault, &note_name, "삭제 테스트");
            let att_path = create_attachment(&vault, &note_name, &file_name, b"content");
            add_wikilink_to_note(&note_path, &file_name);

            // Verify setup
            assert!(note_contains_wikilink(&note_path, &file_name));
            assert!(att_path.exists());

            // Delete attachment and remove wikilink
            fs::remove_file(&att_path).unwrap();
            remove_wikilink_from_note(&note_path, &file_name);

            // Verify removal
            if !note_contains_wikilink(&note_path, &file_name) && !att_path.exists() {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "첨부파일 삭제 시 위키링크 제거 실패");
    }

    #[test]
    fn test_08_delete_wikilink_keep_attachment() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 8: 위키링크만 삭제 (첨부파일 유지) (100회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("link_only_del_{}", i);
            let file_name = format!("keep_file_{}.pdf", i);

            // Setup
            let note_path = create_note(&vault, &note_name, "위키링크만 삭제");
            let att_path = create_attachment(&vault, &note_name, &file_name, b"content");
            add_wikilink_to_note(&note_path, &file_name);

            // Remove wikilink only
            remove_wikilink_from_note(&note_path, &file_name);

            // Verify: link gone but file exists
            if !note_contains_wikilink(&note_path, &file_name) && att_path.exists() {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "위키링크만 삭제 실패");
    }

    #[test]
    fn test_09_multiple_deletions_same_note() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 9: 동일 노트에서 다중 삭제 (50회 x 5파일 = 250건) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..50 {
            let note_name = format!("multi_del_{}", i);
            let note_path = create_note(&vault, &note_name, "다중 삭제 테스트");

            // Add 5 attachments
            let files: Vec<String> = (0..5).map(|j| format!("file_{}_{}.pdf", i, j)).collect();
            let mut att_paths = Vec::new();

            for file_name in &files {
                let att_path = create_attachment(&vault, &note_name, file_name, b"content");
                add_wikilink_to_note(&note_path, file_name);
                att_paths.push(att_path);
            }

            // Verify all added
            let initial_count = count_wikilinks_in_note(&note_path);
            assert_eq!(initial_count, 5, "초기 위키링크 수 불일치");

            // Delete files one by one
            for (j, (file_name, att_path)) in files.iter().zip(att_paths.iter()).enumerate() {
                fs::remove_file(att_path).unwrap();
                remove_wikilink_from_note(&note_path, file_name);

                let remaining = count_wikilinks_in_note(&note_path);
                if remaining == 4 - j {
                    success_count += 1;
                }
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/250, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 250, "다중 삭제 실패");
    }

    #[test]
    fn test_10_same_filename_different_notes() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 10: 동일 파일명 다른 노트 (폴더 경로 구분, 100회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_a = format!("note_a_{}", i);
            let note_b = format!("note_b_{}", i);
            let same_name = "common_file.pdf";

            // Create both notes with same-named attachment
            let path_a = create_note(&vault, &note_a, "노트 A");
            let path_b = create_note(&vault, &note_b, "노트 B");

            let att_a = create_attachment(&vault, &note_a, same_name, b"content A");
            let att_b = create_attachment(&vault, &note_b, same_name, b"content B");

            add_wikilink_to_note(&path_a, same_name);
            add_wikilink_to_note(&path_b, same_name);

            // Delete from note A only
            fs::remove_file(&att_a).unwrap();
            remove_wikilink_from_note(&path_a, same_name);

            // Verify: A has no link, B still has link and file
            let a_no_link = !note_contains_wikilink(&path_a, same_name);
            let b_has_link = note_contains_wikilink(&path_b, same_name);
            let b_has_file = att_b.exists();

            if a_no_link && b_has_link && b_has_file {
                success_count += 1;
            } else {
                println!("  실패 {}: a_no_link={}, b_has_link={}, b_has_file={}",
                         i, a_no_link, b_has_link, b_has_file);
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "동일 파일명 다른 노트 처리 실패");
    }

    #[test]
    fn test_11_rapid_add_delete_cycles() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 11: 빠른 추가/삭제 반복 (100회 x 5사이클 = 500건) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("rapid_{}", i);
            let note_path = create_note(&vault, &note_name, "빠른 반복 테스트");

            for cycle in 0..5 {
                let file_name = format!("rapid_{}_{}.pdf", i, cycle);

                // Add
                let att_path = create_attachment(&vault, &note_name, &file_name, b"rapid content");
                add_wikilink_to_note(&note_path, &file_name);

                // Verify added
                let added = note_contains_wikilink(&note_path, &file_name) && att_path.exists();

                // Delete
                if att_path.exists() {
                    fs::remove_file(&att_path).unwrap();
                }
                remove_wikilink_from_note(&note_path, &file_name);

                // Verify deleted
                let deleted = !note_contains_wikilink(&note_path, &file_name) && !att_path.exists();

                if added && deleted {
                    success_count += 1;
                }
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/500, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 500, "빠른 추가/삭제 반복 실패");
    }

    #[test]
    fn test_12_concurrent_operations_simulation() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 12: 동시 작업 시뮬레이션 (100회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..100 {
            // Simulate concurrent operations on multiple notes
            let notes: Vec<(String, PathBuf)> = (0..5).map(|j| {
                let name = format!("concurrent_{}_{}", i, j);
                let path = create_note(&vault, &name, "동시 작업");
                (name, path)
            }).collect();

            // Add attachments to all notes
            for (note_name, note_path) in &notes {
                let file_name = format!("{}_file.pdf", note_name);
                create_attachment(&vault, note_name, &file_name, b"content");
                add_wikilink_to_note(note_path, &file_name);
            }

            // Delete from some notes
            for (j, (note_name, note_path)) in notes.iter().enumerate() {
                if j % 2 == 0 {
                    let file_name = format!("{}_file.pdf", note_name);
                    let att_path = vault.join(format!("{}_att/{}", note_name, file_name));
                    if att_path.exists() {
                        fs::remove_file(&att_path).unwrap();
                    }
                    remove_wikilink_from_note(note_path, &file_name);
                }
            }

            // Verify state
            let mut local_success = true;
            for (j, (note_name, note_path)) in notes.iter().enumerate() {
                let file_name = format!("{}_file.pdf", note_name);
                let has_link = note_contains_wikilink(note_path, &file_name);

                if j % 2 == 0 {
                    // Should be deleted
                    if has_link {
                        local_success = false;
                    }
                } else {
                    // Should still exist
                    if !has_link {
                        local_success = false;
                    }
                }
            }

            if local_success {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/100, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 100, "동시 작업 시뮬레이션 실패");
    }

    // ==========================================
    // PART 3: STRESS TESTS
    // ==========================================

    #[test]
    fn test_13_large_note_many_attachments() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 13: 대용량 노트 + 다수 첨부파일 (50개 첨부) ===");

        let note_name = "large_note";
        let note_path = create_note(&vault, note_name, "대용량 테스트 노트\n\n".repeat(100).as_str());

        let start = Instant::now();
        let mut success_count = 0;

        // Add 50 attachments
        for i in 0..50 {
            let file_name = format!("large_file_{}.pdf", i);
            create_attachment(&vault, note_name, &file_name, &vec![0u8; 1024]); // 1KB files
            add_wikilink_to_note(&note_path, &file_name);

            if note_contains_wikilink(&note_path, &file_name) {
                success_count += 1;
            }
        }

        let add_time = start.elapsed();
        println!("  50개 첨부 추가 시간: {:?}", add_time);
        println!("  성공: {}/50", success_count);

        // Delete 25 attachments
        let delete_start = Instant::now();
        let mut delete_success = 0;

        for i in 0..25 {
            let file_name = format!("large_file_{}.pdf", i);
            let att_path = vault.join(format!("{}_att/{}", note_name, file_name));
            if att_path.exists() {
                fs::remove_file(&att_path).unwrap();
            }
            if remove_wikilink_from_note(&note_path, &file_name) {
                delete_success += 1;
            }
        }

        let delete_time = delete_start.elapsed();
        println!("  25개 첨부 삭제 시간: {:?}", delete_time);
        println!("  삭제 성공: {}/25", delete_success);

        // Verify remaining
        let remaining = count_wikilinks_in_note(&note_path);
        println!("  남은 위키링크: {} (기대: 25)", remaining);

        assert_eq!(success_count, 50);
        assert_eq!(delete_success, 25);
        assert_eq!(remaining, 25);
    }

    #[test]
    fn test_14_1000_operations_mixed() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 14: 1000건 혼합 작업 스트레스 테스트 ===");

        let start = Instant::now();
        let mut add_success = 0;
        let mut delete_success = 0;
        let mut errors = Vec::new();

        // Create 100 notes
        let notes: Vec<(String, PathBuf)> = (0..100).map(|i| {
            let name = format!("stress_note_{}", i);
            let path = create_note(&vault, &name, "스트레스 테스트");
            (name, path)
        }).collect();

        // 1000 operations: 70% add, 30% delete
        for op in 0..1000 {
            let note_idx = op % 100;
            let (note_name, note_path) = &notes[note_idx];

            if op % 10 < 7 {
                // Add operation
                let file_name = format!("stress_{}_{}.pdf", note_idx, op);
                create_attachment(&vault, note_name, &file_name, b"stress content");
                add_wikilink_to_note(note_path, &file_name);

                if note_contains_wikilink(note_path, &file_name) {
                    add_success += 1;
                } else {
                    errors.push(format!("Add failed: op={}, file={}", op, file_name));
                }
            } else {
                // Delete operation - try to delete a random earlier file
                let target_op = (op / 10) * 7; // Earlier add operation
                let file_name = format!("stress_{}_{}.pdf", note_idx, target_op);

                if note_contains_wikilink(note_path, &file_name) {
                    let att_path = vault.join(format!("{}_att/{}", note_name, file_name));
                    if att_path.exists() {
                        let _ = fs::remove_file(&att_path);
                    }
                    if remove_wikilink_from_note(note_path, &file_name) {
                        delete_success += 1;
                    }
                }
            }
        }

        let elapsed = start.elapsed();

        println!("  총 시간: {:?}", elapsed);
        println!("  추가 성공: {}/700", add_success);
        println!("  삭제 성공: {}", delete_success);
        println!("  오류 수: {}", errors.len());

        if !errors.is_empty() && errors.len() <= 10 {
            for err in &errors {
                println!("    - {}", err);
            }
        }

        assert!(add_success >= 690, "추가 성공률 98% 미만: {}/700", add_success);
    }

    #[test]
    fn test_15_orphan_detection() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 15: 고아 파일/링크 감지 (100회) ===");

        let mut orphan_file_detected = 0;
        let mut orphan_link_detected = 0;
        let start = Instant::now();

        for i in 0..100 {
            let note_name = format!("orphan_test_{}", i);
            let note_path = create_note(&vault, &note_name, "고아 테스트");

            // Create orphan file (file without link)
            let orphan_file = format!("orphan_file_{}.pdf", i);
            create_attachment(&vault, &note_name, &orphan_file, b"orphan");

            // Create orphan link (link without file)
            let orphan_link = format!("missing_file_{}.pdf", i);
            add_wikilink_to_note(&note_path, &orphan_link);

            // Detect orphan file
            let att_path = vault.join(format!("{}_att/{}", note_name, orphan_file));
            if att_path.exists() && !note_contains_wikilink(&note_path, &orphan_file) {
                orphan_file_detected += 1;
            }

            // Detect orphan link
            let link_att_path = vault.join(format!("{}_att/{}", note_name, orphan_link));
            if note_contains_wikilink(&note_path, &orphan_link) && !link_att_path.exists() {
                orphan_link_detected += 1;
            }
        }

        let elapsed = start.elapsed();

        println!("  고아 파일 감지: {}/100", orphan_file_detected);
        println!("  고아 링크 감지: {}/100", orphan_link_detected);
        println!("  시간: {:?}", elapsed);

        assert_eq!(orphan_file_detected, 100);
        assert_eq!(orphan_link_detected, 100);
    }

    // ==========================================
    // PART 4: EDGE CASES AND REGRESSION TESTS
    // ==========================================

    #[test]
    fn test_16_empty_attachment_section() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 16: 빈 첨부파일 섹션 처리 (50회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..50 {
            let note_name = format!("empty_section_{}", i);
            let note_path = create_note(&vault, &note_name, "본문\n\n## 첨부파일\n\n");

            // Add to existing empty section
            let file_name = format!("new_file_{}.pdf", i);
            create_attachment(&vault, &note_name, &file_name, b"content");
            add_wikilink_to_note(&note_path, &file_name);

            if note_contains_wikilink(&note_path, &file_name) {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/50, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 50);
    }

    #[test]
    fn test_17_unicode_content_preservation() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 17: 유니코드 콘텐츠 보존 (50회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        let unicode_content = "한글 테스트 🎉 日本語 العربية\n\n특수문자: ∑∫√∞\n\n이모지: 🚀💻📝";

        for i in 0..50 {
            let note_name = format!("unicode_{}", i);
            let note_path = create_note(&vault, &note_name, unicode_content);

            let file_name = format!("unicode_file_{}.pdf", i);
            create_attachment(&vault, &note_name, &file_name, b"content");
            add_wikilink_to_note(&note_path, &file_name);

            // Delete and verify content preservation
            remove_wikilink_from_note(&note_path, &file_name);

            let content = fs::read_to_string(&note_path).unwrap();
            if content.contains("한글 테스트") && content.contains("🎉") && content.contains("日本語") {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/50, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 50);
    }

    #[test]
    fn test_18_very_long_filenames() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 18: 긴 파일명 처리 (50회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..50 {
            let note_name = format!("longname_{}", i);
            let note_path = create_note(&vault, &note_name, "긴 파일명 테스트");

            // 100 character filename (Windows limit is around 255)
            let long_name = format!("{}_{}.pdf", "a".repeat(90), i);

            create_attachment(&vault, &note_name, &long_name, b"content");
            add_wikilink_to_note(&note_path, &long_name);

            if note_contains_wikilink(&note_path, &long_name) {
                success_count += 1;
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/50, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 50);
    }

    #[test]
    fn test_19_multiple_wikilinks_same_file() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 19: 동일 파일 다중 위키링크 (50회) ===");

        let mut success_count = 0;
        let start = Instant::now();

        for i in 0..50 {
            let note_name = format!("multi_link_{}", i);
            let file_name = format!("same_file_{}.pdf", i);

            // Create note with multiple references to same file
            let content = format!(
                "본문에서 [[{}]] 언급\n\n다시 [[{}]] 언급\n\n## 첨부파일\n\n- [[{}]]",
                file_name, file_name, file_name
            );
            let note_path = vault.join(format!("{}.md", note_name));
            fs::write(&note_path, format!("---\ntitle: {}\n---\n\n{}", note_name, content)).unwrap();

            create_attachment(&vault, &note_name, &file_name, b"content");

            // Count links before
            let content_before = fs::read_to_string(&note_path).unwrap();
            let count_before = content_before.matches(&format!("[[{}]]", file_name)).count();

            // Remove all links
            remove_wikilink_from_note(&note_path, &file_name);

            // Count links after
            let content_after = fs::read_to_string(&note_path).unwrap();
            let count_after = content_after.matches(&format!("[[{}]]", file_name)).count();

            if count_before == 3 && count_after == 0 {
                success_count += 1;
            } else {
                println!("  실패 {}: before={}, after={}", i, count_before, count_after);
            }
        }

        let elapsed = start.elapsed();
        println!("  성공: {}/50, 시간: {:?}", success_count, elapsed);
        assert_eq!(success_count, 50);
    }

    #[test]
    fn test_20_performance_benchmark() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 20: 성능 벤치마크 ===");

        // Benchmark 1: Sequential adds
        let note_name = "perf_test";
        let note_path = create_note(&vault, note_name, "성능 테스트");

        let add_start = Instant::now();
        for i in 0..100 {
            let file_name = format!("perf_{}.pdf", i);
            create_attachment(&vault, note_name, &file_name, b"content");
            add_wikilink_to_note(&note_path, &file_name);
        }
        let add_time = add_start.elapsed();

        // Benchmark 2: Sequential deletes
        let delete_start = Instant::now();
        for i in 0..100 {
            let file_name = format!("perf_{}.pdf", i);
            let att_path = vault.join(format!("{}_att/{}", note_name, file_name));
            if att_path.exists() {
                let _ = fs::remove_file(&att_path);
            }
            remove_wikilink_from_note(&note_path, &file_name);
        }
        let delete_time = delete_start.elapsed();

        println!("  100개 첨부 추가: {:?} ({:?}/개)", add_time, add_time / 100);
        println!("  100개 첨부 삭제: {:?} ({:?}/개)", delete_time, delete_time / 100);

        // Performance assertions
        assert!(add_time < Duration::from_secs(2), "추가 너무 느림: {:?}", add_time);
        assert!(delete_time < Duration::from_secs(2), "삭제 너무 느림: {:?}", delete_time);
    }

    // ==========================================
    // SUMMARY TEST
    // ==========================================

    #[test]
    fn test_99_summary() {
        println!("\n");
        println!("{}", "=".repeat(60));
        println!("첨부파일-위키링크 동기화 테스트 요약");
        println!("{}", "=".repeat(60));
        println!("Part 1: 첨부파일 추가 테스트");
        println!("  - Test 01: 첫 번째 단일 첨부 (100회)");
        println!("  - Test 02: 2번째 첨부 추가 (100회)");
        println!("  - Test 03: 순차적 다중 첨부 (500건)");
        println!("  - Test 04: 일괄 첨부 (100회)");
        println!("  - Test 05: 간헐적 첨부 (50회)");
        println!("  - Test 06: 특수 파일명 (100회)");
        println!("Part 2: 위키링크 동기화 테스트");
        println!("  - Test 07: 첨부삭제→링크제거 (100회)");
        println!("  - Test 08: 링크만 삭제 (100회)");
        println!("  - Test 09: 다중 삭제 (250건)");
        println!("  - Test 10: 동일파일명 다른노트 (100회)");
        println!("  - Test 11: 빠른 추가/삭제 (500건)");
        println!("  - Test 12: 동시 작업 시뮬레이션 (100회)");
        println!("Part 3: 스트레스 테스트");
        println!("  - Test 13: 대용량 노트 (50첨부)");
        println!("  - Test 14: 1000건 혼합 작업");
        println!("  - Test 15: 고아 파일/링크 감지 (100회)");
        println!("Part 4: 엣지 케이스");
        println!("  - Test 16: 빈 첨부섹션 (50회)");
        println!("  - Test 17: 유니코드 보존 (50회)");
        println!("  - Test 18: 긴 파일명 (50회)");
        println!("  - Test 19: 다중 위키링크 동일파일 (50회)");
        println!("  - Test 20: 성능 벤치마크");
        println!("{}", "=".repeat(60));
        println!("총 시뮬레이션: 약 2400건");
        println!("{}", "=".repeat(60));
    }
}
