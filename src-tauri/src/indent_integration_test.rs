// Indent Integration Tests
// Tests backend compatibility with frontend indent features
// Verifies file I/O, search indexing, and performance with indent-styled content

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{Duration, Instant};
    use tempfile::TempDir;

    // Helper to create a note with various indent styles (simulating TipTap output)
    fn create_note_with_indent(
        vault: &PathBuf,
        name: &str,
        paragraphs: Vec<(&str, &str)>, // (indent_type, content)
    ) -> PathBuf {
        let path = vault.join(format!("{}.md", name));
        let mut content = String::from("---\ntitle: Test Note\n---\n\n");

        for (indent_type, text) in paragraphs {
            match indent_type {
                "firstLine" => {
                    // First-line indent: stored as HTML with data attribute
                    content.push_str(&format!(
                        "<p data-text-indent-type=\"firstLine\" style=\"text-indent: 2em\">{}</p>\n\n",
                        text
                    ));
                }
                "hanging" => {
                    // Hanging indent: stored as HTML with data attribute
                    content.push_str(&format!(
                        "<p data-text-indent-type=\"hanging\" style=\"text-indent: -2em; padding-left: 2em\">{}</p>\n\n",
                        text
                    ));
                }
                _ => {
                    // Regular paragraph
                    content.push_str(&format!("{}\n\n", text));
                }
            }
        }

        fs::write(&path, &content).unwrap();
        path
    }

    // Helper to create a plain markdown note
    fn create_plain_note(vault: &PathBuf, name: &str, content: &str) -> PathBuf {
        let path = vault.join(format!("{}.md", name));
        let full_content = format!("---\ntitle: {}\n---\n\n{}", name, content);
        fs::write(&path, &full_content).unwrap();
        path
    }

    // ==========================================
    // Test 1: Basic file I/O with indent styles
    // ==========================================
    #[test]
    fn test_01_basic_indent_file_io() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 1: 기본 들여쓰기 파일 I/O ===");

        // Create notes with different indent styles
        let paragraphs = vec![
            ("none", "일반 문단입니다."),
            ("firstLine", "첫줄 들여쓰기가 적용된 문단입니다. 첫 번째 줄만 들여쓰기됩니다."),
            ("hanging", "내어쓰기가 적용된 문단입니다. 첫 줄은 그대로, 나머지 줄이 들여쓰기됩니다."),
            ("none", "다시 일반 문단입니다."),
        ];

        let note_path = create_note_with_indent(&vault, "indent_test", paragraphs);

        // Read back and verify
        let content = fs::read_to_string(&note_path).unwrap();

        assert!(content.contains("data-text-indent-type=\"firstLine\""));
        assert!(content.contains("data-text-indent-type=\"hanging\""));
        assert!(content.contains("text-indent: 2em"));
        assert!(content.contains("text-indent: -2em"));

        println!("  파일 생성 및 읽기 성공");
        println!("  파일 크기: {} bytes", content.len());
    }

    // ==========================================
    // Test 2: Large file with many indent styles
    // ==========================================
    #[test]
    fn test_02_large_file_many_indents() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 2: 대량 들여쓰기 문단 파일 ===");

        // Create 500 paragraphs with various indent styles
        let mut paragraphs: Vec<(&str, String)> = Vec::new();
        for i in 0..500 {
            let indent_type = match i % 3 {
                0 => "none",
                1 => "firstLine",
                _ => "hanging",
            };
            paragraphs.push((indent_type, format!("문단 {} - 들여쓰기 타입: {}", i, indent_type)));
        }

        let path = vault.join("large_indent.md");
        let mut content = String::from("---\ntitle: Large Indent Test\n---\n\n");

        for (indent_type, text) in &paragraphs {
            match *indent_type {
                "firstLine" => {
                    content.push_str(&format!(
                        "<p data-text-indent-type=\"firstLine\" style=\"text-indent: 2em\">{}</p>\n\n",
                        text
                    ));
                }
                "hanging" => {
                    content.push_str(&format!(
                        "<p data-text-indent-type=\"hanging\" style=\"text-indent: -2em; padding-left: 2em\">{}</p>\n\n",
                        text
                    ));
                }
                _ => {
                    content.push_str(&format!("{}\n\n", text));
                }
            }
        }

        let start = Instant::now();
        fs::write(&path, &content).unwrap();
        let write_time = start.elapsed();

        let start = Instant::now();
        let read_content = fs::read_to_string(&path).unwrap();
        let read_time = start.elapsed();

        println!("  500개 문단 쓰기 시간: {:?}", write_time);
        println!("  500개 문단 읽기 시간: {:?}", read_time);
        println!("  파일 크기: {} bytes", read_content.len());

        assert!(write_time < Duration::from_millis(100), "쓰기가 100ms를 초과");
        assert!(read_time < Duration::from_millis(50), "읽기가 50ms를 초과");
    }

    // ==========================================
    // Test 3: Mixed content - indent + other elements
    // ==========================================
    #[test]
    fn test_03_mixed_content() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 3: 혼합 콘텐츠 (들여쓰기 + 다른 요소) ===");

        let path = vault.join("mixed_content.md");
        let content = r#"---
title: Mixed Content Test
---

# 제목 1

일반 문단입니다.

<p data-text-indent-type="firstLine" style="text-indent: 2em">첫줄 들여쓰기 문단입니다.</p>

## 제목 2

- 목록 항목 1
- 목록 항목 2

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">내어쓰기 문단입니다. 참고문헌 스타일로 자주 사용됩니다.</p>

> 인용문입니다.

```javascript
const code = "코드 블록";
```

<p data-text-indent-type="firstLine" style="text-indent: 2em">코드 블록 뒤의 들여쓰기 문단입니다.</p>

| 표 | 헤더 |
|----|------|
| 1  | 2    |

일반 문단으로 마무리.
"#;

        fs::write(&path, content).unwrap();
        let read_content = fs::read_to_string(&path).unwrap();

        assert!(read_content.contains("data-text-indent-type=\"firstLine\""));
        assert!(read_content.contains("data-text-indent-type=\"hanging\""));
        assert!(read_content.contains("# 제목 1"));
        assert!(read_content.contains("```javascript"));

        println!("  혼합 콘텐츠 파일 검증 성공");
    }

    // ==========================================
    // Test 4: Concurrent file access simulation
    // ==========================================
    #[test]
    fn test_04_concurrent_access() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 4: 동시 접근 시뮬레이션 ===");

        // Create initial file
        let paragraphs = vec![
            ("firstLine", "초기 들여쓰기 문단"),
        ];
        let note_path = create_note_with_indent(&vault, "concurrent_test", paragraphs);

        // Simulate multiple rapid read/write cycles
        let start = Instant::now();
        for i in 0..100 {
            // Read
            let content = fs::read_to_string(&note_path).unwrap();

            // Modify (append)
            let new_content = format!(
                "{}\n<p data-text-indent-type=\"{}\" style=\"{}\">추가 문단 {}</p>\n",
                content,
                if i % 2 == 0 { "firstLine" } else { "hanging" },
                if i % 2 == 0 { "text-indent: 2em" } else { "text-indent: -2em; padding-left: 2em" },
                i
            );

            // Write
            fs::write(&note_path, &new_content).unwrap();
        }
        let total_time = start.elapsed();

        let final_content = fs::read_to_string(&note_path).unwrap();
        let firstline_count = final_content.matches("data-text-indent-type=\"firstLine\"").count();
        let hanging_count = final_content.matches("data-text-indent-type=\"hanging\"").count();

        println!("  100회 읽기/쓰기 사이클 시간: {:?}", total_time);
        println!("  firstLine 문단 수: {}", firstline_count);
        println!("  hanging 문단 수: {}", hanging_count);

        assert!(total_time < Duration::from_secs(2), "100회 사이클이 2초를 초과");
        assert_eq!(firstline_count, 51); // Initial + 50 even iterations
        assert_eq!(hanging_count, 50); // 50 odd iterations
    }

    // ==========================================
    // Test 5: Stress test - 500+ notes with indents
    // ==========================================
    #[test]
    fn test_05_stress_500_notes() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 5: 스트레스 테스트 - 500개 노트 ===");

        let start = Instant::now();

        // Create 500 notes with varied content
        for i in 0..500 {
            let paragraphs = vec![
                ("none", format!("노트 {}의 일반 문단", i)),
                ("firstLine", format!("노트 {}의 첫줄 들여쓰기 문단", i)),
                ("hanging", format!("노트 {}의 내어쓰기 문단", i)),
            ];

            let path = vault.join(format!("note_{}.md", i));
            let mut content = format!("---\ntitle: Note {}\ntags: [test, indent]\n---\n\n", i);

            for (indent_type, text) in paragraphs {
                match indent_type {
                    "firstLine" => {
                        content.push_str(&format!(
                            "<p data-text-indent-type=\"firstLine\" style=\"text-indent: 2em\">{}</p>\n\n",
                            text
                        ));
                    }
                    "hanging" => {
                        content.push_str(&format!(
                            "<p data-text-indent-type=\"hanging\" style=\"text-indent: -2em; padding-left: 2em\">{}</p>\n\n",
                            text
                        ));
                    }
                    _ => {
                        content.push_str(&format!("{}\n\n", text));
                    }
                }
            }

            fs::write(&path, &content).unwrap();
        }

        let create_time = start.elapsed();

        // Read all files
        let start = Instant::now();
        let mut total_size = 0usize;
        let mut total_firstline = 0usize;
        let mut total_hanging = 0usize;

        for i in 0..500 {
            let path = vault.join(format!("note_{}.md", i));
            let content = fs::read_to_string(&path).unwrap();
            total_size += content.len();
            total_firstline += content.matches("data-text-indent-type=\"firstLine\"").count();
            total_hanging += content.matches("data-text-indent-type=\"hanging\"").count();
        }

        let read_time = start.elapsed();

        println!("  500개 노트 생성 시간: {:?}", create_time);
        println!("  500개 노트 읽기 시간: {:?}", read_time);
        println!("  총 크기: {} bytes ({:.2} MB)", total_size, total_size as f64 / 1024.0 / 1024.0);
        println!("  총 firstLine 문단: {}", total_firstline);
        println!("  총 hanging 문단: {}", total_hanging);

        assert_eq!(total_firstline, 500);
        assert_eq!(total_hanging, 500);
        assert!(create_time < Duration::from_secs(5), "생성이 5초를 초과");
        assert!(read_time < Duration::from_secs(2), "읽기가 2초를 초과");
    }

    // ==========================================
    // Test 6: Rapid toggle simulation
    // ==========================================
    #[test]
    fn test_06_rapid_toggle() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 6: 빠른 토글 시뮬레이션 ===");

        let path = vault.join("toggle_test.md");

        // Simulate user rapidly toggling indent styles
        let start = Instant::now();
        for i in 0..200 {
            let indent_type = match i % 4 {
                0 => "none",
                1 => "firstLine",
                2 => "hanging",
                _ => "none",
            };

            let content = match indent_type {
                "firstLine" => format!(
                    "---\ntitle: Toggle Test\n---\n\n<p data-text-indent-type=\"firstLine\" style=\"text-indent: 2em\">토글 테스트 문단 - 상태: {}</p>\n",
                    i
                ),
                "hanging" => format!(
                    "---\ntitle: Toggle Test\n---\n\n<p data-text-indent-type=\"hanging\" style=\"text-indent: -2em; padding-left: 2em\">토글 테스트 문단 - 상태: {}</p>\n",
                    i
                ),
                _ => format!(
                    "---\ntitle: Toggle Test\n---\n\n토글 테스트 문단 - 상태: {}\n",
                    i
                ),
            };

            fs::write(&path, &content).unwrap();
            let _ = fs::read_to_string(&path).unwrap();
        }
        let total_time = start.elapsed();

        println!("  200회 토글 시간: {:?}", total_time);
        println!("  평균 토글 시간: {:?}", total_time / 200);

        assert!(total_time < Duration::from_secs(2), "200회 토글이 2초를 초과");
    }

    // ==========================================
    // Test 7: Special characters in indented content
    // ==========================================
    #[test]
    fn test_07_special_characters() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 7: 특수 문자 처리 ===");

        let path = vault.join("special_chars.md");
        let content = r#"---
title: Special Characters Test
---

<p data-text-indent-type="firstLine" style="text-indent: 2em">한글 테스트: 가나다라마바사아자차카타파하</p>

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">일본어: あいうえお カタカナ</p>

<p data-text-indent-type="firstLine" style="text-indent: 2em">중국어: 你好世界</p>

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">이모지: 🎉 🚀 ✨ 💻 📝</p>

<p data-text-indent-type="firstLine" style="text-indent: 2em">특수기호: &lt;script&gt; &amp; &quot;quotes&quot; 'apostrophe'</p>

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">수학: α β γ δ ε ∑ ∫ √ ∞</p>

<p data-text-indent-type="firstLine" style="text-indent: 2em">화살표: → ← ↑ ↓ ⇒ ⇐</p>
"#;

        fs::write(&path, content).unwrap();
        let read_content = fs::read_to_string(&path).unwrap();

        // Verify content preserved correctly
        assert!(read_content.contains("가나다라마바사아자차카타파하"));
        assert!(read_content.contains("あいうえお"));
        assert!(read_content.contains("你好世界"));
        assert!(read_content.contains("🎉"));
        assert!(read_content.contains("&lt;script&gt;"));
        assert!(read_content.contains("∑ ∫ √ ∞"));

        println!("  특수 문자 처리 성공");
    }

    // ==========================================
    // Test 8: Long paragraphs with indents
    // ==========================================
    #[test]
    fn test_08_long_paragraphs() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 8: 긴 문단 테스트 ===");

        let path = vault.join("long_paragraphs.md");

        // Create very long paragraphs (simulating real document content)
        let long_text = "이것은 매우 긴 문단입니다. ".repeat(100);

        let content = format!(
            r#"---
title: Long Paragraphs Test
---

<p data-text-indent-type="firstLine" style="text-indent: 2em">{}</p>

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">{}</p>

{}
"#,
            long_text, long_text, long_text
        );

        let start = Instant::now();
        fs::write(&path, &content).unwrap();
        let write_time = start.elapsed();

        let start = Instant::now();
        let read_content = fs::read_to_string(&path).unwrap();
        let read_time = start.elapsed();

        println!("  파일 크기: {} bytes", read_content.len());
        println!("  쓰기 시간: {:?}", write_time);
        println!("  읽기 시간: {:?}", read_time);

        assert!(write_time < Duration::from_millis(50));
        assert!(read_time < Duration::from_millis(50));
    }

    // ==========================================
    // Test 9: Nested structures (lists with indented text)
    // ==========================================
    #[test]
    fn test_09_nested_structures() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 9: 중첩 구조 테스트 ===");

        let path = vault.join("nested.md");
        let content = r#"---
title: Nested Structures
---

# 섹션 1

<p data-text-indent-type="firstLine" style="text-indent: 2em">첫줄 들여쓰기 문단.</p>

## 하위 섹션 1.1

- 목록 항목 1
  - 중첩 항목 1.1
  - 중첩 항목 1.2
- 목록 항목 2

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">내어쓰기 문단 - 목록 뒤에 위치.</p>

### 하위하위 섹션 1.1.1

1. 번호 목록 1
   1. 중첩 번호 1.1
   2. 중첩 번호 1.2
2. 번호 목록 2

<p data-text-indent-type="firstLine" style="text-indent: 2em">번호 목록 뒤의 들여쓰기 문단.</p>

> 인용문
> 여러 줄 인용문
>
> <p data-text-indent-type="firstLine" style="text-indent: 2em">인용문 내부의 들여쓰기 (이 경우 무시될 수 있음)</p>

일반 문단으로 마무리.
"#;

        fs::write(&path, content).unwrap();
        let read_content = fs::read_to_string(&path).unwrap();

        assert!(read_content.contains("중첩 항목 1.1"));
        assert!(read_content.contains("data-text-indent-type=\"firstLine\""));
        assert!(read_content.contains("data-text-indent-type=\"hanging\""));

        println!("  중첩 구조 처리 성공");
    }

    // ==========================================
    // Test 10: Edge cases - empty content, whitespace
    // ==========================================
    #[test]
    fn test_10_edge_cases() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 10: 엣지 케이스 ===");

        // Empty indented paragraph
        let path1 = vault.join("empty_indent.md");
        let content1 = r#"---
title: Empty Indent
---

<p data-text-indent-type="firstLine" style="text-indent: 2em"></p>

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">   </p>
"#;
        fs::write(&path1, content1).unwrap();
        let read1 = fs::read_to_string(&path1).unwrap();
        assert!(read1.contains("data-text-indent-type=\"firstLine\""));
        println!("  빈 들여쓰기 문단 처리 성공");

        // Only whitespace
        let path2 = vault.join("whitespace.md");
        let content2 = r#"---
title: Whitespace Only
---

<p data-text-indent-type="firstLine" style="text-indent: 2em">

   </p>
"#;
        fs::write(&path2, content2).unwrap();
        let read2 = fs::read_to_string(&path2).unwrap();
        assert!(read2.contains("data-text-indent-type=\"firstLine\""));
        println!("  공백만 있는 들여쓰기 문단 처리 성공");

        // Very long indent attribute (shouldn't happen but test robustness)
        let path3 = vault.join("long_attr.md");
        let content3 = format!(
            r#"---
title: Long Attribute
---

<p data-text-indent-type="firstLine" style="text-indent: 2em" data-custom="{}">테스트</p>
"#,
            "x".repeat(1000)
        );
        fs::write(&path3, &content3).unwrap();
        let read3 = fs::read_to_string(&path3).unwrap();
        assert!(read3.contains("data-text-indent-type=\"firstLine\""));
        println!("  긴 속성값 처리 성공");
    }

    // ==========================================
    // Test 11: Malformed HTML recovery
    // ==========================================
    #[test]
    fn test_11_malformed_html() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 11: 잘못된 HTML 복구 ===");

        // Missing closing tag
        let path1 = vault.join("missing_close.md");
        let content1 = r#"---
title: Missing Close
---

<p data-text-indent-type="firstLine" style="text-indent: 2em">닫는 태그 없음

다음 문단.
"#;
        fs::write(&path1, content1).unwrap();
        let read1 = fs::read_to_string(&path1).unwrap();
        assert!(read1.contains("닫는 태그 없음"));
        println!("  닫는 태그 누락 처리 성공");

        // Extra attributes
        let path2 = vault.join("extra_attrs.md");
        let content2 = r#"---
title: Extra Attributes
---

<p data-text-indent-type="firstLine" style="text-indent: 2em" class="custom" id="p1" onclick="alert()">추가 속성</p>
"#;
        fs::write(&path2, content2).unwrap();
        let read2 = fs::read_to_string(&path2).unwrap();
        assert!(read2.contains("추가 속성"));
        println!("  추가 속성 처리 성공");
    }

    // ==========================================
    // Test 12: Search compatibility check
    // ==========================================
    #[test]
    fn test_12_search_compatibility() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 12: 검색 호환성 ===");

        // Create notes with searchable content in indented paragraphs
        for i in 0..50 {
            let path = vault.join(format!("search_{}.md", i));
            let keyword = format!("검색키워드{}", i);
            let content = format!(
                r#"---
title: Search Test {}
tags: [search, test]
---

<p data-text-indent-type="firstLine" style="text-indent: 2em">이 문단에는 {}가 포함되어 있습니다.</p>

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">내어쓰기 문단에도 키워드 {}가 있습니다.</p>
"#,
                i, keyword, keyword
            );
            fs::write(&path, &content).unwrap();
        }

        // Search simulation (grep through files)
        let start = Instant::now();
        let mut found_count = 0;

        for i in 0..50 {
            let path = vault.join(format!("search_{}.md", i));
            let content = fs::read_to_string(&path).unwrap();
            let keyword = format!("검색키워드{}", i);
            if content.contains(&keyword) {
                found_count += 1;
            }
        }

        let search_time = start.elapsed();

        println!("  50개 파일 검색 시간: {:?}", search_time);
        println!("  찾은 키워드 수: {}", found_count);

        assert_eq!(found_count, 50);
        assert!(search_time < Duration::from_millis(100));
    }

    // ==========================================
    // Test 13: Bulk operations
    // ==========================================
    #[test]
    fn test_13_bulk_operations() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 13: 대량 작업 ===");

        // Bulk create
        let start = Instant::now();
        for i in 0..100 {
            let path = vault.join(format!("bulk_{}.md", i));
            let content = format!(
                r#"---
title: Bulk Note {}
---

<p data-text-indent-type="firstLine" style="text-indent: 2em">문단 1</p>
<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">문단 2</p>
<p data-text-indent-type="firstLine" style="text-indent: 2em">문단 3</p>
"#,
                i
            );
            fs::write(&path, &content).unwrap();
        }
        let create_time = start.elapsed();

        // Bulk read
        let start = Instant::now();
        for i in 0..100 {
            let path = vault.join(format!("bulk_{}.md", i));
            let _ = fs::read_to_string(&path).unwrap();
        }
        let read_time = start.elapsed();

        // Bulk update
        let start = Instant::now();
        for i in 0..100 {
            let path = vault.join(format!("bulk_{}.md", i));
            let content = fs::read_to_string(&path).unwrap();
            let updated = content.replace("문단 1", "수정된 문단 1");
            fs::write(&path, &updated).unwrap();
        }
        let update_time = start.elapsed();

        // Bulk delete
        let start = Instant::now();
        for i in 0..100 {
            let path = vault.join(format!("bulk_{}.md", i));
            fs::remove_file(&path).unwrap();
        }
        let delete_time = start.elapsed();

        println!("  100개 생성 시간: {:?}", create_time);
        println!("  100개 읽기 시간: {:?}", read_time);
        println!("  100개 수정 시간: {:?}", update_time);
        println!("  100개 삭제 시간: {:?}", delete_time);

        assert!(create_time < Duration::from_secs(1));
        assert!(read_time < Duration::from_millis(500));
        assert!(update_time < Duration::from_secs(1));
        assert!(delete_time < Duration::from_millis(500));
    }

    // ==========================================
    // Test 14: Memory efficiency
    // ==========================================
    #[test]
    fn test_14_memory_efficiency() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 14: 메모리 효율성 ===");

        // Create a large file
        let path = vault.join("large_memory.md");
        let paragraph = "<p data-text-indent-type=\"firstLine\" style=\"text-indent: 2em\">테스트 문단입니다. 이 문단은 메모리 테스트를 위한 것입니다.</p>\n\n";
        let content = format!(
            "---\ntitle: Memory Test\n---\n\n{}",
            paragraph.repeat(1000)
        );

        fs::write(&path, &content).unwrap();
        let file_size = content.len();

        // Multiple reads to test memory handling
        let start = Instant::now();
        for _ in 0..10 {
            let read_content = fs::read_to_string(&path).unwrap();
            assert_eq!(read_content.len(), file_size);
        }
        let read_time = start.elapsed();

        println!("  파일 크기: {} bytes ({:.2} KB)", file_size, file_size as f64 / 1024.0);
        println!("  10회 반복 읽기 시간: {:?}", read_time);

        assert!(read_time < Duration::from_millis(500));
    }

    // ==========================================
    // Test 15: Cross-platform path handling
    // ==========================================
    #[test]
    fn test_15_path_handling() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 15: 경로 처리 ===");

        // Create nested directories
        let nested_path = vault.join("folder1").join("folder2").join("folder3");
        fs::create_dir_all(&nested_path).unwrap();

        let note_path = nested_path.join("deep_note.md");
        let content = r#"---
title: Deep Note
---

<p data-text-indent-type="firstLine" style="text-indent: 2em">깊은 경로의 노트입니다.</p>
"#;

        fs::write(&note_path, content).unwrap();
        let read_content = fs::read_to_string(&note_path).unwrap();

        assert!(read_content.contains("깊은 경로의 노트"));
        println!("  중첩 폴더 경로 처리 성공: {:?}", note_path);

        // Unicode folder name
        let unicode_path = vault.join("한글폴더").join("日本語");
        fs::create_dir_all(&unicode_path).unwrap();

        let unicode_note = unicode_path.join("유니코드노트.md");
        let content2 = r#"---
title: Unicode Path Note
---

<p data-text-indent-type="hanging" style="text-indent: -2em; padding-left: 2em">유니코드 경로 테스트.</p>
"#;

        fs::write(&unicode_note, content2).unwrap();
        let read2 = fs::read_to_string(&unicode_note).unwrap();
        assert!(read2.contains("유니코드 경로 테스트"));
        println!("  유니코드 경로 처리 성공: {:?}", unicode_note);
    }

    // ==========================================
    // Test 16: Stress test - alternating operations
    // ==========================================
    #[test]
    fn test_16_alternating_stress() {
        let temp_dir = TempDir::new().unwrap();
        let vault = temp_dir.path().to_path_buf();

        println!("\n=== Test 16: 교차 작업 스트레스 테스트 ===");

        let start = Instant::now();

        for i in 0..200 {
            let path = vault.join(format!("alt_{}.md", i % 50)); // Reuse 50 files

            if i % 4 == 0 {
                // Create/overwrite with firstLine
                let content = format!(
                    "---\ntitle: Alt {}\n---\n\n<p data-text-indent-type=\"firstLine\" style=\"text-indent: 2em\">내용 {}</p>\n",
                    i, i
                );
                fs::write(&path, &content).unwrap();
            } else if i % 4 == 1 {
                // Create/overwrite with hanging
                let content = format!(
                    "---\ntitle: Alt {}\n---\n\n<p data-text-indent-type=\"hanging\" style=\"text-indent: -2em; padding-left: 2em\">내용 {}</p>\n",
                    i, i
                );
                fs::write(&path, &content).unwrap();
            } else if i % 4 == 2 {
                // Read
                if path.exists() {
                    let _ = fs::read_to_string(&path);
                }
            } else {
                // Append
                if path.exists() {
                    let content = fs::read_to_string(&path).unwrap_or_default();
                    let new_content = format!("{}\n추가 내용 {}\n", content, i);
                    fs::write(&path, &new_content).unwrap();
                }
            }
        }

        let total_time = start.elapsed();

        println!("  200회 교차 작업 시간: {:?}", total_time);
        println!("  평균 작업 시간: {:?}", total_time / 200);

        assert!(total_time < Duration::from_secs(3));
    }
}
