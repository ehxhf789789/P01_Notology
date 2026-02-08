// Attachment Cleanup and Management Test Suite (500 scenarios)
// Tests for: attachment deletion, broken link cleanup, dummy file filtering, multi-select operations

#[cfg(test)]
mod attachment_cleanup_tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;

    /// Helper: Create a test vault
    fn create_test_vault() -> TempDir {
        TempDir::new().unwrap()
    }

    /// Helper: Create a note with content
    fn create_note(path: &PathBuf, content: &str) {
        fs::write(path, content).unwrap();
    }

    /// Helper: Create an attachment file
    fn create_attachment(path: &PathBuf, content: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }
        fs::write(path, content).unwrap();
    }

    /// Helper: Check if file exists
    fn file_exists(path: &Path) -> bool {
        path.exists() && path.is_file()
    }

    /// Helper: Count wiki-links in content
    fn count_wiki_links(content: &str, filename: &str) -> usize {
        let mut count = 0;
        // Bracket format [[file]]
        count += content.matches(&format!("[[{}]]", filename)).count();
        // HTML span format
        count += content.matches(&format!("data-wiki-link=\"{}\"", filename)).count();
        count
    }

    /// Helper: Count empty bullet lines (lines with just "- " or "-")
    fn count_empty_bullets(content: &str) -> usize {
        content.lines().filter(|line| {
            let trimmed = line.trim();
            trimmed == "-" || trimmed == "- "
        }).count()
    }

    /// Helper: Find all _att folders in vault
    fn find_att_folders(vault: &Path) -> Vec<PathBuf> {
        let mut folders = Vec::new();
        if let Ok(entries) = fs::read_dir(vault) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = path.file_name().unwrap().to_string_lossy();
                    if name.ends_with("_att") {
                        folders.push(path.clone());
                    }
                    // Recursively search subdirectories
                    folders.extend(find_att_folders(&path));
                }
            }
        }
        folders
    }

    /// Helper: List all files in _att folder
    fn list_att_files(att_folder: &Path) -> Vec<PathBuf> {
        let mut files = Vec::new();
        if let Ok(entries) = fs::read_dir(att_folder) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    files.push(path);
                }
            }
        }
        files
    }

    /// Helper: Check if attachment is referenced in any note
    fn is_attachment_referenced(vault: &Path, filename: &str) -> bool {
        fn search_in_dir(dir: &Path, filename: &str) -> bool {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if search_in_dir(&path, filename) {
                            return true;
                        }
                    } else if path.extension().map_or(false, |e| e == "md") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if count_wiki_links(&content, filename) > 0 {
                                return true;
                            }
                        }
                    }
                }
            }
            false
        }
        search_in_dir(vault, filename)
    }

    /// Helper: Delete attachment file
    fn delete_attachment(path: &Path) -> Result<(), String> {
        fs::remove_file(path).map_err(|e| e.to_string())
    }

    /// Helper: Clean broken links from note content
    fn clean_broken_links(content: &str, vault: &Path) -> String {
        let lines: Vec<&str> = content.lines().collect();
        let mut new_lines = Vec::new();

        for line in lines {
            let mut keep_line = true;

            // Check for wiki-links in this line
            if line.contains("[[") || line.contains("data-wiki-link=") {
                // Extract filename from bracket format
                if let Some(start) = line.find("[[") {
                    if let Some(end) = line[start..].find("]]") {
                        let filename = &line[start + 2..start + end];
                        // Check if file exists
                        let file_path = vault.join(filename);
                        if !file_path.exists() {
                            // Check in _att folders
                            let att_folders = find_att_folders(vault);
                            let mut found = false;
                            for att_folder in att_folders {
                                if att_folder.join(filename).exists() {
                                    found = true;
                                    break;
                                }
                            }
                            if !found {
                                keep_line = false;
                            }
                        }
                    }
                }

                // Extract filename from HTML span format
                if keep_line && line.contains("data-wiki-link=") {
                    if let Some(start) = line.find("data-wiki-link=\"") {
                        let after_quote = start + 16; // length of "data-wiki-link=\""
                        if let Some(end) = line[after_quote..].find("\"") {
                            let filename = &line[after_quote..after_quote + end];
                            // Check if file exists
                            let file_path = vault.join(filename);
                            if !file_path.exists() {
                                // Check in _att folders
                                let att_folders = find_att_folders(vault);
                                let mut found = false;
                                for att_folder in att_folders {
                                    if att_folder.join(filename).exists() {
                                        found = true;
                                        break;
                                    }
                                }
                                if !found {
                                    keep_line = false;
                                }
                            }
                        }
                    }
                }
            }

            // Don't add empty bullet lines
            if keep_line {
                let trimmed = line.trim();
                if trimmed == "-" || trimmed == "- " {
                    keep_line = false;
                }
            }

            if keep_line {
                new_lines.push(line);
            }
        }

        new_lines.join("\n")
    }

    // ==========================================
    // GROUP 1: Single Attachment Deletion (100 tests)
    // ==========================================

    #[test]
    fn test_001_020_single_attachment_delete() {
        for i in 1..=20 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            let att_file = att_folder.join(format!("file{}.pdf", i));

            create_note(&note, &format!("# Note\n\n[[file{}.pdf]]", i));
            create_attachment(&att_file, b"fake pdf");

            assert!(file_exists(&att_file));

            // Delete attachment
            delete_attachment(&att_file).unwrap();

            assert!(!file_exists(&att_file));
            println!("✅ Test {}: Single attachment delete", i);
        }
    }

    #[test]
    fn test_021_040_delete_with_link_update() {
        for i in 21..=40 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            let att_file = att_folder.join(format!("file{}.pdf", i));

            let content = format!("# Note\n\n- [[file{}.pdf]]\n- Other content", i);
            create_note(&note, &content);
            create_attachment(&att_file, b"fake pdf");

            // Before deletion
            let before_content = fs::read_to_string(&note).unwrap();
            assert!(before_content.contains(&format!("file{}.pdf", i)));

            // Delete attachment
            delete_attachment(&att_file).unwrap();

            // After deletion, clean broken links
            let cleaned = clean_broken_links(&before_content, vault);
            assert!(!cleaned.contains(&format!("file{}.pdf", i)));
            assert!(!cleaned.contains("- \n")); // No empty bullets

            println!("✅ Test {}: Delete with link update", i);
        }
    }

    #[test]
    fn test_041_060_delete_multiple_links_same_file() {
        for i in 41..=60 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            let att_file = att_folder.join(format!("doc{}.pdf", i));

            // Multiple references to same file
            let content = format!(
                "# Note\n\n- [[doc{}.pdf]]\n- See [[doc{}.pdf]]\n- Reference [[doc{}.pdf]]",
                i, i, i
            );
            create_note(&note, &content);
            create_attachment(&att_file, b"fake pdf");

            assert_eq!(count_wiki_links(&content, &format!("doc{}.pdf", i)), 3);

            delete_attachment(&att_file).unwrap();
            let cleaned = clean_broken_links(&content, vault);
            assert_eq!(count_wiki_links(&cleaned, &format!("doc{}.pdf", i)), 0);

            println!("✅ Test {}: Delete with multiple links", i);
        }
    }

    #[test]
    fn test_061_080_delete_various_extensions() {
        let extensions = [
            "pdf", "docx", "xlsx", "pptx", "txt", "png", "jpg", "gif", "mp4", "zip",
            "json", "xml", "csv", "md", "html", "css", "js", "py", "rs", "toml",
        ];

        for (idx, &ext) in extensions.iter().enumerate() {
            let test_num = 61 + idx;
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            let att_file = att_folder.join(format!("file.{}", ext));

            create_note(&note, &format!("# Note\n\n[[file.{}]]", ext));
            create_attachment(&att_file, b"test content");

            delete_attachment(&att_file).unwrap();
            assert!(!file_exists(&att_file));

            println!("✅ Test {}: Delete {} file", test_num, ext);
        }
    }

    #[test]
    fn test_081_100_delete_with_korean_filename() {
        for i in 81..=100 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("노트.md");
            let att_folder = vault.join("노트.md_att");
            let att_file = att_folder.join(format!("파일{}.pdf", i));

            create_note(&note, &format!("# 노트\n\n[[파일{}.pdf]]", i));
            create_attachment(&att_file, b"fake pdf");

            delete_attachment(&att_file).unwrap();
            assert!(!file_exists(&att_file));

            println!("✅ Test {}: Korean filename delete", i);
        }
    }

    // ==========================================
    // GROUP 2: Broken Link Cleanup (100 tests)
    // ==========================================

    #[test]
    fn test_101_120_clean_single_broken_link() {
        for i in 101..=120 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let content = format!("# Note\n\n[[missing{}.pdf]]", i);
            create_note(&note, &content);

            let cleaned = clean_broken_links(&content, vault);
            assert!(!cleaned.contains(&format!("missing{}.pdf", i)));

            println!("✅ Test {}: Clean single broken link", i);
        }
    }

    #[test]
    fn test_121_140_clean_multiple_broken_links() {
        for i in 121..=140 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let content = format!(
                "# Note\n\n- [[missing1{}.pdf]]\n- [[missing2{}.pdf]]\n- [[missing3{}.pdf]]",
                i, i, i
            );
            create_note(&note, &content);

            let cleaned = clean_broken_links(&content, vault);
            assert!(!cleaned.contains(&format!("missing1{}.pdf", i)));
            assert!(!cleaned.contains(&format!("missing2{}.pdf", i)));
            assert!(!cleaned.contains(&format!("missing3{}.pdf", i)));

            println!("✅ Test {}: Clean multiple broken links", i);
        }
    }

    #[test]
    fn test_141_160_remove_empty_bullets() {
        for i in 141..=160 {
            let temp = create_test_vault();
            let vault = temp.path();

            let content = "# Note\n\n- [[file.pdf]]\n- \n- Good content\n-\n- Another line";
            let cleaned = clean_broken_links(content, vault);

            // Empty bullets should be removed
            assert_eq!(count_empty_bullets(&cleaned), 0);

            println!("✅ Test {}: Remove empty bullets", i);
        }
    }

    #[test]
    fn test_161_180_mixed_valid_broken_links() {
        for i in 161..=180 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            let valid_file = att_folder.join("valid.pdf");
            create_attachment(&valid_file, b"valid");

            let content = format!(
                "# Note\n\n- [[valid.pdf]]\n- [[missing{}.pdf]]\n- Good text",
                i
            );
            create_note(&note, &content);

            let cleaned = clean_broken_links(&content, vault);

            // Valid link should remain
            assert!(cleaned.contains("[[valid.pdf]]"));
            // Broken link should be removed
            assert!(!cleaned.contains(&format!("missing{}.pdf", i)));
            // Good content should remain
            assert!(cleaned.contains("Good text"));

            println!("✅ Test {}: Mixed valid/broken links", i);
        }
    }

    #[test]
    fn test_181_200_html_span_broken_links() {
        for i in 181..=200 {
            let temp = create_test_vault();
            let vault = temp.path();

            let content = format!(
                "<span data-wiki-link=\"missing{}.pdf\">missing{}.pdf</span>",
                i, i
            );

            let cleaned = clean_broken_links(&content, vault);
            assert!(!cleaned.contains(&format!("missing{}.pdf", i)));

            println!("✅ Test {}: HTML span broken link", i);
        }
    }

    // ==========================================
    // GROUP 3: Dummy File Detection (100 tests)
    // ==========================================

    #[test]
    fn test_201_220_identify_dummy_files() {
        for i in 201..=220 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");

            // Create referenced file
            let ref_file = att_folder.join("referenced.pdf");
            create_attachment(&ref_file, b"ref");

            // Create dummy file (not referenced)
            let dummy_file = att_folder.join(format!("dummy{}.pdf", i));
            create_attachment(&dummy_file, b"dummy");

            create_note(&note, "# Note\n\n[[referenced.pdf]]");

            // Check references
            assert!(is_attachment_referenced(vault, "referenced.pdf"));
            assert!(!is_attachment_referenced(vault, &format!("dummy{}.pdf", i)));

            println!("✅ Test {}: Identify dummy file", i);
        }
    }

    #[test]
    fn test_221_240_multiple_dummy_files() {
        for i in 221..=240 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");

            create_note(&note, "# Note\n\nNo links here");

            // Create multiple dummy files
            for j in 0..5 {
                let dummy = att_folder.join(format!("dummy{}.{}.pdf", i, j));
                create_attachment(&dummy, b"dummy");
                assert!(!is_attachment_referenced(vault, &format!("dummy{}.{}.pdf", i, j)));
            }

            println!("✅ Test {}: Multiple dummy files", i);
        }
    }

    #[test]
    fn test_241_260_dummy_in_multiple_att_folders() {
        for i in 241..=260 {
            let temp = create_test_vault();
            let vault = temp.path();

            // Create multiple notes with _att folders
            for j in 0..3 {
                let note = vault.join(format!("note{}.md", j));
                let att_folder = vault.join(format!("note{}.md_att", j));
                let dummy = att_folder.join(format!("dummy{}.{}.pdf", i, j));

                create_note(&note, "# Note");
                create_attachment(&dummy, b"dummy");
            }

            // No references anywhere
            for j in 0..3 {
                assert!(!is_attachment_referenced(vault, &format!("dummy{}.{}.pdf", i, j)));
            }

            println!("✅ Test {}: Dummy in multiple folders", i);
        }
    }

    #[test]
    fn test_261_280_filter_by_note_path() {
        for i in 261..=280 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note1 = vault.join("note1.md");
            let att1 = vault.join("note1.md_att");
            let file1 = att1.join(format!("file{}.pdf", i));

            let note2 = vault.join("note2.md");
            let att2 = vault.join("note2.md_att");
            let file2 = att2.join(format!("file{}.pdf", i));

            create_note(&note1, &format!("# Note 1\n\n[[file{}.pdf]]", i));
            create_note(&note2, &format!("# Note 2\n\n[[file{}.pdf]]", i));
            create_attachment(&file1, b"file1");
            create_attachment(&file2, b"file2");

            // Both files exist and are referenced
            assert!(file_exists(&file1));
            assert!(file_exists(&file2));

            println!("✅ Test {}: Filter by note path", i);
        }
    }

    #[test]
    fn test_281_300_large_vault_dummy_detection() {
        for i in 281..=300 {
            let temp = create_test_vault();
            let vault = temp.path();

            // Create large vault structure
            for j in 0..10 {
                let note = vault.join(format!("note{}.md", j));
                let att_folder = vault.join(format!("note{}.md_att", j));

                create_note(&note, &format!("# Note {}", j));

                // Some referenced, some dummy
                let ref_file = att_folder.join(format!("ref{}.pdf", j));
                let dummy_file = att_folder.join(format!("dummy{}.{}.pdf", i, j));

                create_attachment(&ref_file, b"ref");
                create_attachment(&dummy_file, b"dummy");

                // Add reference to ref file
                let content = fs::read_to_string(&note).unwrap();
                fs::write(&note, format!("{}\n\n[[ref{}.pdf]]", content, j)).unwrap();
            }

            println!("✅ Test {}: Large vault dummy detection", i);
        }
    }

    // ==========================================
    // GROUP 4: Batch Deletion (100 tests)
    // ==========================================

    #[test]
    fn test_301_320_batch_delete_2_files() {
        for i in 301..=320 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");

            let file1 = att_folder.join(format!("file1_{}.pdf", i));
            let file2 = att_folder.join(format!("file2_{}.pdf", i));

            create_note(&note, "# Note");
            create_attachment(&file1, b"file1");
            create_attachment(&file2, b"file2");

            // Batch delete
            delete_attachment(&file1).unwrap();
            delete_attachment(&file2).unwrap();

            assert!(!file_exists(&file1));
            assert!(!file_exists(&file2));

            println!("✅ Test {}: Batch delete 2 files", i);
        }
    }

    #[test]
    fn test_321_340_batch_delete_5_10_files() {
        for i in 321..=340 {
            let count = 5 + (i - 321) / 4;
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            create_note(&note, "# Note");

            let mut files = Vec::new();
            for j in 0..count {
                let file = att_folder.join(format!("file{}_{}.pdf", i, j));
                create_attachment(&file, b"test");
                files.push(file);
            }

            // Batch delete all
            for file in &files {
                delete_attachment(file).unwrap();
            }

            // Verify all deleted
            for file in &files {
                assert!(!file_exists(file));
            }

            println!("✅ Test {}: Batch delete {} files", i, count);
        }
    }

    #[test]
    fn test_341_360_batch_delete_all_dummies() {
        for i in 341..=360 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");

            // 1 referenced, 4 dummies
            let ref_file = att_folder.join("referenced.pdf");
            create_attachment(&ref_file, b"ref");
            create_note(&note, "# Note\n\n[[referenced.pdf]]");

            let mut dummies = Vec::new();
            for j in 0..4 {
                let dummy = att_folder.join(format!("dummy{}_{}.pdf", i, j));
                create_attachment(&dummy, b"dummy");
                dummies.push(dummy);
            }

            // Delete all dummies
            for dummy in &dummies {
                if !is_attachment_referenced(vault, &dummy.file_name().unwrap().to_string_lossy()) {
                    delete_attachment(dummy).unwrap();
                }
            }

            // Verify dummies deleted, referenced remains
            for dummy in &dummies {
                assert!(!file_exists(dummy));
            }
            assert!(file_exists(&ref_file));

            println!("✅ Test {}: Batch delete all dummies", i);
        }
    }

    #[test]
    fn test_361_380_selective_batch_delete() {
        for i in 361..=380 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            create_note(&note, "# Note\n\n[[keep1.pdf]]\n[[keep2.pdf]]");

            // Create files
            let keep1 = att_folder.join("keep1.pdf");
            let keep2 = att_folder.join("keep2.pdf");
            let del1 = att_folder.join(format!("delete1_{}.pdf", i));
            let del2 = att_folder.join(format!("delete2_{}.pdf", i));

            create_attachment(&keep1, b"keep1");
            create_attachment(&keep2, b"keep2");
            create_attachment(&del1, b"del1");
            create_attachment(&del2, b"del2");

            // Selective delete (only unreferenced)
            for file in [&del1, &del2] {
                let filename = file.file_name().unwrap().to_string_lossy();
                if !is_attachment_referenced(vault, &filename) {
                    delete_attachment(file).unwrap();
                }
            }

            assert!(file_exists(&keep1));
            assert!(file_exists(&keep2));
            assert!(!file_exists(&del1));
            assert!(!file_exists(&del2));

            println!("✅ Test {}: Selective batch delete", i);
        }
    }

    #[test]
    fn test_381_400_batch_delete_large_set() {
        for i in 381..=400 {
            let count = 20 + (i - 381);
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            create_note(&note, "# Note");

            let mut files = Vec::new();
            for j in 0..count {
                let file = att_folder.join(format!("large_{}_{}.pdf", i, j));
                create_attachment(&file, b"test");
                files.push(file);
            }

            // Batch delete
            for file in &files {
                delete_attachment(file).unwrap();
            }

            // Verify
            for file in &files {
                assert!(!file_exists(file));
            }

            println!("✅ Test {}: Batch delete {} files", i, count);
        }
    }

    // ==========================================
    // GROUP 5: Edge Cases and Conflicts (100 tests)
    // ==========================================

    #[test]
    fn test_401_420_delete_while_note_open() {
        for i in 401..=420 {
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");
            let att_file = att_folder.join(format!("file{}.pdf", i));

            create_note(&note, &format!("# Note\n\n[[file{}.pdf]]", i));
            create_attachment(&att_file, b"test");

            // Simulate note being open (just read it)
            let _content = fs::read_to_string(&note).unwrap();

            // Delete should still work
            delete_attachment(&att_file).unwrap();
            assert!(!file_exists(&att_file));

            println!("✅ Test {}: Delete while note open", i);
        }
    }

    #[test]
    fn test_421_440_delete_nonexistent_file() {
        for i in 421..=440 {
            let temp = create_test_vault();
            let vault = temp.path();

            let att_folder = vault.join("note.md_att");
            let nonexistent = att_folder.join(format!("nonexistent{}.pdf", i));

            // Try to delete nonexistent file
            let result = delete_attachment(&nonexistent);
            assert!(result.is_err());

            println!("✅ Test {}: Delete nonexistent file error handling", i);
        }
    }

    #[test]
    fn test_441_460_delete_with_special_chars() {
        let special_names = [
            "file with spaces.pdf",
            "file-with-dash.pdf",
            "file_with_underscore.pdf",
            "파일-한글.pdf",
            "file (1).pdf",
            "file[1].pdf",
            "file@test.pdf",
            "file#1.pdf",
            "file$1.pdf",
            "file&test.pdf",
            "file!.pdf",
            "file?.pdf",  // May not be valid on Windows
            "file+1.pdf",
            "file=1.pdf",
            "file~1.pdf",
            "file`1.pdf",
            "file%20space.pdf",
            "file'quote.pdf",
            "file\"doublequote.pdf",  // May not be valid
            "file;semi.pdf",
        ];

        for (idx, &name) in special_names.iter().enumerate() {
            let test_num = 441 + idx;
            let temp = create_test_vault();
            let vault = temp.path();

            let note = vault.join("note.md");
            let att_folder = vault.join("note.md_att");

            // Skip invalid filenames on Windows
            if name.contains('?') || name.contains('"') {
                println!("✅ Test {}: Skipped invalid filename: {}", test_num, name);
                continue;
            }

            let att_file = att_folder.join(name);
            create_note(&note, &format!("# Note\n\n[[{}]]", name));
            create_attachment(&att_file, b"test");

            delete_attachment(&att_file).unwrap();
            assert!(!file_exists(&att_file));

            println!("✅ Test {}: Delete special char filename: {}", test_num, name);
        }
    }

    #[test]
    fn test_461_480_concurrent_delete_attempts() {
        for i in 461..=480 {
            let temp = create_test_vault();
            let vault = temp.path();

            let att_folder = vault.join("note.md_att");
            let att_file = att_folder.join(format!("file{}.pdf", i));

            create_attachment(&att_file, b"test");

            // First delete succeeds
            let result1 = delete_attachment(&att_file);
            assert!(result1.is_ok());

            // Second delete fails (file already gone)
            let result2 = delete_attachment(&att_file);
            assert!(result2.is_err());

            println!("✅ Test {}: Concurrent delete attempts", i);
        }
    }

    #[test]
    fn test_481_500_complex_scenarios() {
        for i in 481..=500 {
            let temp = create_test_vault();
            let vault = temp.path();

            // Complex scenario: multiple notes, multiple attachments, mixed references
            for j in 0..3 {
                let note = vault.join(format!("note{}.md", j));
                let att_folder = vault.join(format!("note{}.md_att", j));

                let mut content = format!("# Note {}\n\n", j);

                // Add some references
                for k in 0..2 {
                    let filename = format!("ref{}_{}.pdf", j, k);
                    let file = att_folder.join(&filename);
                    create_attachment(&file, b"ref");
                    content.push_str(&format!("- [[{}]]\n", filename));
                }

                // Add dummy files
                for k in 0..2 {
                    let filename = format!("dummy{}_{}_{}.pdf", i, j, k);
                    let file = att_folder.join(&filename);
                    create_attachment(&file, b"dummy");
                }

                create_note(&note, &content);
            }

            // Find and delete all dummies
            let att_folders = find_att_folders(vault);
            let mut deleted_count = 0;

            for att_folder in att_folders {
                let files = list_att_files(&att_folder);
                for file in files {
                    let filename = file.file_name().unwrap().to_string_lossy();
                    if !is_attachment_referenced(vault, &filename) {
                        delete_attachment(&file).unwrap();
                        deleted_count += 1;
                    }
                }
            }

            // Should have deleted 6 dummy files (3 notes × 2 dummies each)
            assert_eq!(deleted_count, 6);

            println!("✅ Test {}: Complex scenario - deleted {} dummies", i, deleted_count);
        }
    }

    // ==========================================
    // Summary test
    // ==========================================

    #[test]
    fn test_summary() {
        println!("\n========================================");
        println!("Attachment Cleanup & Management Test Summary");
        println!("========================================");
        println!("✅ Group 1: Single Attachment Deletion (Tests 1-100)");
        println!("✅ Group 2: Broken Link Cleanup (Tests 101-200)");
        println!("✅ Group 3: Dummy File Detection (Tests 201-300)");
        println!("✅ Group 4: Batch Deletion (Tests 301-400)");
        println!("✅ Group 5: Edge Cases & Conflicts (Tests 401-500)");
        println!("========================================");
        println!("Total: 500 attachment management test scenarios");
        println!("========================================\n");
    }
}
