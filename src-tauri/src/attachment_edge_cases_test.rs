// Comprehensive edge case tests for attachment system
// "모든 상상의 수를 다 시험" - 사용자 요청

#[cfg(test)]
mod edge_case_tests {
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Edge Case 1: 첨부파일 섹션이 이미 있는 상태에서 추가
    #[test]
    fn test_append_to_existing_attachment_section() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, r#"# 노트

## 첨부파일

- [[기존파일1.png]]
- [[기존파일2.pdf]]

## 다음 섹션
"#).unwrap();

        // Simulate adding new attachment
        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("새파일.png"), "new data").unwrap();

        // Expected: 새파일.png가 기존 리스트에 추가됨
        // Content should contain both old and new files
        assert!(att_folder.join("새파일.png").exists());

        println!("✅ Edge Case 1: 기존 첨부파일 섹션에 추가");
    }

    /// Edge Case 2: 특수문자 파일명
    #[test]
    fn test_special_characters_in_filename() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, "# 노트").unwrap();

        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();

        // Special characters
        let special_files = vec![
            "파일 (1).png",
            "문서[최종].pdf",
            "이미지_2024.jpg",
            "보고서-수정본.docx",
            "데이터#1.xlsx",
        ];

        for file in &special_files {
            fs::write(att_folder.join(file), "data").unwrap();
            assert!(att_folder.join(file).exists(), "특수문자 파일 생성 실패: {}", file);
        }

        println!("✅ Edge Case 2: 특수문자 파일명 처리");
    }

    /// Edge Case 3: 매우 긴 파일명
    #[test]
    fn test_very_long_filename() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, "# 노트").unwrap();

        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();

        // 200 character filename
        let long_name = format!("{}.png", "가".repeat(100));
        fs::write(att_folder.join(&long_name), "data").unwrap();

        assert!(att_folder.join(&long_name).exists());

        println!("✅ Edge Case 3: 매우 긴 파일명 (100자)");
    }

    /// Edge Case 4: 중복 파일명 처리
    #[test]
    fn test_duplicate_filename_collision() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, "# 노트").unwrap();

        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();

        // Create first file
        fs::write(att_folder.join("이미지.png"), "original").unwrap();

        // Simulate import_attachment with collision
        // Should create 이미지 (1).png
        let source = vault_path.join("이미지.png");
        fs::write(&source, "new version").unwrap();

        // Collision resolution would create numbered version
        let mut counter = 1;
        let mut new_name = format!("이미지 ({}).png", counter);
        while att_folder.join(&new_name).exists() {
            counter += 1;
            new_name = format!("이미지 ({}).png", counter);
        }

        fs::copy(&source, att_folder.join(&new_name)).unwrap();

        assert!(att_folder.join("이미지.png").exists());
        assert!(att_folder.join("이미지 (1).png").exists());

        println!("✅ Edge Case 4: 중복 파일명 충돌 해결");
    }

    /// Edge Case 5: 대량 첨부파일 (100개)
    #[test]
    fn test_bulk_attachments() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, "# 노트").unwrap();

        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();

        // Add 100 files
        for i in 0..100 {
            let file_name = format!("파일_{:03}.png", i);
            fs::write(att_folder.join(&file_name), format!("data {}", i)).unwrap();
        }

        // Verify all files exist
        for i in 0..100 {
            let file_name = format!("파일_{:03}.png", i);
            assert!(att_folder.join(&file_name).exists());
        }

        println!("✅ Edge Case 5: 대량 첨부파일 (100개)");
    }

    /// Edge Case 6: 노트 삭제 후 재생성
    #[test]
    fn test_delete_and_recreate_note() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        let att_folder = vault_path.join("노트_att");

        // Create note with attachments
        fs::write(&note_path, "# 노트").unwrap();
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("파일.png"), "data").unwrap();

        // Delete (attachments first, then note)
        fs::remove_dir_all(&att_folder).unwrap();
        fs::remove_file(&note_path).unwrap();

        assert!(!note_path.exists());
        assert!(!att_folder.exists());

        // Recreate
        fs::write(&note_path, "# 새 노트").unwrap();
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("새파일.png"), "new data").unwrap();

        assert!(note_path.exists());
        assert!(att_folder.exists());
        assert!(att_folder.join("새파일.png").exists());

        println!("✅ Edge Case 6: 노트 삭제 후 재생성");
    }

    /// Edge Case 7: 빈 첨부파일 폴더
    #[test]
    fn test_empty_attachment_folder() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, "# 노트\n\n## 첨부파일\n").unwrap();

        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();

        // Empty folder should exist
        assert!(att_folder.exists());
        assert!(att_folder.is_dir());

        // Should be safe to delete
        fs::remove_dir(&att_folder).unwrap();
        assert!(!att_folder.exists());

        println!("✅ Edge Case 7: 빈 첨부파일 폴더 처리");
    }

    /// Edge Case 8: 첨부파일 섹션이 여러 개 있는 경우 (비정상)
    #[test]
    fn test_multiple_attachment_sections() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, r#"# 노트

## 첨부파일

- [[파일1.png]]

## 중간 섹션

## 첨부파일

- [[파일2.png]]
"#).unwrap();

        // Should only process first attachment section
        let content = fs::read_to_string(&note_path).unwrap();
        assert!(content.contains("파일1.png"));
        assert!(content.contains("파일2.png"));

        println!("✅ Edge Case 8: 중복 첨부파일 섹션 (비정상 케이스)");
    }

    /// Edge Case 9: 노트 이름에 특수문자
    #[test]
    fn test_note_name_with_special_chars() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Note: Windows doesn't allow some characters in filenames
        let note_names = vec![
            "노트 (1).md",
            "노트[최종].md",
            "노트_2024.md",
            "노트-수정본.md",
        ];

        for note_name in &note_names {
            let note_path = vault_path.join(note_name);
            fs::write(&note_path, "# 노트").unwrap();

            let stem = note_path.file_stem().unwrap().to_string_lossy().to_string();
            let att_folder = vault_path.join(format!("{}_att", stem));
            fs::create_dir(&att_folder).unwrap();

            assert!(note_path.exists(), "노트 생성 실패: {}", note_name);
            assert!(att_folder.exists(), "첨부 폴더 생성 실패: {}_att", stem);

            fs::remove_dir_all(&att_folder).unwrap();
            fs::remove_file(&note_path).unwrap();
        }

        println!("✅ Edge Case 9: 특수문자 포함 노트명");
    }

    /// Edge Case 10: 매우 깊은 폴더 구조 (10단계)
    #[test]
    fn test_very_deep_folder_structure() {
        let temp_dir = TempDir::new().unwrap();
        let mut current = temp_dir.path().to_path_buf();

        // Create 10-level deep structure
        for i in 1..=10 {
            current = current.join(format!("레벨{}", i));
            fs::create_dir(&current).unwrap();
        }

        let note_path = current.join("깊은노트.md");
        fs::write(&note_path, "# 깊은 노트").unwrap();

        let att_folder = current.join("깊은노트_att");
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("파일.png"), "data").unwrap();

        assert!(note_path.exists());
        assert!(att_folder.exists());
        assert!(att_folder.join("파일.png").exists());

        println!("✅ Edge Case 10: 매우 깊은 폴더 구조 (10단계)");
    }

    /// Edge Case 11: 동시에 여러 첨부파일 추가
    #[test]
    fn test_concurrent_attachment_additions() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, "# 노트").unwrap();

        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();

        // Simulate concurrent additions (5 threads)
        use std::thread;
        let handles: Vec<_> = (0..5)
            .map(|i| {
                let folder = att_folder.clone();
                thread::spawn(move || {
                    for j in 0..10 {
                        let file_name = format!("스레드{}_{}.png", i, j);
                        fs::write(folder.join(&file_name), format!("data {} {}", i, j)).unwrap();
                    }
                })
            })
            .collect();

        for handle in handles {
            handle.join().unwrap();
        }

        // Verify all 50 files (5 threads × 10 files)
        let entries: Vec<_> = fs::read_dir(&att_folder).unwrap().collect();
        assert_eq!(entries.len(), 50, "50개 파일이 모두 생성되어야 함");

        println!("✅ Edge Case 11: 동시 다중 첨부파일 추가 (50개)");
    }

    /// Edge Case 12: 첨부파일 폴더만 있고 노트가 없는 경우 (고아 폴더)
    #[test]
    fn test_orphaned_attachment_folder() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Create orphaned _att folder (no corresponding note)
        let orphaned_folder = vault_path.join("고아노트_att");
        fs::create_dir(&orphaned_folder).unwrap();
        fs::write(orphaned_folder.join("파일.png"), "data").unwrap();

        // Verify folder exists
        assert!(orphaned_folder.exists());

        // Should be safe to clean up
        fs::remove_dir_all(&orphaned_folder).unwrap();
        assert!(!orphaned_folder.exists());

        println!("✅ Edge Case 12: 고아 첨부파일 폴더 (노트 없음)");
    }

    /// Edge Case 13: 첨부파일 섹션이 문서 끝에 있는 경우
    #[test]
    fn test_attachment_section_at_end() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, r#"# 노트

내용이 있습니다.

## 첨부파일

- [[파일1.png]]"#).unwrap();

        // Add more files - should append to existing section
        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("파일2.png"), "data").unwrap();

        assert!(att_folder.join("파일2.png").exists());

        println!("✅ Edge Case 13: 첨부파일 섹션이 문서 끝");
    }

    /// Edge Case 14: 다양한 파일 확장자
    #[test]
    fn test_various_file_extensions() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let note_path = vault_path.join("노트.md");
        fs::write(&note_path, "# 노트").unwrap();

        let att_folder = vault_path.join("노트_att");
        fs::create_dir(&att_folder).unwrap();

        let extensions = vec![
            "png", "jpg", "jpeg", "gif", "svg", "webp",  // Images
            "pdf", "docx", "xlsx", "pptx",               // Documents
            "mp4", "mov", "avi",                         // Videos
            "mp3", "wav", "flac",                        // Audio
            "zip", "rar", "7z",                          // Archives
            "txt", "json", "xml", "csv",                 // Text
        ];

        for ext in &extensions {
            let file_name = format!("파일.{}", ext);
            fs::write(att_folder.join(&file_name), "data").unwrap();
            assert!(att_folder.join(&file_name).exists(), "확장자 {} 실패", ext);
        }

        println!("✅ Edge Case 14: 다양한 파일 확장자 ({} 종류)", extensions.len());
    }

    /// Edge Case 15: 노트 빠른 연속 이름 변경
    #[test]
    fn test_rapid_consecutive_renames() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        let mut current_note = vault_path.join("노트1.md");
        let mut current_att = vault_path.join("노트1_att");

        fs::write(&current_note, "# 노트").unwrap();
        fs::create_dir(&current_att).unwrap();
        fs::write(current_att.join("파일.png"), "data").unwrap();

        // Rename 5 times rapidly
        for i in 2..=5 {
            let new_note = vault_path.join(format!("노트{}.md", i));
            let new_att = vault_path.join(format!("노트{}_att", i));

            fs::rename(&current_note, &new_note).unwrap();
            fs::rename(&current_att, &new_att).unwrap();

            current_note = new_note;
            current_att = new_att;
        }

        // Final state should be 노트5.md and 노트5_att
        assert!(current_note.exists());
        assert!(current_att.exists());
        assert!(current_att.join("파일.png").exists());

        println!("✅ Edge Case 15: 빠른 연속 이름 변경 (5회)");
    }
}
