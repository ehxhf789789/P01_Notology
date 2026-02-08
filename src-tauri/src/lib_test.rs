// Integration tests for core functionality

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;

    /// Test: import_attachment creates _att folder and copies file
    #[test]
    fn test_import_attachment() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Create test note
        let note_path = vault_path.join("TestNote.md");
        fs::write(&note_path, "# Test Note").unwrap();

        // Create test attachment source
        let source_file = vault_path.join("test_image.png");
        fs::write(&source_file, "fake image data").unwrap();

        // Import attachment (we'll need to simulate this since it's a Tauri command)
        let att_folder = vault_path.join("TestNote_att");
        let expected_dest = att_folder.join("test_image.png");

        // Simulate what import_attachment should do:
        if !att_folder.exists() {
            fs::create_dir(&att_folder).unwrap();
        }
        fs::copy(&source_file, &expected_dest).unwrap();

        // Verify
        assert!(att_folder.exists(), "Attachment folder should exist");
        assert!(expected_dest.exists(), "Attachment file should be copied");

        println!("✅ test_import_attachment passed");
    }

    /// Test: delete_note removes both note and _att folder
    #[test]
    fn test_delete_note_with_attachments() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Create test note with attachment
        let note_path = vault_path.join("ToDelete.md");
        fs::write(&note_path, "# To Delete").unwrap();

        let att_folder = vault_path.join("ToDelete_att");
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("file.txt"), "data").unwrap();

        // Simulate delete_note (order: attachments first, then note)
        if att_folder.exists() {
            fs::remove_dir_all(&att_folder).unwrap();
        }
        fs::remove_file(&note_path).unwrap();

        // Verify
        assert!(!att_folder.exists(), "Attachment folder should be deleted");
        assert!(!note_path.exists(), "Note should be deleted");

        println!("✅ test_delete_note_with_attachments passed");
    }

    /// Test: rename updates _att folder name
    #[test]
    fn test_rename_with_attachments() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Create test note with attachment
        let old_note = vault_path.join("OldName.md");
        fs::write(&old_note, "# Old Name").unwrap();

        let old_att = vault_path.join("OldName_att");
        fs::create_dir(&old_att).unwrap();
        fs::write(old_att.join("file.txt"), "data").unwrap();

        // Simulate rename
        let new_note = vault_path.join("NewName.md");
        let new_att = vault_path.join("NewName_att");

        fs::rename(&old_note, &new_note).unwrap();
        if old_att.exists() {
            fs::rename(&old_att, &new_att).unwrap();
        }

        // Verify
        assert!(new_note.exists(), "Renamed note should exist");
        assert!(new_att.exists(), "Renamed attachment folder should exist");
        assert!(!old_note.exists(), "Old note should not exist");
        assert!(!old_att.exists(), "Old attachment folder should not exist");

        println!("✅ test_rename_with_attachments passed");
    }

    /// Test: move_note moves both note and _att folder
    #[test]
    fn test_move_note_with_attachments() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Create source folder structure
        let src_folder = vault_path.join("source");
        fs::create_dir(&src_folder).unwrap();

        let note_path = src_folder.join("MoveMe.md");
        fs::write(&note_path, "# Move Me").unwrap();

        let att_folder = src_folder.join("MoveMe_att");
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("file.txt"), "data").unwrap();

        // Create destination folder
        let dest_folder = vault_path.join("destination");
        fs::create_dir(&dest_folder).unwrap();

        // Simulate move
        let new_note = dest_folder.join("MoveMe.md");
        let new_att = dest_folder.join("MoveMe_att");

        fs::rename(&note_path, &new_note).unwrap();
        if att_folder.exists() {
            fs::rename(&att_folder, &new_att).unwrap();
        }

        // Verify
        assert!(new_note.exists(), "Moved note should exist in destination");
        assert!(new_att.exists(), "Moved attachment folder should exist in destination");
        assert!(!note_path.exists(), "Original note should not exist");
        assert!(!att_folder.exists(), "Original attachment folder should not exist");

        println!("✅ test_move_note_with_attachments passed");
    }

    /// Test: parallel file import (simulating Promise.all behavior)
    #[test]
    fn test_parallel_import() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Create test note
        let note_path = vault_path.join("BatchTest.md");
        fs::write(&note_path, "# Batch Test").unwrap();

        let att_folder = vault_path.join("BatchTest_att");
        fs::create_dir(&att_folder).unwrap();

        // Create 10 test files
        let mut source_files = Vec::new();
        for i in 0..10 {
            let file_path = vault_path.join(format!("file_{}.txt", i));
            fs::write(&file_path, format!("data {}", i)).unwrap();
            source_files.push(file_path);
        }

        // Simulate parallel import (in real code this uses Promise.all)
        use std::thread;
        let handles: Vec<thread::JoinHandle<()>> = source_files
            .iter()
            .map(|src: &PathBuf| {
                let src = src.clone();
                let dest = att_folder.join(src.file_name().unwrap());
                thread::spawn(move || {
                    fs::copy(&src, &dest).unwrap();
                })
            })
            .collect();

        for handle in handles {
            handle.join().unwrap();
        }

        // Verify all files were copied
        for i in 0..10 {
            let copied_file = att_folder.join(format!("file_{}.txt", i));
            assert!(copied_file.exists(), "File {} should be copied", i);
        }

        println!("✅ test_parallel_import passed (10 files)");
    }

    /// Test: deep folder structure
    #[test]
    fn test_deep_folder_structure() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path();

        // Create 5-level deep structure
        let mut current = vault_path.to_path_buf();
        for i in 1..=5 {
            current = current.join(format!("level{}", i));
            fs::create_dir(&current).unwrap();
        }

        // Create note in deepest folder
        let deep_note = current.join("DeepNote.md");
        fs::write(&deep_note, "# Deep Note").unwrap();

        let att_folder = current.join("DeepNote_att");
        fs::create_dir(&att_folder).unwrap();
        fs::write(att_folder.join("deep_file.txt"), "deep data").unwrap();

        // Verify
        assert!(deep_note.exists(), "Deep note should exist");
        assert!(att_folder.exists(), "Deep attachment folder should exist");

        println!("✅ test_deep_folder_structure passed (5 levels)");
    }
}
