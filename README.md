<div align="center">
  <img src="icon/Black_logo_detail.png" alt="Notology" width="120" />
  <h1>Notology</h1>
  <p><strong>A structured, linked, and portable knowledge management system</strong></p>
  <p>Obsidian-inspired, Rust-powered. Your notes live in plain Markdown &mdash; on your local drive, NAS, or external disk.</p>

  <p>
    <a href="#download">Download</a> &middot;
    <a href="README.ko.md">한국어</a> &middot;
    <a href="#notology-vs-obsidian">vs Obsidian</a> &middot;
    <a href="#features-in-depth">Features</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/version-1.0.4-blue" alt="Version" />
    <img src="https://img.shields.io/badge/platform-Windows-0078D6?logo=windows" alt="Windows" />
    <img src="https://img.shields.io/badge/built_with-Tauri_v2-FFC131?logo=tauri" alt="Tauri" />
    <img src="https://img.shields.io/badge/search-Tantivy-orange" alt="Tantivy" />
    <img src="https://img.shields.io/github/license/ehxhf789789/Notology" alt="License" />
  </p>
</div>

---

<!-- HERO GIF: Full app overview (editor + sidebar + hover windows open) -->
<!-- ![Notology Overview](docs/gifs/01-overview.gif) -->

## What is Notology?

Notology is a **desktop knowledge management app** that combines structured note templates, wiki-link connections, and a powerful search engine in a single native application.

**Key principles:**

- **Plain Markdown files** &mdash; no proprietary format, no lock-in
- **Portable vault** &mdash; your vault is just a folder. Put it on a USB drive, NAS, or cloud-synced directory and use it anywhere
- **Typed notes** &mdash; 12 templates (meeting, paper, contact, etc.) with structured frontmatter, not just blank pages
- **Native performance** &mdash; Rust backend (Tauri v2) + React frontend. No Electron overhead
- **Offline-first** &mdash; no account, no subscription, no internet required

---

## Notology vs Obsidian

Notology is inspired by Obsidian's vault-based approach and wiki-link philosophy. Here's what's different:

| | **Notology** | **Obsidian** |
|--|-------------|-------------|
| **Engine** | Tauri v2 (Rust + WebView) | Electron (Chromium) |
| **Search** | Tantivy full-text engine (Rust) | Built-in file search |
| **Note types** | 12 structured templates with auto-frontmatter | Blank markdown + community templates |
| **Multi-window** | Built-in hover windows (drag, snap, resize) | Pop-out windows (separate OS windows) |
| **Canvas** | Flowchart shapes (diamond, parallelogram, circle) + arrows | Cards and connections |
| **Comments** | Built-in per-note comment/memo system | Plugin required |
| **Graph** | Force-directed with physics controls + type coloring | Built-in graph |
| **Portable vault** | Vault locking + conflict detection for shared drives | Sync via paid service |
| **Price** | Free and open source | Free core, paid Sync/Publish |
| **Code** | Open source (MIT) | Closed source |

---

## Features in Depth

### 1. Rich Text Editor

A TipTap-based editor that renders Markdown as rich text in real time.

<!-- GIF: 01-editor.gif -->
<!-- ![Editor](docs/gifs/01-editor.gif) -->

- **Markdown + WYSIWYG hybrid** &mdash; type `# `, `- `, `> ` and watch it render instantly
- **6 callout blocks** &mdash; info, warning, error, success, note, tip (with colored borders)
- **Tables** with colored cells and header rows
- **Code blocks** with syntax highlighting (highlight.js, 180+ languages)
- **Task lists** with interactive checkboxes
- **Subscript / Superscript** for scientific notation
- **Collapsible toolbar** &mdash; full formatting bar or minimal mode
- **Custom keyboard shortcuts** &mdash; every action is remappable

### 2. Wiki-Links & Backlinks

The backbone of your knowledge graph. Link any note to any other note with `[[double brackets]]`.

<!-- GIF: 02-wikilinks.gif -->
<!-- ![Wiki-links](docs/gifs/02-wikilinks.gif) -->

- **Auto-complete** &mdash; type `[[` and get real-time suggestions from all notes in your vault
- **Image embedding** &mdash; `![[photo.png]]` renders the image inline
- **Auto-update on rename** &mdash; rename a note and all `[[links]]` pointing to it update automatically
- **Backlink tracking** &mdash; see every note that links to the current note in the search detail view
- **Cross-container linking** &mdash; link between different folders freely

### 3. 12 Structured Note Templates

Unlike blank-page note apps, Notology provides **typed notes** with structured frontmatter.

<!-- GIF: 03-templates.gif -->
<!-- ![Templates](docs/gifs/03-templates.gif) -->

| Template | Icon | Use Case | Auto-generated Fields |
|----------|------|----------|----------------------|
| **NOTE** | General | Everyday notes | title, tags, created |
| **SKETCH** | Canvas | Visual diagrams | title, canvas data |
| **MTG** | Meeting | Meeting minutes | title, attendees, agenda, date |
| **SEM** | Seminar | Seminar/lecture notes | title, speaker, topic |
| **EVENT** | Event | Event documentation | title, date, location |
| **OFA** | Official | Official affairs | title, category, status |
| **PAPER** | Research | Research paper notes | title, authors, DOI, abstract |
| **LIT** | Literature | Literature review | title, source, key arguments |
| **DATA** | Data | Data documentation | title, source, methodology |
| **THEO** | Theory | Theory exploration | title, domain, premises |
| **CONTACT** | Contact | Contact cards | name, organization, email, phone |
| **SETUP** | Config | Configuration notes | title, category |

**Each template provides:**
- Auto-generated filename with date prefix (e.g., `MTG_260208_Weekly Standup.md`)
- Structured YAML frontmatter
- 4 tag categories: `domain`, `who`, `org`, `ctx`
- Custom color coding throughout the UI
- Pre-filled body structure

### 4. Hover Windows (Multi-window Editing)

Open multiple notes simultaneously in floating, draggable windows &mdash; without leaving the app.

<!-- GIF: 04-hover-windows.gif -->
<!-- ![Hover Windows](docs/gifs/04-hover-windows.gif) -->

- **Drag & drop** positioning anywhere on screen
- **Resize** from any edge or corner
- **Snap zones** &mdash; drag to screen edges to auto-arrange
- **Minimize / restore** with animation
- **4 size presets** &mdash; Small, Medium, Large, XL (keyboard shortcut)
- **Zoom** &mdash; Ctrl+Scroll to zoom in/out per window
- **Content caching** &mdash; switch between windows instantly
- **5 content types supported:**

| Type | Opens When |
|------|-----------|
| **Editor** | `.md` files &mdash; full editing with toolbar |
| **PDF** | `.pdf` files &mdash; embedded viewer |
| **Image** | `.png`, `.jpg`, `.gif`, etc. &mdash; zoomable preview |
| **Code** | `.js`, `.py`, `.rs`, etc. &mdash; syntax highlighted read-only |
| **Web** | URLs &mdash; embedded web preview |

### 5. Interactive Graph View

Visualize your entire knowledge network as a force-directed graph.

<!-- GIF: 05-graph.gif -->
<!-- ![Graph View](docs/gifs/05-graph.gif) -->

- **Force-directed layout** powered by d3-force
- **Adjustable physics** &mdash; sliders for repulsion, link distance, gravity, center force
- **Node types** &mdash; notes (colored by template), tags (by namespace), attachments
- **Folder notes** highlighted with distinct color
- **Filter** by note type, tag, or search query
- **Click to open** any note directly from the graph
- **Real-time** &mdash; graph updates as you create/edit notes

### 6. Canvas Editor

A spatial thinking tool for creating flowcharts, mind maps, and diagrams.

<!-- GIF: 06-canvas.gif -->
<!-- ![Canvas](docs/gifs/06-canvas.gif) -->

- **Infinite canvas** with pan and zoom
- **4 shape types** &mdash; rectangle, diamond (decision), circle (start/end), parallelogram (I/O)
- **Connection arrows** between shapes
- **Rich text inside nodes** &mdash; not just plain text
- **Export as note** &mdash; canvas data stored in frontmatter

### 7. Full-Text Search (5 Modes)

Powered by **Tantivy** (the Rust equivalent of Apache Lucene), search is instant even with thousands of notes.

<!-- GIF: 07-search.gif -->
<!-- ![Search](docs/gifs/07-search.gif) -->

| Mode | What it does | Example |
|------|-------------|---------|
| **Notes** | Search titles, tags, note types | `type:MTG tag:project-alpha` |
| **Body** | Full-text content search with highlighted snippets | `"quarterly review"` |
| **Attachments** | Find files by name, extension, size | `*.pdf` |
| **Details** | Metadata browser with filters (date, type, tags, memos) | Filter by date range + type |
| **Graph** | Visual graph with search highlighting | Click nodes to navigate |

### 8. Calendar View

Track tasks, memos, and events on a monthly calendar.

<!-- GIF: 08-calendar.gif -->
<!-- ![Calendar](docs/gifs/08-calendar.gif) -->

- Monthly grid with **task count indicators** per day
- Click a date to see all notes, tasks, and memos for that day
- **Create notes directly** from the calendar
- Navigate months with arrow buttons

### 9. Portable Vault &mdash; Take Your Notes Anywhere

Your vault is just a folder. No database, no proprietary format. This means you can:

- **NAS** &mdash; put your vault on a NAS (Synology, QNAP, etc.) and access it from any computer
- **External drive** &mdash; carry your vault on a USB drive or external SSD
- **Cloud sync** &mdash; use any sync service (Dropbox, Google Drive, OneDrive) since it's just files

**Built-in safety for shared storage:**

| Feature | Description |
|---------|-------------|
| **Vault locking** | Prevents two devices from editing the same vault simultaneously |
| **Conflict detection** | Detects sync conflicts and alerts you to resolve manually |
| **Atomic writes** | Uses temp-file + rename pattern to prevent file corruption during sync |
| **Bulk sync awareness** | Pauses UI updates during large sync operations to avoid flickering |

### 10. Comment & Memo System

Add persistent annotations to any note without modifying the note body.

- **Inline comments** &mdash; highlight text and add a comment
- **Memos** &mdash; standalone notes attached to a file
- **Task tracking** &mdash; comments can contain tasks with checkboxes
- **Memo count** shown in search results for quick overview

### 11. Settings & Customization

<!-- Screenshot: settings panel -->

- **Themes** &mdash; Dark, Light, System (auto-detect)
- **Fonts** &mdash; built-in options + custom font loading
- **Language** &mdash; English, Korean
- **Keyboard shortcuts** &mdash; fully remappable, every action customizable
- **Template editor** &mdash; enable/disable templates, customize fields
- **Graph physics** &mdash; persistent per-vault settings
- **Tag colors** &mdash; 10 color schemes for tag namespaces

---

## Download

Go to the [Releases](../../releases/latest) page:

| File | Description |
|------|-------------|
| `Notology_x.x.x_x64-setup.exe` | Windows installer (recommended) |
| `Notology_x.x.x_x64_en-US.msi` | MSI installer |

**Requirements:** Windows 10 (1803+) or Windows 11, 64-bit, 4GB+ RAM

---

## Quick Start

```
1. Download & install from Releases
2. Launch Notology
3. Click "Open Vault" → select any folder
4. Press Ctrl+N → choose a template → start writing
5. Type [[ to link notes together
6. Press Ctrl+Shift+F → click Graph tab to see your knowledge network
```

> **Tip:** Place your vault folder on a NAS or external drive to use it across multiple computers.

---

## Keyboard Shortcuts

| Category | Shortcut | Action |
|----------|----------|--------|
| **Navigation** | `Ctrl+N` | New note |
| | `Ctrl+Shift+F` | Search |
| | `Ctrl+Shift+C` | Calendar |
| | `Ctrl+Left` | Toggle sidebar |
| | `Ctrl+Right` | Toggle hover panel |
| **Formatting** | `Ctrl+B / I / U` | Bold / Italic / Underline |
| | `Ctrl+Shift+X` | Strikethrough |
| | `Ctrl+E` | Inline code |
| | `Ctrl+Shift+H` | Highlight |
| | `Ctrl+1` ~ `6` | Heading 1-6 |
| **Blocks** | `Ctrl+Shift+8 / 7 / 9` | Bullet / Ordered / Task list |
| | `Ctrl+Shift+B` | Blockquote |
| | `Ctrl+Shift+E` | Code block |
| **System** | `Ctrl+S` | Save |
| | `Ctrl+D` | Delete note |
| | `Ctrl+M` | Toggle memos |
| | `Ctrl+Z / Shift+Z` | Undo / Redo |

All shortcuts are remappable in **Settings > Shortcuts**.

---

## Build from Source

```bash
# Prerequisites: Node.js 18+, Rust 1.77+, Tauri v2 prerequisites
git clone https://github.com/ehxhf789789/Notology.git
cd Notology
npm install

# Development
npx tauri dev

# Production build (obfuscated, devtools disabled)
npx tauri build -- --no-default-features
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Tauri v2](https://v2.tauri.app/) (Rust + WebView2) |
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Editor** | [TipTap](https://tiptap.dev/) + 11 custom extensions |
| **State** | [Zustand](https://zustand.docs.pmnd.rs/) (10 stores) |
| **Search** | [Tantivy](https://github.com/quickwit-oss/tantivy) (Rust full-text engine) |
| **Graph** | [force-graph](https://github.com/vasturiano/force-graph) (d3-force) |
| **File watch** | [notify](https://github.com/notify-rs/notify) (cross-platform) |

---

## Roadmap

- [ ] macOS / Linux builds
- [ ] Plugin system
- [ ] Mobile companion app
- [ ] AI-powered suggestions
- [ ] PDF annotation
- [ ] Export (PDF / HTML / Docx)

---

## Contributing

1. Fork this repository
2. Create a branch (`git checkout -b feature/your-feature`)
3. Commit & push
4. Open a Pull Request

Bug reports and feature requests: [GitHub Issues](../../issues)

---

## License

[MIT License](LICENSE) &mdash; free to use, modify, and distribute.

---

<div align="center">
  <sub>Built with Tauri, React, and Rust</sub><br />
  <strong>Notology</strong> &mdash; Your knowledge, structured and connected.
</div>
