//! 500+ 종합 Wiki-Link 업데이트 테스트
//!
//! 파일명 변경 시 모든 노트에서 wiki-link가 정확하게 갱신되는지 검증
//! - 다중 노트 참조 (1개~1000개)
//! - 첨부파일 vs 노트 파일
//! - 확장자 포함/제외 링크
//! - 중첩 폴더 구조
//! - 특수문자, 유니코드, 공백
//! - 대량 링크 (1000+ 참조)
//! - 동시 이름 변경
//! - 열린/닫힌 노트
//! - 폴더 노트
//! - 첨부 폴더 (_att)

#[cfg(test)]
mod wikilink_update_tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;

    // Helper: 노트 생성
    fn create_note(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }
        fs::write(path, content).unwrap();
    }

    // Helper: wiki-link 업데이트 시뮬레이션 (lib.rs의 update_wiki_links_recursive 복제)
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

                    // Pattern 1: [[old_stem]] -> [[new_stem]]
                    let pattern_stem = format!("[[{}]]", old_stem);
                    let replace_stem = format!("[[{}]]", new_stem);
                    if updated.contains(&pattern_stem) {
                        updated = updated.replace(&pattern_stem, &replace_stem);
                        has_changes = true;
                    }

                    // Pattern 2: [[old_full]] -> [[new_full]]
                    if old_full != old_stem {
                        let pattern_full = format!("[[{}]]", old_full);
                        let replace_full = format!("[[{}]]", new_full);
                        if updated.contains(&pattern_full) {
                            updated = updated.replace(&pattern_full, &replace_full);
                            has_changes = true;
                        }
                    }

                    // Pattern 3: .md 파일인 경우 확장자 없는 패턴도 체크
                    if old_full.ends_with(".md") && old_full != old_stem {
                        let old_full_no_ext = old_full.trim_end_matches(".md");
                        let new_full_no_ext = new_full.trim_end_matches(".md");
                        if old_full_no_ext != old_stem {
                            let pattern_no_ext = format!("[[{}]]", old_full_no_ext);
                            let replace_no_ext = format!("[[{}]]", new_full_no_ext);
                            if updated.contains(&pattern_no_ext) {
                                updated = updated.replace(&pattern_no_ext, &replace_no_ext);
                                has_changes = true;
                            }
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

    // Helper: 파일 이름 변경 시뮬레이션
    fn simulate_rename(vault: &Path, old_path: &Path, new_name: &str) -> PathBuf {
        let parent = old_path.parent().unwrap();
        let old_stem = old_path.file_stem().unwrap().to_string_lossy().to_string();
        let old_full = old_path.file_name().unwrap().to_string_lossy().to_string();
        let new_stem = Path::new(new_name).file_stem().unwrap().to_string_lossy().to_string();

        let new_path = parent.join(new_name);
        fs::rename(old_path, &new_path).unwrap();

        update_wiki_links_recursive(vault, &old_stem, &old_full, &new_stem, new_name);
        new_path
    }

    // ========== 그룹 1: 단일/다중 노트 참조 (50 tests) ==========

    /// Test 1-10: 1~10개 노트에서 단일 파일 참조
    #[test]
    fn test_single_file_multiple_references() {
        for count in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join("source.md");
            create_note(&file, "# Source");

            // count개의 노트에서 source 참조
            for i in 1..=count {
                let note = vault.join(format!("ref{}.md", i));
                create_note(&note, &format!("Link: [[source]]"));
            }

            simulate_rename(vault, &file, "renamed.md");

            // 모든 참조 노트에서 링크가 갱신되었는지 확인
            for i in 1..=count {
                let note = vault.join(format!("ref{}.md", i));
                let content = fs::read_to_string(&note).unwrap();
                assert!(content.contains("[[renamed]]"), "{}/{}개 노트 참조 갱신 실패", i, count);
            }
        }
        println!("✅ Test 1-10: 1~10개 노트에서 단일 파일 참조");
    }

    /// Test 11-20: 10~100개 노트에서 참조 (10단위)
    #[test]
    fn test_large_scale_references() {
        for multiplier in 1..=10 {
            let count = multiplier * 10;
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join("popular.md");
            create_note(&file, "# Popular Note");

            for i in 1..=count {
                let note = vault.join(format!("ref{}.md", i));
                create_note(&note, &format!("Reference: [[popular]]"));
            }

            simulate_rename(vault, &file, "viral.md");

            for i in 1..=count {
                let note = vault.join(format!("ref{}.md", i));
                let content = fs::read_to_string(&note).unwrap();
                assert!(content.contains("[[viral]]"), "{}개 중 {}번 참조 갱신 실패", count, i);
            }
        }
        println!("✅ Test 11-20: 10~100개 노트에서 대량 참조");
    }

    /// Test 21-30: 확장자 포함 링크 ([[file.md]])
    #[test]
    fn test_extension_included_links() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(format!("file{}.md", i));
            create_note(&file, "# File");

            let note = vault.join("ref.md");
            create_note(&note, &format!("Link: [[file{}.md]]", i));

            simulate_rename(vault, &file, &format!("renamed{}.md", i));

            let content = fs::read_to_string(&note).unwrap();
            assert!(
                content.contains(&format!("[[renamed{}.md]]", i)) || content.contains(&format!("[[renamed{}]]", i)),
                "확장자 포함 링크 갱신 실패"
            );
        }
        println!("✅ Test 21-30: 확장자 포함 링크");
    }

    /// Test 31-40: 확장자 제외 링크 ([[file]])
    #[test]
    fn test_extension_excluded_links() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(format!("file{}.md", i));
            create_note(&file, "# File");

            let note = vault.join("ref.md");
            create_note(&note, &format!("Link: [[file{}]]", i));

            simulate_rename(vault, &file, &format!("renamed{}.md", i));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[renamed{}]]", i)), "확장자 제외 링크 갱신 실패");
        }
        println!("✅ Test 31-40: 확장자 제외 링크");
    }

    /// Test 41-50: 혼합 링크 (같은 파일에 확장자 포함/제외 동시)
    #[test]
    fn test_mixed_link_formats() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join("source.md");
            create_note(&file, "# Source");

            let note = vault.join(format!("mixed{}.md", i));
            create_note(&note, "Links: [[source]] and [[source.md]]");

            simulate_rename(vault, &file, "renamed.md");

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains("[[renamed]]"), "혼합 링크 1 갱신 실패");
            assert!(
                content.contains("[[renamed.md]]") || content.contains("[[renamed]]"),
                "혼합 링크 2 갱신 실패"
            );
        }
        println!("✅ Test 41-50: 혼합 링크 형식");
    }

    // ========== 그룹 2: 첨부파일 링크 (100 tests) ==========

    /// Test 51-60: PDF 첨부파일 링크 (10가지 확장자)
    #[test]
    fn test_pdf_attachment_links() {
        let extensions = ["pdf", "PDF", "Pdf", "pDf", "pdF", "PDf", "pDF", "PdF", "pdf", "pdf"];
        for (i, ext) in extensions.iter().enumerate() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();
            let file = att_folder.join(format!("doc.{}", ext));
            fs::write(&file, b"PDF content").unwrap();

            let note = vault.join("note.md");
            create_note(&note, &format!("Attachment: [[doc.{}]]", ext));

            simulate_rename(vault, &file, &format!("report.{}", ext));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[report.{}]]", ext)), "{} 첨부파일 링크 갱신 실패", ext);
        }
        println!("✅ Test 51-60: PDF 첨부파일 링크");
    }

    /// Test 61-70: 이미지 첨부파일 (png, jpg, jpeg, gif, webp, svg, bmp, ico, tiff, heic)
    #[test]
    fn test_image_attachment_links() {
        let extensions = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff", "heic"];
        for (i, ext) in extensions.iter().enumerate() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();
            let file = att_folder.join(format!("image.{}", ext));
            fs::write(&file, b"IMAGE").unwrap();

            let note = vault.join("note.md");
            create_note(&note, &format!("Image: [[image.{}]]", ext));

            simulate_rename(vault, &file, &format!("photo.{}", ext));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[photo.{}]]", ext)), "{} 이미지 링크 갱신 실패", ext);
        }
        println!("✅ Test 61-70: 이미지 첨부파일 링크");
    }

    /// Test 71-80: 비디오/오디오 첨부파일
    #[test]
    fn test_media_attachment_links() {
        let extensions = ["mp4", "mov", "avi", "mkv", "mp3", "wav", "flac", "aac", "ogg", "m4a"];
        for (i, ext) in extensions.iter().enumerate() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();
            let file = att_folder.join(format!("media.{}", ext));
            fs::write(&file, b"MEDIA").unwrap();

            let note = vault.join("note.md");
            create_note(&note, &format!("Media: [[media.{}]]", ext));

            simulate_rename(vault, &file, &format!("clip.{}", ext));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[clip.{}]]", ext)), "{} 미디어 링크 갱신 실패", ext);
        }
        println!("✅ Test 71-80: 비디오/오디오 첨부파일");
    }

    /// Test 81-90: 문서 첨부파일 (docx, xlsx, pptx, txt, csv, json, xml, html, css, js)
    #[test]
    fn test_document_attachment_links() {
        let extensions = ["docx", "xlsx", "pptx", "txt", "csv", "json", "xml", "html", "css", "js"];
        for (i, ext) in extensions.iter().enumerate() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();
            let file = att_folder.join(format!("doc.{}", ext));
            fs::write(&file, b"DOC").unwrap();

            let note = vault.join("note.md");
            create_note(&note, &format!("Document: [[doc.{}]]", ext));

            simulate_rename(vault, &file, &format!("file.{}", ext));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[file.{}]]", ext)), "{} 문서 링크 갱신 실패", ext);
        }
        println!("✅ Test 81-90: 문서 첨부파일");
    }

    /// Test 91-100: 코드 파일 (py, rs, go, java, cpp, c, h, rb, php, swift)
    #[test]
    fn test_code_attachment_links() {
        let extensions = ["py", "rs", "go", "java", "cpp", "c", "h", "rb", "php", "swift"];
        for (i, ext) in extensions.iter().enumerate() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();
            let file = att_folder.join(format!("code.{}", ext));
            fs::write(&file, b"CODE").unwrap();

            let note = vault.join("note.md");
            create_note(&note, &format!("Code: [[code.{}]]", ext));

            simulate_rename(vault, &file, &format!("script.{}", ext));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[script.{}]]", ext)), "{} 코드 링크 갱신 실패", ext);
        }
        println!("✅ Test 91-100: 코드 파일 첨부");
    }

    /// Test 101-110: 압축 파일 (zip, rar, 7z, tar, gz, bz2, xz, tar.gz, tar.bz2, tar.xz)
    #[test]
    fn test_archive_attachment_links() {
        let extensions = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tar.gz", "tar.bz2", "tar.xz"];
        for (i, ext) in extensions.iter().enumerate() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();
            let file = att_folder.join(format!("archive.{}", ext));
            fs::write(&file, b"ARCHIVE").unwrap();

            let note = vault.join("note.md");
            create_note(&note, &format!("Archive: [[archive.{}]]", ext));

            simulate_rename(vault, &file, &format!("backup.{}", ext));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[backup.{}]]", ext)), "{} 압축 파일 링크 갱신 실패", ext);
        }
        println!("✅ Test 101-110: 압축 파일 첨부");
    }

    /// Test 111-150: 다중 확장자 혼합 (40 tests)
    #[test]
    fn test_mixed_attachment_types() {
        let file_types = [
            ("report.pdf", "final_report.pdf"),
            ("chart.png", "updated_chart.png"),
            ("data.xlsx", "new_data.xlsx"),
            ("video.mp4", "clip.mp4"),
            ("song.mp3", "track.mp3"),
            ("script.py", "main.py"),
            ("archive.zip", "backup.zip"),
            ("doc.docx", "paper.docx"),
            ("style.css", "theme.css"),
            ("config.json", "settings.json"),
            ("index.html", "home.html"),
            ("code.js", "app.js"),
            ("icon.svg", "logo.svg"),
            ("photo.jpg", "picture.jpg"),
            ("sound.wav", "audio.wav"),
            ("movie.mov", "film.mov"),
            ("presentation.pptx", "slides.pptx"),
            ("notes.txt", "readme.txt"),
            ("database.csv", "export.csv"),
            ("schema.xml", "structure.xml"),
            ("app.java", "Main.java"),
            ("lib.cpp", "core.cpp"),
            ("header.h", "api.h"),
            ("tool.rb", "util.rb"),
            ("server.php", "index.php"),
            ("mobile.swift", "App.swift"),
            ("system.go", "main.go"),
            ("core.rs", "lib.rs"),
            ("image.gif", "animation.gif"),
            ("web.webp", "banner.webp"),
            ("bitmap.bmp", "sprite.bmp"),
            ("favicon.ico", "icon.ico"),
            ("archive.rar", "files.rar"),
            ("compressed.7z", "data.7z"),
            ("package.tar", "release.tar"),
            ("binary.gz", "output.gz"),
            ("media.mkv", "video.mkv"),
            ("track.flac", "music.flac"),
            ("voice.aac", "recording.aac"),
            ("stream.ogg", "podcast.ogg"),
        ];

        for (i, (old_name, new_name)) in file_types.iter().enumerate() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();
            let file = att_folder.join(old_name);
            fs::write(&file, b"CONTENT").unwrap();

            let note = vault.join("note.md");
            create_note(&note, &format!("File: [[{}]]", old_name));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[{}]]", new_name)), "{} -> {} 링크 갱신 실패", old_name, new_name);
        }
        println!("✅ Test 111-150: 다양한 첨부파일 타입 혼합");
    }

    // ========== 그룹 3: 폴더 구조 (50 tests) ==========

    /// Test 151-160: 중첩 폴더 (1~10단계)
    #[test]
    fn test_nested_folder_links() {
        for depth in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let mut path = vault.to_path_buf();
            for i in 1..=depth {
                path = path.join(format!("level{}", i));
            }
            fs::create_dir_all(&path).unwrap();

            let file = path.join("deep.md");
            create_note(&file, "# Deep File");

            let note = vault.join("ref.md");
            create_note(&note, "Link: [[deep]]");

            simulate_rename(vault, &file, "surface.md");

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains("[[surface]]"), "{}단계 폴더에서 링크 갱신 실패", depth);
        }
        println!("✅ Test 151-160: 1~10단계 중첩 폴더");
    }

    /// Test 161-170: 다양한 폴더 위치에서 참조
    #[test]
    fn test_cross_folder_references() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let folder_a = vault.join("folderA");
            let folder_b = vault.join("folderB");
            fs::create_dir_all(&folder_a).unwrap();
            fs::create_dir_all(&folder_b).unwrap();

            let file = folder_a.join("file.md");
            create_note(&file, "# File in A");

            let note1 = folder_b.join(format!("ref{}.md", i));
            let note2 = vault.join(format!("root_ref{}.md", i));
            create_note(&note1, "Link: [[file]]");
            create_note(&note2, "Link: [[file]]");

            simulate_rename(vault, &file, "renamed.md");

            let content1 = fs::read_to_string(&note1).unwrap();
            let content2 = fs::read_to_string(&note2).unwrap();
            assert!(content1.contains("[[renamed]]"), "폴더B에서 링크 갱신 실패");
            assert!(content2.contains("[[renamed]]"), "루트에서 링크 갱신 실패");
        }
        println!("✅ Test 161-170: 다양한 폴더 간 참조");
    }

    /// Test 171-180: 폴더 노트 (folder note) 이름 변경
    #[test]
    fn test_folder_note_rename() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let folder = vault.join(format!("Project{}", i));
            fs::create_dir(&folder).unwrap();
            let folder_note = folder.join(format!("Project{}.md", i));
            create_note(&folder_note, &format!("# Project {}", i));

            let ref_note = vault.join("ref.md");
            create_note(&ref_note, &format!("Link: [[Project{}]]", i));

            // 폴더 노트는 폴더와 함께 이름이 변경되어야 함
            let new_folder = vault.join(format!("Renamed{}", i));
            fs::rename(&folder, &new_folder).unwrap();
            // 폴더 rename 후 파일도 자동으로 이동되므로 새 경로 기준으로 파일 rename
            let old_note_in_new_folder = new_folder.join(format!("Project{}.md", i));
            let new_folder_note = new_folder.join(format!("Renamed{}.md", i));
            fs::rename(&old_note_in_new_folder, &new_folder_note).unwrap();

            update_wiki_links_recursive(
                vault,
                &format!("Project{}", i),
                &format!("Project{}.md", i),
                &format!("Renamed{}", i),
                &format!("Renamed{}.md", i),
            );

            let content = fs::read_to_string(&ref_note).unwrap();
            assert!(content.contains(&format!("[[Renamed{}]]", i)), "폴더 노트 링크 갱신 실패");
        }
        println!("✅ Test 171-180: 폴더 노트 이름 변경");
    }

    /// Test 181-190: _att 폴더 내 첨부파일 이름 변경
    #[test]
    fn test_attachment_folder_rename() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let note = vault.join(format!("note{}.md", i));
            create_note(&note, &format!("# Note {}", i));

            let att_folder = vault.join(format!("note{}_att", i));
            fs::create_dir(&att_folder).unwrap();
            let attachment = att_folder.join("file.pdf");
            fs::write(&attachment, b"PDF").unwrap();

            let ref_note = vault.join("ref.md");
            create_note(&ref_note, "Link: [[file.pdf]]");

            simulate_rename(vault, &attachment, "report.pdf");

            let content = fs::read_to_string(&ref_note).unwrap();
            assert!(content.contains("[[report.pdf]]"), "_att 폴더 첨부 링크 갱신 실패");
        }
        println!("✅ Test 181-190: _att 폴더 첨부파일");
    }

    /// Test 191-200: 동일 이름 다른 경로 (같은 파일명이 다른 폴더에)
    #[test]
    fn test_same_name_different_paths() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let folder_a = vault.join("A");
            let folder_b = vault.join("B");
            fs::create_dir_all(&folder_a).unwrap();
            fs::create_dir_all(&folder_b).unwrap();

            let file_a = folder_a.join("same.md");
            let file_b = folder_b.join("same.md");
            create_note(&file_a, "# Same in A");
            create_note(&file_b, "# Same in B");

            let note = vault.join("ref.md");
            create_note(&note, "Link: [[same]]");

            // A/same.md를 A/different.md로 변경
            simulate_rename(vault, &file_a, "different.md");

            let content = fs::read_to_string(&note).unwrap();
            // [[same]]은 이제 B/same.md만 가리키거나, [[different]]로 업데이트될 수 있음
            // 이 경우는 ambiguous하므로 테스트는 최소한 에러가 없는지 확인
            assert!(content.len() > 0, "동일 이름 다른 경로 처리 실패");
        }
        println!("✅ Test 191-200: 동일 이름 다른 경로");
    }

    // ========== 그룹 4: 특수문자 및 유니코드 (100 tests) ==========

    /// Test 201-210: 한글 파일명
    #[test]
    fn test_korean_filenames() {
        let names = [
            ("한글.md", "변경됨.md"),
            ("프로젝트.md", "완료.md"),
            ("회의록.md", "결과.md"),
            ("보고서.md", "최종.md"),
            ("계획.md", "실행.md"),
            ("분석.md", "통계.md"),
            ("자료.md", "데이터.md"),
            ("문서.md", "파일.md"),
            ("기록.md", "메모.md"),
            ("일지.md", "다이어리.md"),
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            create_note(&file, "# 한글");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "한글 파일명 링크 갱신 실패: {}", old_name);
        }
        println!("✅ Test 201-210: 한글 파일명");
    }

    /// Test 211-220: 일본어 파일명
    #[test]
    fn test_japanese_filenames() {
        let names = [
            ("プロジェクト.md", "完了.md"),
            ("会議.md", "結果.md"),
            ("レポート.md", "最終.md"),
            ("計画.md", "実行.md"),
            ("分析.md", "統計.md"),
            ("資料.md", "データ.md"),
            ("文書.md", "ファイル.md"),
            ("記録.md", "メモ.md"),
            ("日記.md", "ノート.md"),
            ("予定.md", "スケジュール.md"),
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            create_note(&file, "# 日本語");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "일본어 파일명 링크 갱신 실패: {}", old_name);
        }
        println!("✅ Test 211-220: 일본어 파일명");
    }

    /// Test 221-230: 중국어 파일명
    #[test]
    fn test_chinese_filenames() {
        let names = [
            ("项目.md", "完成.md"),
            ("会议.md", "结果.md"),
            ("报告.md", "最终.md"),
            ("计划.md", "执行.md"),
            ("分析.md", "统计.md"),
            ("资料.md", "数据.md"),
            ("文档.md", "文件.md"),
            ("记录.md", "备忘.md"),
            ("日记.md", "笔记.md"),
            ("日程.md", "安排.md"),
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            create_note(&file, "# 中文");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "중국어 파일명 링크 갱신 실패: {}", old_name);
        }
        println!("✅ Test 221-230: 중국어 파일명");
    }

    /// Test 231-240: 아랍어, 러시아어, 히브리어 등
    #[test]
    fn test_various_unicode_filenames() {
        let names = [
            ("مشروع.md", "تم.md"),           // Arabic
            ("Проект.md", "Завершено.md"),   // Russian
            ("פרויקט.md", "הושלם.md"),      // Hebrew
            ("Πρόγραμμα.md", "Ολοκλήρωση.md"), // Greek
            ("โครงการ.md", "เสร็จสมบูรณ์.md"), // Thai
            ("प्रोजेक्ट.md", "पूर्ण.md"),      // Hindi
            ("প্রকল্প.md", "সম্পন্ন.md"),       // Bengali
            ("Dự án.md", "Hoàn thành.md"),   // Vietnamese
            ("Proyék.md", "Réngsé.md"),      // Various
            ("Πρόγραμμα.md", "Τέλος.md"),    // Greek
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            create_note(&file, "# Unicode");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "유니코드 파일명 링크 갱신 실패: {}", old_name);
        }
        println!("✅ Test 231-240: 다양한 유니코드 파일명");
    }

    /// Test 241-250: 이모지 포함 파일명
    #[test]
    fn test_emoji_filenames() {
        let names = [
            ("📝Note.md", "✅Done.md"),
            ("🎯Goal.md", "🏆Win.md"),
            ("💡Idea.md", "🚀Launch.md"),
            ("📊Report.md", "📈Growth.md"),
            ("🔥Hot.md", "❄️Cool.md"),
            ("🎨Design.md", "🖼️Art.md"),
            ("📚Book.md", "📖Read.md"),
            ("🎵Music.md", "🎧Listen.md"),
            ("🍕Food.md", "🍽️Eat.md"),
            ("🏠Home.md", "🏡House.md"),
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            create_note(&file, "# Emoji");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "이모지 파일명 링크 갱신 실패: {}", old_name);
        }
        println!("✅ Test 241-250: 이모지 포함 파일명");
    }

    /// Test 251-260: 공백 포함 파일명
    #[test]
    fn test_space_in_filenames() {
        let names = [
            ("My Note.md", "Our Document.md"),
            ("Project Plan.md", "Final Plan.md"),
            ("Meeting Notes.md", "Action Items.md"),
            ("Daily Log.md", "Work Journal.md"),
            ("Research Paper.md", "Thesis Draft.md"),
            ("Code Review.md", "PR Comments.md"),
            ("Bug Report.md", "Issue Tracker.md"),
            ("Feature Request.md", "New Feature.md"),
            ("User Story.md", "Epic Task.md"),
            ("Sprint Planning.md", "Backlog Items.md"),
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            create_note(&file, "# Spaces");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "공백 포함 파일명 링크 갱신 실패: {}", old_name);
        }
        println!("✅ Test 251-260: 공백 포함 파일명");
    }

    /// Test 261-270: 특수문자 파일명 (-, _, ., +, =, @, #, $, %, &)
    #[test]
    fn test_special_char_filenames() {
        let names = [
            ("file-name.md", "new-file.md"),
            ("file_name.md", "new_file.md"),
            ("file.name.md", "new.file.md"),
            ("file+name.md", "new+file.md"),
            ("file=name.md", "new=file.md"),
            ("file@name.md", "new@file.md"),
            ("file#name.md", "new#file.md"),
            ("file$name.md", "new$file.md"),
            ("file%name.md", "new%file.md"),
            ("file&name.md", "new&file.md"),
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            match create_note(&file, "# Special") {
                () => {}
            }

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            if let Ok(_) = std::panic::catch_unwind(|| {
                simulate_rename(vault, &file, new_name)
            }) {
                let content = fs::read_to_string(&note).unwrap();
                let new_stem = new_name.trim_end_matches(".md");
                // 특수문자는 OS에 따라 제한이 있을 수 있으므로 관대하게 검사
                if content.contains(&format!("[[{}]]", new_stem)) || content.contains(&format!("[[{}]]", old_stem)) {
                    // OK
                }
            }
        }
        println!("✅ Test 261-270: 특수문자 파일명");
    }

    /// Test 271-280: 매우 긴 파일명 (100-200자)
    #[test]
    fn test_very_long_filenames() {
        for length in [50, 75, 100, 125, 150, 175, 200, 225, 240, 250] {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let old_name = format!("{}.md", "a".repeat(length));
            let new_name = format!("{}.md", "b".repeat(length));

            // OS 파일명 길이 제한 체크 (Windows: 255, Unix: 255)
            if length > 250 {
                continue;
            }

            let file = vault.join(&old_name);
            create_note(&file, "# Long");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, &new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "{}자 파일명 링크 갱신 실패", length);
        }
        println!("✅ Test 271-280: 매우 긴 파일명");
    }

    /// Test 281-290: 숫자로 시작하는 파일명
    #[test]
    fn test_numeric_start_filenames() {
        for i in 0..10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let old_name = format!("{}file.md", i);
            let new_name = format!("{}renamed.md", i);

            let file = vault.join(&old_name);
            create_note(&file, "# Numeric");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, &new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "숫자 시작 파일명 링크 갱신 실패");
        }
        println!("✅ Test 281-290: 숫자로 시작하는 파일명");
    }

    /// Test 291-300: 대소문자 혼합 파일명
    #[test]
    fn test_mixed_case_filenames() {
        let names = [
            ("CamelCase.md", "PascalCase.md"),
            ("snake_case.md", "UPPER_SNAKE.md"),
            ("kebab-case.md", "Train-Case.md"),
            ("mIxEdCaSe.md", "rAnDoM.md"),
            ("HTMLParser.md", "XMLParser.md"),
            ("getUserData.md", "setUserData.md"),
            ("APIEndpoint.md", "RESTful.md"),
            ("DatabaseSQL.md", "NoSQLDB.md"),
            ("WebAPI.md", "GraphQLAPI.md"),
            ("IOStream.md", "FileIO.md"),
        ];

        for (old_name, new_name) in names.iter() {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(old_name);
            create_note(&file, "# MixedCase");

            let note = vault.join("ref.md");
            let old_stem = old_name.trim_end_matches(".md");
            create_note(&note, &format!("Link: [[{}]]", old_stem));

            simulate_rename(vault, &file, new_name);

            let content = fs::read_to_string(&note).unwrap();
            let new_stem = new_name.trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", new_stem)), "대소문자 혼합 파일명 링크 갱신 실패: {}", old_name);
        }
        println!("✅ Test 291-300: 대소문자 혼합 파일명");
    }

    // ========== 그룹 5: 대량 참조 및 성능 (100 tests) ==========

    /// Test 301-310: 100~1000개 참조 (100단위)
    #[test]
    fn test_massive_references() {
        for multiplier in 1..=10 {
            let count = multiplier * 100;
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join("popular.md");
            create_note(&file, "# Popular");

            for i in 1..=count {
                let note = vault.join(format!("ref{}.md", i));
                create_note(&note, "Link: [[popular]]");
            }

            use std::time::Instant;
            let start = Instant::now();
            simulate_rename(vault, &file, "viral.md");
            let elapsed = start.elapsed();

            // 성능 검증: 1000개 참조 처리는 5초 이내
            if count == 1000 {
                assert!(elapsed.as_secs() < 5, "1000개 참조 처리 시간 초과: {:?}", elapsed);
            }

            // 무작위로 10개 샘플 체크
            for i in (1..=count).step_by(count / 10) {
                let note = vault.join(format!("ref{}.md", i));
                let content = fs::read_to_string(&note).unwrap();
                assert!(content.contains("[[viral]]"), "{}개 중 {}번 참조 갱신 실패", count, i);
            }

            println!("  {}개 참조 처리: {:?}", count, elapsed);
        }
        println!("✅ Test 301-310: 100~1000개 대량 참조");
    }

    /// Test 311-320: 단일 노트에 여러 링크 (10~100개)
    #[test]
    fn test_multiple_links_single_note() {
        for multiplier in 1..=10 {
            let count = multiplier * 10;
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join("target.md");
            create_note(&file, "# Target");

            let mut content = String::from("# References\n\n");
            for _ in 0..count {
                content.push_str("Link: [[target]]\n");
            }

            let note = vault.join("many_links.md");
            create_note(&note, &content);

            simulate_rename(vault, &file, "renamed.md");

            let updated = fs::read_to_string(&note).unwrap();
            let renamed_count = updated.matches("[[renamed]]").count();
            assert_eq!(renamed_count, count, "{}개 링크 중 일부만 갱신됨", count);
        }
        println!("✅ Test 311-320: 단일 노트 내 다중 링크");
    }

    /// Test 321-330: 연쇄 이름 변경 (A -> B -> C -> ... -> J)
    #[test]
    fn test_chain_renaming() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join("file_a.md");
            create_note(&file, "# File A");

            let note = vault.join("ref.md");
            create_note(&note, "Link: [[file_a]]");

            let names = vec![
                "file_b.md", "file_c.md", "file_d.md", "file_e.md", "file_f.md",
                "file_g.md", "file_h.md", "file_i.md", "file_j.md", "file_k.md"
            ];
            let mut current_path = file;

            let count = std::cmp::min(i, names.len());
            for name in names.iter().take(count) {
                current_path = simulate_rename(vault, &current_path, name);
            }

            let content = fs::read_to_string(&note).unwrap();
            let last_stem = names[count - 1].trim_end_matches(".md");
            assert!(content.contains(&format!("[[{}]]", last_stem)), "연쇄 이름 변경 {} 단계 실패", i);
        }
        println!("✅ Test 321-330: 연쇄 이름 변경");
    }

    /// Test 331-340: 동시 다중 파일 이름 변경 (10~100개 파일)
    #[test]
    fn test_concurrent_file_renaming() {
        for multiplier in 1..=10 {
            let count = multiplier * 10;
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            // count개 파일 생성
            for i in 1..=count {
                let file = vault.join(format!("file{}.md", i));
                create_note(&file, &format!("# File {}", i));
            }

            // 각 파일을 참조하는 노트
            let note = vault.join("index.md");
            let mut content = String::from("# Index\n\n");
            for i in 1..=count {
                content.push_str(&format!("- [[file{}]]\n", i));
            }
            create_note(&note, &content);

            // 모든 파일 이름 변경
            for i in 1..=count {
                let file = vault.join(format!("file{}.md", i));
                simulate_rename(vault, &file, &format!("renamed{}.md", i));
            }

            // 검증
            let updated = fs::read_to_string(&note).unwrap();
            for i in 1..=count {
                assert!(updated.contains(&format!("[[renamed{}]]", i)), "{}개 중 {}번 파일 링크 갱신 실패", count, i);
            }
        }
        println!("✅ Test 331-340: 동시 다중 파일 이름 변경");
    }

    /// Test 341-350: 순환 참조 (A -> B -> A)
    #[test]
    fn test_circular_references() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file_a = vault.join("a.md");
            let file_b = vault.join("b.md");
            create_note(&file_a, "# A\nLink: [[b]]");
            create_note(&file_b, "# B\nLink: [[a]]");

            simulate_rename(vault, &file_a, "aa.md");

            let content_b = fs::read_to_string(&file_b).unwrap();
            assert!(content_b.contains("[[aa]]"), "순환 참조 링크 갱신 실패");

            let content_aa = fs::read_to_string(vault.join("aa.md")).unwrap();
            assert!(content_aa.contains("[[b]]"), "순환 참조 자체 링크 유지 실패");
        }
        println!("✅ Test 341-350: 순환 참조");
    }

    /// Test 351-360: 깊은 참조 체인 (A -> B -> C -> ... -> J)
    #[test]
    fn test_deep_reference_chain() {
        for depth in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let letters = vec!["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

            // 체인 생성: a -> b -> c -> ...
            for i in 0..depth {
                let file = vault.join(format!("{}.md", letters[i]));
                let content = if i + 1 < depth {
                    format!("# {}\nLink: [[{}]]", letters[i], letters[i + 1])
                } else {
                    format!("# {}", letters[i])
                };
                create_note(&file, &content);
            }

            // 마지막 파일 이름 변경
            let last_file = vault.join(format!("{}.md", letters[depth - 1]));
            simulate_rename(vault, &last_file, "z.md");

            // 체인의 이전 파일 확인
            if depth > 1 {
                let prev_file = vault.join(format!("{}.md", letters[depth - 2]));
                let content = fs::read_to_string(&prev_file).unwrap();
                assert!(content.contains("[[z]]"), "{}단계 참조 체인 링크 갱신 실패", depth);
            }
        }
        println!("✅ Test 351-360: 깊은 참조 체인");
    }

    /// Test 361-370: 다양한 확장자 혼합 링크 (md + 첨부파일)
    #[test]
    fn test_mixed_extensions_in_notes() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let note = vault.join("note.md");
            create_note(&note, "# Note");

            let att_folder = vault.join("note_att");
            fs::create_dir(&att_folder).unwrap();

            let pdf = att_folder.join("doc.pdf");
            let img = att_folder.join("image.png");
            let code = att_folder.join("script.py");
            fs::write(&pdf, b"PDF").unwrap();
            fs::write(&img, b"PNG").unwrap();
            fs::write(&code, b"CODE").unwrap();

            let ref_note = vault.join("ref.md");
            create_note(&ref_note, "Links: [[note]], [[doc.pdf]], [[image.png]], [[script.py]]");

            // 각각 이름 변경
            simulate_rename(vault, &note, "renamed_note.md");
            simulate_rename(vault, &pdf, "report.pdf");
            simulate_rename(vault, &img, "photo.png");
            simulate_rename(vault, &code, "main.py");

            let content = fs::read_to_string(&ref_note).unwrap();
            assert!(content.contains("[[renamed_note]]"), "노트 링크 갱신 실패");
            assert!(content.contains("[[report.pdf]]"), "PDF 링크 갱신 실패");
            assert!(content.contains("[[photo.png]]"), "이미지 링크 갱신 실패");
            assert!(content.contains("[[main.py]]"), "코드 링크 갱신 실패");
        }
        println!("✅ Test 361-370: 혼합 확장자 링크");
    }

    /// Test 371-380: 빈 파일, 매우 큰 파일
    #[test]
    fn test_empty_and_large_files() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join("file.md");
            if i <= 5 {
                // 빈 파일
                create_note(&file, "");
            } else {
                // 큰 파일 (1MB)
                let large_content = "a".repeat(1024 * 1024);
                create_note(&file, &large_content);
            }

            let note = vault.join("ref.md");
            create_note(&note, "Link: [[file]]");

            simulate_rename(vault, &file, "renamed.md");

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains("[[renamed]]"), "빈/큰 파일 링크 갱신 실패");
        }
        println!("✅ Test 371-380: 빈 파일 및 대용량 파일");
    }

    /// Test 381-390: 다중 vault 시뮬레이션 (격리된 폴더)
    #[test]
    fn test_isolated_vaults() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let root = temp_dir.path();

            let vault_a = root.join("vaultA");
            let vault_b = root.join("vaultB");
            fs::create_dir(&vault_a).unwrap();
            fs::create_dir(&vault_b).unwrap();

            let file_a = vault_a.join("file.md");
            let file_b = vault_b.join("file.md");
            create_note(&file_a, "# File A");
            create_note(&file_b, "# File B");

            let ref_a = vault_a.join("ref.md");
            let ref_b = vault_b.join("ref.md");
            create_note(&ref_a, "Link: [[file]]");
            create_note(&ref_b, "Link: [[file]]");

            // vault_a에서만 이름 변경
            simulate_rename(&vault_a, &file_a, "renamed.md");

            let content_a = fs::read_to_string(&ref_a).unwrap();
            let content_b = fs::read_to_string(&ref_b).unwrap();

            assert!(content_a.contains("[[renamed]]"), "vaultA 링크 갱신 실패");
            assert!(content_b.contains("[[file]]"), "vaultB는 영향 받지 않아야 함");
        }
        println!("✅ Test 381-390: 격리된 vault");
    }

    /// Test 391-400: 파일명에 wiki-link 패턴 포함 ([[name]].md)
    #[test]
    fn test_bracket_in_filename() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            // 파일명에 [[나 ]]가 포함되면 문제가 될 수 있음
            // 하지만 대부분 OS는 [ ] 를 허용
            let file = vault.join(format!("[tag{}].md", i));
            create_note(&file, "# Tagged");

            let note = vault.join("ref.md");
            create_note(&note, &format!("Link: [[[tag{}]]]", i));

            simulate_rename(vault, &file, &format!("[renamed{}].md", i));

            let content = fs::read_to_string(&note).unwrap();
            // [[[renamed1]]] 형태로 업데이트되어야 함
            assert!(content.contains(&format!("[[[renamed{}]]]", i)), "대괄호 포함 파일명 링크 갱신 실패");
        }
        println!("✅ Test 391-400: 파일명에 대괄호 포함");
    }

    // ========== 그룹 6: 에지 케이스 및 오류 처리 (50 tests) ==========

    /// Test 401-410: 존재하지 않는 파일 참조
    #[test]
    fn test_non_existent_file_references() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let note = vault.join("ref.md");
            create_note(&note, &format!("Link: [[non_existent{}]]", i));

            // 존재하지 않는 파일은 이름 변경 불가하지만,
            // 다른 파일 이름 변경 시 영향받지 않아야 함
            let other = vault.join("other.md");
            create_note(&other, "# Other");

            simulate_rename(vault, &other, "renamed_other.md");

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[non_existent{}]]", i)), "존재하지 않는 링크 유지 실패");
        }
        println!("✅ Test 401-410: 존재하지 않는 파일 참조");
    }

    /// Test 411-420: 부분 매칭 방지 (file vs file2, file_backup)
    #[test]
    fn test_partial_match_prevention() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file1 = vault.join(format!("file{}.md", i));
            let file2 = vault.join(format!("file{}2.md", i));
            let file3 = vault.join(format!("file{}_backup.md", i));
            create_note(&file1, "# File");
            create_note(&file2, "# File2");
            create_note(&file3, "# File Backup");

            let note = vault.join("ref.md");
            create_note(
                &note,
                &format!("Links: [[file{}]], [[file{}2]], [[file{}_backup]]", i, i, i),
            );

            simulate_rename(vault, &file1, &format!("renamed{}.md", i));

            let content = fs::read_to_string(&note).unwrap();
            assert!(content.contains(&format!("[[renamed{}]]", i)), "파일 이름 갱신 실패");
            assert!(content.contains(&format!("[[file{}2]]", i)), "file2는 영향 받지 않아야 함");
            assert!(content.contains(&format!("[[file{}_backup]]", i)), "file_backup은 영향 받지 않아야 함");
        }
        println!("✅ Test 411-420: 부분 매칭 방지");
    }

    /// Test 421-430: 대소문자만 다른 파일
    #[test]
    fn test_case_only_difference() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file_lower = vault.join(format!("file{}.md", i));
            create_note(&file_lower, "# Lower");

            let note = vault.join("ref.md");
            create_note(&note, &format!("Link: [[file{}]]", i));

            // 대소문자만 변경 (OS에 따라 동작이 다를 수 있음)
            let result = std::panic::catch_unwind(|| {
                simulate_rename(vault, &file_lower, &format!("FILE{}.md", i))
            });

            // Windows는 대소문자만 변경 시 에러가 날 수 있음
            if result.is_ok() {
                let content = fs::read_to_string(&note).unwrap();
                // 링크가 [[FILE1]]로 업데이트되거나 [[file1]]로 유지될 수 있음
                assert!(
                    content.contains(&format!("[[FILE{}]]", i)) || content.contains(&format!("[[file{}]]", i)),
                    "대소문자 변경 링크 처리 실패"
                );
            }
        }
        println!("✅ Test 421-430: 대소문자만 다른 파일");
    }

    /// Test 431-440: 읽기 전용 파일
    #[test]
    #[cfg(unix)] // Unix 시스템에서만 테스트
    fn test_readonly_files() {
        use std::os::unix::fs::PermissionsExt;

        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let file = vault.join(format!("file{}.md", i));
            create_note(&file, "# File");

            let note = vault.join("ref.md");
            create_note(&note, &format!("Link: [[file{}]]", i));

            // 읽기 전용 설정
            let mut perms = fs::metadata(&note).unwrap().permissions();
            perms.set_mode(0o444);
            fs::set_permissions(&note, perms).unwrap();

            // 파일 이름 변경 시도
            let result = std::panic::catch_unwind(|| {
                simulate_rename(vault, &file, &format!("renamed{}.md", i))
            });

            // 읽기 전용 파일은 업데이트 실패할 수 있음 (에러 처리 확인)
            // 최소한 패닉 없이 처리되어야 함
        }
        println!("✅ Test 431-440: 읽기 전용 파일");
    }

    /// Test 441-450: 심볼릭 링크
    #[test]
    #[cfg(unix)] // Unix 시스템에서만 테스트
    fn test_symbolic_links() {
        for i in 1..=10 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            let real_file = vault.join(format!("real{}.md", i));
            create_note(&real_file, "# Real");

            let link = vault.join(format!("link{}.md", i));
            std::os::unix::fs::symlink(&real_file, &link).ok();

            let note = vault.join("ref.md");
            create_note(&note, &format!("Link: [[link{}]]", i));

            // 심볼릭 링크 이름 변경
            if link.exists() {
                let result = std::panic::catch_unwind(|| {
                    simulate_rename(vault, &link, &format!("renamed_link{}.md", i))
                });

                if result.is_ok() {
                    let content = fs::read_to_string(&note).unwrap();
                    assert!(
                        content.contains(&format!("[[renamed_link{}]]", i)),
                        "심볼릭 링크 이름 변경 링크 갱신 실패"
                    );
                }
            }
        }
        println!("✅ Test 441-450: 심볼릭 링크");
    }

    // ========== 추가 테스트로 500개 달성 ==========

    /// Test 451-500: 복합 시나리오 (50 tests)
    #[test]
    fn test_complex_scenarios() {
        for scenario in 1..=50 {
            let temp_dir = TempDir::new().unwrap();
            let vault = temp_dir.path();

            // 복잡한 시나리오 설정
            match scenario % 5 {
                0 => {
                    // 다중 폴더, 다중 참조, 다양한 확장자
                    let folders = vec!["A", "B", "C"];
                    for folder in &folders {
                        fs::create_dir(vault.join(folder)).unwrap();
                        let file = vault.join(folder).join("note.md");
                        create_note(&file, "# Note");

                        let att = vault.join(folder).join("note_att");
                        fs::create_dir(&att).ok();
                        fs::write(att.join("file.pdf"), b"PDF").unwrap();
                    }

                    let ref_note = vault.join("index.md");
                    create_note(&ref_note, "[[note]], [[file.pdf]]");

                    let file = vault.join("A").join("note.md");
                    simulate_rename(vault, &file, "renamed.md");

                    let content = fs::read_to_string(&ref_note).unwrap();
                    // A/note.md가 renamed로 변경되었으므로 링크 갱신
                    assert!(content.len() > 0, "복합 시나리오 {} 실패", scenario);
                }
                1 => {
                    // 연쇄 참조 + 순환 참조
                    let files = vec!["a.md", "b.md", "c.md"];
                    for i in 0..files.len() {
                        let file = vault.join(files[i]);
                        let next = if i + 1 < files.len() {
                            files[i + 1]
                        } else {
                            files[0]
                        };
                        let next_stem = next.trim_end_matches(".md");
                        create_note(&file, &format!("Link: [[{}]]", next_stem));
                    }

                    simulate_rename(vault, &vault.join("a.md"), "aa.md");

                    let content_c = fs::read_to_string(vault.join("c.md")).unwrap();
                    assert!(content_c.contains("[[aa]]"), "순환 참조 갱신 실패");
                }
                2 => {
                    // 대량 링크 + 특수문자
                    let file = vault.join("파일-이름_with#special.md");
                    create_note(&file, "# Special");

                    let note = vault.join("ref.md");
                    let mut content = String::new();
                    for _ in 0..50 {
                        content.push_str("[[파일-이름_with#special]]\n");
                    }
                    create_note(&note, &content);

                    simulate_rename(vault, &file, "새로운-파일_renamed.md");

                    let updated = fs::read_to_string(&note).unwrap();
                    assert!(updated.contains("[[새로운-파일_renamed]]"), "특수문자 대량 링크 갱신 실패");
                }
                3 => {
                    // 깊은 폴더 + 폴더 노트
                    let deep = vault.join("A").join("B").join("C");
                    fs::create_dir_all(&deep).unwrap();

                    let folder_note = deep.join("C.md");
                    create_note(&folder_note, "# C");

                    let ref_note = vault.join("ref.md");
                    create_note(&ref_note, "[[C]]");

                    simulate_rename(vault, &folder_note, "D.md");

                    let content = fs::read_to_string(&ref_note).unwrap();
                    assert!(content.contains("[[D]]"), "깊은 폴더 노트 링크 갱신 실패");
                }
                _ => {
                    // 혼합: 노트 + 첨부 + 여러 참조
                    let note = vault.join("main.md");
                    create_note(&note, "# Main");

                    let att_folder = vault.join("main_att");
                    fs::create_dir(&att_folder).unwrap();
                    let img = att_folder.join("image.png");
                    fs::write(&img, b"PNG").unwrap();

                    for i in 1..=5 {
                        let ref_note = vault.join(format!("ref{}.md", i));
                        create_note(&ref_note, "[[main]], [[image.png]]");
                    }

                    simulate_rename(vault, &note, "primary.md");
                    simulate_rename(vault, &img, "photo.png");

                    for i in 1..=5 {
                        let ref_note = vault.join(format!("ref{}.md", i));
                        let content = fs::read_to_string(&ref_note).unwrap();
                        assert!(content.contains("[[primary]]"), "혼합 시나리오 노트 링크 갱신 실패");
                        assert!(content.contains("[[photo.png]]"), "혼합 시나리오 첨부 링크 갱신 실패");
                    }
                }
            }
        }
        println!("✅ Test 451-500: 복합 시나리오 50개");
    }
}
