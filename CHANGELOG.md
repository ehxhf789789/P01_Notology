# Changelog

All notable changes to Notology will be documented in this file.

## [1.0.4] - 2026-02-08

### Improved
- Batch hover window refresh for bulk file changes (reduced N calls to 1)
- Search filtering optimized to single-pass loop (was 7 chained filters)
- Graph View: split into 3 effects (physics slider no longer recreates entire graph)
- Modal components lazy-loaded (Calendar, MoveNote, Contact, Meeting, Paper, Literature, Event, VaultLock)
- Production console.log calls gated behind DEV flag
- Content cache mtime aligned with actual file mtime (prevents unnecessary reloads)
- Auto-save timer cancelled before external content reload (prevents overwrite race)

### Fixed
- Graph View: black screen when switching to Graph tab (canvas div dependency)
- Wiki-link persistence: removed broken link cleanup that was deleting valid links

### Security
- JavaScript obfuscation in production builds
- DevTools conditionally disabled in production via Cargo feature flag
- Source maps removed from distribution

## [1.0.3] - 2026-02-01

### Added
- Vault locking system for multi-device safety
- Conflict file detection and user alerts
- Atomic file writes (temp + rename pattern) for sync safety
- NAS platform auto-detection
- Bulk sync status indicator
- Backup system with 5 versions per file, 7-day cleanup

### Improved
- File watcher stability during large sync operations
- Vault config optimistic locking merge on save

## [1.0.2] - 2026-01-20

### Added
- Canvas Editor with flowchart shapes (rectangle, diamond, circle, parallelogram)
- Comment and memo system with inline annotations
- Calendar view with task aggregation by date
- Drag & drop file organization in sidebar
- Multi-file selection with Ctrl+click
- Folder status tracking (none, in_progress, completed, on_hold)

### Improved
- Editor toolbar made collapsible
- Hover window snap zones refined

## [1.0.1] - 2026-01-10

### Added
- Graph View with force-directed layout and physics controls
- 5 search modes (Notes, Body, Attachments, Details, Graph)
- Customizable keyboard shortcuts
- Dark / Light / System theme support
- Custom font loading
- Korean and English language support

### Fixed
- Wiki-link auto-complete performance with large vaults
- File tree refresh after rename operations

## [1.0.0] - 2025-12-25

### Added
- Initial release
- TipTap rich text editor with Markdown support
- Wiki-link syntax with auto-complete and backlink tracking
- 12 structured note templates (NOTE, SKETCH, MTG, SEM, EVENT, OFA, PAPER, LIT, DATA, THEO, CONTACT, SETUP)
- Hover windows for multi-window editing (editor, PDF, image, code, web)
- Tantivy-powered full-text search engine
- Folder notes (filename matches parent folder)
- Sidebar file tree with container navigation
- 6 callout types (info, warning, error, success, note, tip)
- Tables, code blocks, task lists, subscript/superscript
- Auto-generated filenames with date prefix per template
- YAML frontmatter with 4 tag categories (domain, who, org, ctx)
- Vault selector with recent vaults list
