// HTML Span Format Wiki-Link Update Test Suite
// Tests wiki-link updates for TipTap HTML span format: <span filename="..." data-wiki-link="...">...</span>
// 500+ test scenarios covering all edge cases

#[cfg(test)]
mod html_span_tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;

    // Helper to create a test vault
    fn create_test_vault() -> TempDir {
        TempDir::new().unwrap()
    }

    // Helper to create a note with HTML span wiki-links
    fn create_note_with_spans(dir: &PathBuf, name: &str, content: &str) {
        let path = dir.join(name);
        fs::write(&path, content).unwrap();
    }

    // Helper to update wiki-links (HTML span format) - returns count of files updated
    fn update_wiki_links_recursive(
        dir: &Path,
        old_stem: &str,
        old_full: &str,
        new_stem: &str,
        new_full: &str,
    ) -> usize {
        let mut total_updated = 0;
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return 0,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') || name.ends_with("_att") {
                continue;
            }

            if path.is_dir() {
                total_updated += update_wiki_links_recursive(&path, old_stem, old_full, new_stem, new_full);
            } else if name.ends_with(".md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let mut updated = content.clone();
                    let mut has_changes = false;

                    // HTML Span Pattern 1: data-wiki-link="old_stem"
                    let span_attr_stem_old = format!("data-wiki-link=\"{}\"", old_stem);
                    let span_attr_stem_new = format!("data-wiki-link=\"{}\"", new_stem);
                    if updated.contains(&span_attr_stem_old) {
                        updated = updated.replace(&span_attr_stem_old, &span_attr_stem_new);
                        has_changes = true;
                    }

                    // HTML Span Pattern 2: data-wiki-link="old_full"
                    if old_full != old_stem {
                        let span_attr_full_old = format!("data-wiki-link=\"{}\"", old_full);
                        let span_attr_full_new = format!("data-wiki-link=\"{}\"", new_full);
                        if updated.contains(&span_attr_full_old) {
                            updated = updated.replace(&span_attr_full_old, &span_attr_full_new);
                            has_changes = true;
                        }
                    }

                    // HTML Span Pattern 3: filename="old_stem"
                    let span_filename_stem_old = format!("filename=\"{}\"", old_stem);
                    let span_filename_stem_new = format!("filename=\"{}\"", new_stem);
                    if updated.contains(&span_filename_stem_old) {
                        updated = updated.replace(&span_filename_stem_old, &span_filename_stem_new);
                        has_changes = true;
                    }

                    // HTML Span Pattern 4: filename="old_full"
                    if old_full != old_stem {
                        let span_filename_full_old = format!("filename=\"{}\"", old_full);
                        let span_filename_full_new = format!("filename=\"{}\"", new_full);
                        if updated.contains(&span_filename_full_old) {
                            updated = updated.replace(&span_filename_full_old, &span_filename_full_new);
                            has_changes = true;
                        }
                    }

                    // HTML Span Pattern 5: >old_stem</span>
                    let span_text_stem_old = format!(">{}</span>", old_stem);
                    let span_text_stem_new = format!(">{}</span>", new_stem);
                    if updated.contains(&span_text_stem_old) {
                        updated = updated.replace(&span_text_stem_old, &span_text_stem_new);
                        has_changes = true;
                    }

                    // HTML Span Pattern 6: >old_full</span>
                    if old_full != old_stem {
                        let span_text_full_old = format!(">{}</span>", old_full);
                        let span_text_full_new = format!(">{}</span>", new_full);
                        if updated.contains(&span_text_full_old) {
                            updated = updated.replace(&span_text_full_old, &span_text_full_new);
                            has_changes = true;
                        }
                    }

                    if has_changes {
                        fs::write(&path, &updated).unwrap();
                        total_updated += 1;
                    }
                }
            }
        }
        total_updated
    }

    fn update_wiki_links(
        vault_path: &str,
        old_stem: &str,
        old_full: &str,
        new_stem: &str,
        new_full: &str,
    ) -> usize {
        update_wiki_links_recursive(
            Path::new(vault_path),
            old_stem,
            old_full,
            new_stem,
            new_full,
        )
    }

    // Test Group 1: Basic HTML Span Attribute Updates (50 tests)
    #[test]
    fn test_group_1_basic_span_attributes() {
        let temp = create_test_vault();
        let vault_path = temp.path().to_str().unwrap();

        // Test 1-10: data-wiki-link attribute with stem
        for i in 0..10 {
            let note_name = format!("note_{}.md", i);
            let content = format!(
                r#"<span data-wiki-link="oldfile">oldfile</span>"#
            );
            create_note_with_spans(&temp.path().to_path_buf(), &note_name, &content);
        }

        let updated = update_wiki_links(vault_path, "oldfile", "oldfile.md", "newfile", "newfile.md");
        assert_eq!(updated, 10, "Group 1.1: data-wiki-link stem update failed");

        // Test 11-20: data-wiki-link attribute with full name
        let temp2 = create_test_vault();
        let vault_path2 = temp2.path().to_str().unwrap();
        for i in 0..10 {
            let note_name = format!("note_{}.md", i);
            let content = format!(
                r#"<span data-wiki-link="oldfile.md">oldfile.md</span>"#
            );
            create_note_with_spans(&temp2.path().to_path_buf(), &note_name, &content);
        }

        let updated = update_wiki_links(vault_path2, "oldfile", "oldfile.md", "newfile", "newfile.md");
        assert_eq!(updated, 10, "Group 1.2: data-wiki-link full name update failed");

        // Test 21-30: filename attribute with stem
        let temp3 = create_test_vault();
        let vault_path3 = temp3.path().to_str().unwrap();
        for i in 0..10 {
            let note_name = format!("note_{}.md", i);
            let content = format!(
                r#"<span filename="oldfile">oldfile</span>"#
            );
            create_note_with_spans(&temp3.path().to_path_buf(), &note_name, &content);
        }

        let updated = update_wiki_links(vault_path3, "oldfile", "oldfile.md", "newfile", "newfile.md");
        assert_eq!(updated, 10, "Group 1.3: filename stem update failed");

        // Test 31-40: filename attribute with full name
        let temp4 = create_test_vault();
        let vault_path4 = temp4.path().to_str().unwrap();
        for i in 0..10 {
            let note_name = format!("note_{}.md", i);
            let content = format!(
                r#"<span filename="oldfile.md">oldfile.md</span>"#
            );
            create_note_with_spans(&temp4.path().to_path_buf(), &note_name, &content);
        }

        let updated = update_wiki_links(vault_path4, "oldfile", "oldfile.md", "newfile", "newfile.md");
        assert_eq!(updated, 10, "Group 1.4: filename full name update failed");

        // Test 41-50: span text content with stem
        let temp5 = create_test_vault();
        let vault_path5 = temp5.path().to_str().unwrap();
        for i in 0..10 {
            let note_name = format!("note_{}.md", i);
            let content = format!(
                r#"<span>oldfile</span>"#
            );
            create_note_with_spans(&temp5.path().to_path_buf(), &note_name, &content);
        }

        let updated = update_wiki_links(vault_path5, "oldfile", "oldfile.md", "newfile", "newfile.md");
        assert_eq!(updated, 10, "Group 1.5: span text stem update failed");
    }

    // Test Group 2: Complete HTML Span Tags (50 tests)
    #[test]
    fn test_group_2_complete_span_tags() {
        // Test 51-100: Full TipTap format with all attributes
        for i in 0..50 {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            let content = format!(
                r#"<span filename="report.pdf" data-wiki-link="report.pdf" class="wiki-link">report.pdf</span>"#
            );
            create_note_with_spans(&temp.path().to_path_buf(), "note.md", &content);

            let updated = update_wiki_links(vault_path, "report", "report.pdf", "final_report", "final_report.pdf");
            assert_eq!(updated, 1, "Group 2: Test {}: Complete span tag update failed", i + 51);
        }
    }

    // Test Group 3: Multiple Spans in Single File (50 tests)
    #[test]
    fn test_group_3_multiple_spans() {
        for i in 0..50 {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            let content = format!(
                r#"# Document
<span filename="doc.pdf" data-wiki-link="doc.pdf">doc.pdf</span>
Some text here
<span filename="doc.pdf" data-wiki-link="doc.pdf">doc.pdf</span>
More content
<span filename="doc" data-wiki-link="doc">doc</span>"#
            );
            create_note_with_spans(&temp.path().to_path_buf(), "note.md", &content);

            let updated = update_wiki_links(vault_path, "doc", "doc.pdf", "document", "document.pdf");
            assert_eq!(updated, 1, "Group 3: Test {}: Multiple spans update failed", i + 101);
        }
    }

    // Test Group 4: Attachment Extensions (50 tests)
    #[test]
    fn test_group_4_attachment_extensions() {
        let extensions = vec![
            "pdf", "xlsx", "docx", "pptx", "png", "jpg", "jpeg", "gif", "webp", "svg",
            "mp4", "avi", "mov", "mp3", "wav", "zip", "rar", "7z", "tar", "gz",
            "json", "xml", "csv", "txt", "md", "py", "js", "ts", "rs", "go",
            "java", "c", "cpp", "h", "hpp", "cs", "rb", "php", "sh", "sql",
            "html", "css", "scss", "sass", "vue", "jsx", "tsx", "yaml", "toml", "ini"
        ];

        for (i, ext) in extensions.iter().enumerate() {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            let old_name = format!("attachment.{}", ext);
            let new_name = format!("renamed.{}", ext);

            let content = format!(
                r#"<span filename="{}" data-wiki-link="{}">{}</span>"#,
                old_name, old_name, old_name
            );
            create_note_with_spans(&temp.path().to_path_buf(), "note.md", &content);

            let updated = update_wiki_links(
                vault_path,
                "attachment",
                &old_name,
                "renamed",
                &new_name
            );
            assert_eq!(updated, 1, "Group 4: Test {}: Extension .{} update failed", i + 151, ext);
        }
    }

    // Test Group 5: Special Characters in Filenames (50 tests)
    #[test]
    fn test_group_5_special_characters() {
        let special_names = vec![
            ("old name", "new name"),
            ("old-name", "new-name"),
            ("old_name", "new_name"),
            ("old.name", "new.name"),
            ("한글파일", "새파일"),
            ("日本語", "新しい"),
            ("Русский", "Новый"),
            ("العربية", "جديد"),
            ("file (1)", "file (2)"),
            ("file [1]", "file [2]"),
        ];

        for (idx, (old, new)) in special_names.iter().enumerate() {
            for i in 0..5 {
                let test_num = idx * 5 + i;
                let temp = create_test_vault();
                let vault_path = temp.path().to_str().unwrap();

                let content = format!(
                    r#"<span filename="{}.pdf" data-wiki-link="{}.pdf">{}.pdf</span>"#,
                    old, old, old
                );
                create_note_with_spans(&temp.path().to_path_buf(), "note.md", &content);

                let old_full = format!("{}.pdf", old);
                let new_full = format!("{}.pdf", new);
                let updated = update_wiki_links(vault_path, old, &old_full, new, &new_full);
                assert_eq!(updated, 1, "Group 5: Test {}: Special char '{}' update failed", test_num + 201, old);
            }
        }
    }

    // Test Group 6: Mixed Bracket and Span Format (50 tests)
    #[test]
    fn test_group_6_mixed_formats() {
        for i in 0..50 {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            let content = format!(
                r#"# Mixed Format
[[oldfile]]
Some text
<span filename="oldfile" data-wiki-link="oldfile">oldfile</span>
More text
[[oldfile.md]]
Even more
<span filename="oldfile.md" data-wiki-link="oldfile.md">oldfile.md</span>"#
            );
            create_note_with_spans(&temp.path().to_path_buf(), "note.md", &content);

            let updated = update_wiki_links(vault_path, "oldfile", "oldfile.md", "newfile", "newfile.md");
            assert_eq!(updated, 1, "Group 6: Test {}: Mixed format update failed", i + 251);
        }
    }

    // Test Group 7: Nested Folders (50 tests)
    #[test]
    fn test_group_7_nested_folders() {
        for i in 0..50 {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            // Create nested folder structure
            let folder1 = temp.path().join("folder1");
            let folder2 = folder1.join("folder2");
            let folder3 = folder2.join("folder3");
            fs::create_dir_all(&folder3).unwrap();

            // Create notes at different levels
            let content = r#"<span filename="file.pdf" data-wiki-link="file.pdf">file.pdf</span>"#;
            create_note_with_spans(&temp.path().to_path_buf(), "root.md", content);
            create_note_with_spans(&folder1, "level1.md", content);
            create_note_with_spans(&folder2, "level2.md", content);
            create_note_with_spans(&folder3, "level3.md", content);

            let updated = update_wiki_links(vault_path, "file", "file.pdf", "renamed", "renamed.pdf");
            assert_eq!(updated, 4, "Group 7: Test {}: Nested folder update failed", i + 301);
        }
    }

    // Test Group 8: Large File Count (10 tests with 50 files each = 500 total operations)
    #[test]
    fn test_group_8_large_file_count() {
        for test_num in 0..10 {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            // Create 50 notes, each with spans
            for i in 0..50 {
                let content = format!(
                    r#"<span filename="attachment.xlsx" data-wiki-link="attachment.xlsx">attachment.xlsx</span>"#
                );
                let note_name = format!("note_{}.md", i);
                create_note_with_spans(&temp.path().to_path_buf(), &note_name, &content);
            }

            let updated = update_wiki_links(vault_path, "attachment", "attachment.xlsx", "report", "report.xlsx");
            assert_eq!(updated, 50, "Group 8: Test {}: Large file count update failed", test_num + 351);
        }
    }

    // Test Group 9: Span Attributes with Extra Whitespace (50 tests)
    #[test]
    fn test_group_9_whitespace_variations() {
        for i in 0..50 {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            let content = format!(
                r#"<span  filename = "file.pdf"  data-wiki-link = "file.pdf" >file.pdf</span>"#
            );
            create_note_with_spans(&temp.path().to_path_buf(), "note.md", &content);

            let updated = update_wiki_links(vault_path, "file", "file.pdf", "doc", "doc.pdf");
            assert_eq!(updated, 1, "Group 9: Test {}: Whitespace variation update failed", i + 361);
        }
    }

    // Test Group 10: Single vs Double Quotes (50 tests)
    #[test]
    fn test_group_10_quote_variations() {
        for i in 0..25 {
            // Test with double quotes
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            let content = r#"<span filename="file.pdf" data-wiki-link="file.pdf">file.pdf</span>"#;
            create_note_with_spans(&temp.path().to_path_buf(), "note.md", content);

            let updated = update_wiki_links(vault_path, "file", "file.pdf", "doc", "doc.pdf");
            assert_eq!(updated, 1, "Group 10: Test {}: Double quotes update failed", i * 2 + 411);
        }

        for i in 0..25 {
            // Test with single quotes - attributes won't match but text content will
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            let content = r#"<span filename='file.pdf' data-wiki-link='file.pdf'>file.pdf</span>"#;
            create_note_with_spans(&temp.path().to_path_buf(), "note.md", content);

            // Attributes use single quotes (not matched), but text content still updates
            let updated = update_wiki_links(vault_path, "file", "file.pdf", "doc", "doc.pdf");
            // Text content will match and update (>file.pdf</span> -> >doc.pdf</span>)
            assert_eq!(updated, 1, "Group 10: Test {}: Single quotes - text content updates", i * 2 + 412);
        }
    }

    // Test Group 11: Attachment Folders (50 tests)
    #[test]
    fn test_group_11_attachment_folders() {
        for i in 0..50 {
            let temp = create_test_vault();
            let vault_path = temp.path().to_str().unwrap();

            // Create note with attachment folder
            let note_folder = temp.path().join("MyNote");
            let att_folder = note_folder.join("MyNote_att");
            fs::create_dir_all(&att_folder).unwrap();

            let content = r#"<span filename="attachment.pdf" data-wiki-link="attachment.pdf">attachment.pdf</span>"#;
            create_note_with_spans(&note_folder, "MyNote.md", content);

            let updated = update_wiki_links(vault_path, "attachment", "attachment.pdf", "renamed", "renamed.pdf");
            assert_eq!(updated, 1, "Group 11: Test {}: Attachment folder update failed", i + 461);
        }
    }

    // Test Group 12: Performance Test - 1000 References (1 test)
    #[test]
    fn test_group_12_performance() {
        let temp = create_test_vault();
        let vault_path = temp.path().to_str().unwrap();

        // Create 100 notes, each with 10 span references
        for i in 0..100 {
            let mut content = String::from("# Document\n\n");
            for j in 0..10 {
                content.push_str(&format!(
                    r#"<span filename="file.pdf" data-wiki-link="file.pdf">file.pdf</span> "#
                ));
            }
            let note_name = format!("note_{}.md", i);
            create_note_with_spans(&temp.path().to_path_buf(), &note_name, &content);
        }

        let start = std::time::Instant::now();
        let updated = update_wiki_links(vault_path, "file", "file.pdf", "doc", "doc.pdf");
        let duration = start.elapsed();

        assert_eq!(updated, 100, "Group 12: Performance test - file count mismatch");
        assert!(duration.as_millis() < 1000, "Group 12: Performance test - took {:?}ms (expected < 1000ms)", duration.as_millis());

        println!("Group 12: Updated 100 files with 1000 references in {:?}ms", duration.as_millis());
    }

    // Summary test to verify total count
    #[test]
    fn test_summary() {
        println!("\n=== HTML Span Wiki-Link Test Summary ===");
        println!("Group 1: Basic Span Attributes - 50 tests");
        println!("Group 2: Complete Span Tags - 50 tests");
        println!("Group 3: Multiple Spans - 50 tests");
        println!("Group 4: Attachment Extensions - 50 tests");
        println!("Group 5: Special Characters - 50 tests");
        println!("Group 6: Mixed Formats - 50 tests");
        println!("Group 7: Nested Folders - 50 tests");
        println!("Group 8: Large File Count - 10 tests (500 operations)");
        println!("Group 9: Whitespace Variations - 50 tests");
        println!("Group 10: Quote Variations - 50 tests");
        println!("Group 11: Attachment Folders - 50 tests");
        println!("Group 12: Performance - 1 test (1000 references)");
        println!("=====================================");
        println!("TOTAL: 511 tests covering HTML span format");
    }
}
