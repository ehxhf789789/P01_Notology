<div align="center">
  <img src="icon/Black_logo_detail.png" alt="Notology" width="120" />
  <h1>Notology</h1>
  <p><strong>A structured, linked, and portable knowledge management system</strong></p>
  <p>Obsidian-inspired, Rust-powered. Your notes live in plain Markdown &mdash; on your local drive, NAS, or external disk.</p>

  <p>
    <a href="#download">Download</a> &middot;
    <a href="README.ko.md">한국어</a> &middot;
    <a href="#who-is-notology-for">Use Cases</a> &middot;
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

<!-- HERO IMAGE: docs/images/hero-overview.png -->
<!-- Full app screenshot showing: dark theme, sidebar with folder tree on the left, -->
<!-- rich text editor in the center with a NOTE template open (headings, callouts, task lists visible), -->
<!-- two hover windows floating on the right (one editor, one PDF), and the search panel partially visible. -->
<!-- Resolution: 1920x1080, PNG format. -->
<!-- ![Notology Overview](docs/images/hero-overview.png) -->

## What is Notology?

Notology is a **desktop knowledge management app** that combines structured note templates, wiki-link connections, and a powerful search engine in a single native application.

**Key principles:**

- **Plain Markdown files** &mdash; no proprietary format, no lock-in
- **Portable vault** &mdash; your vault is just a folder. Put it on a USB drive, NAS, or cloud-synced directory and use it anywhere
- **Typed notes** &mdash; 12 templates (meeting, paper, contact, etc.) with structured frontmatter, not just blank pages
- **Native performance** &mdash; Rust backend (Tauri v2) + React frontend. No Electron overhead
- **Offline-first** &mdash; no account, no subscription, no internet required

---

## Who is Notology For?

Notology adapts to any knowledge-intensive workflow. Here are real-world examples:

### Writers & Storytellers

<!-- IMAGE: docs/images/usecase-writer.png -->
<!-- Screenshot showing: a folder tree with folders like "Characters/", "Locations/", "Plot Arcs/", -->
<!-- a CONTACT template used as a character sheet (name, traits, relationships in frontmatter), -->
<!-- and the Graph View showing character-to-location connections via wiki-links. -->
<!-- ![Writer Use Case](docs/images/usecase-writer.png) -->

Manage your novel's universe intuitively. Use **CONTACT templates** as character sheets with structured fields for traits, backstory, and relationships. Create **folder notes** for locations, plot arcs, and timelines. The **Graph View** reveals hidden connections between characters, events, and settings &mdash; giving you a bird's-eye view of your entire story world.

> *Example vault structure:*
> ```
> My Novel/
> ├── Characters/
> │   ├── Characters.md          (folder note: character index)
> │   ├── CONTACT_Aria.md        (character sheet)
> │   └── CONTACT_Marcus.md
> ├── Locations/
> │   ├── Locations.md
> │   └── NOTE_The Old Library.md
> ├── Plot Arcs/
> │   ├── NOTE_Act 1 - The Call.md
> │   └── NOTE_Act 2 - The Journey.md
> └── Research/
>     ├── LIT_Medieval Architecture.md
>     └── DATA_Historical Timeline.md
> ```

### Researchers & Academics

<!-- IMAGE: docs/images/usecase-researcher.png -->
<!-- Screenshot showing: PAPER template with DOI/authors fields filled, LIT template with key arguments, -->
<!-- multiple hover windows open side-by-side (one PDF paper, one note with annotations), -->
<!-- and search results filtering by type:PAPER. -->
<!-- ![Researcher Use Case](docs/images/usecase-researcher.png) -->

Build your personal research library. Use **PAPER templates** to capture DOI, authors, and abstracts for every paper you read. Link papers together with `[[wiki-links]]` to trace idea lineage. Open **hover windows** to read PDFs and take notes simultaneously. Use **THEORY templates** to explore hypotheses and **DATA templates** to document datasets and methodology.

- **Literature review**: LIT template captures source, key arguments, and your critical notes
- **Cross-referencing**: Wiki-links between papers, theories, and data create an interconnected knowledge base
- **Instant recall**: Tantivy full-text search finds any paper, quote, or concept across thousands of notes in milliseconds

### Office Professionals

<!-- IMAGE: docs/images/usecase-office.png -->
<!-- Screenshot showing: MTG template with attendees and agenda filled in, calendar view with task dots, -->
<!-- sidebar showing folders organized by project ("Project Alpha/", "Admin/", "Weekly Reports/"), -->
<!-- and the detail search mode filtering by date range. -->
<!-- ![Office Use Case](docs/images/usecase-office.png) -->

Streamline daily workflow and personal knowledge management. **MTG templates** auto-generate meeting minutes with attendees, agenda, and action items. Track deadlines in the **Calendar View**. Organize projects with containers and find anything instantly with **5 search modes**. The **memo system** lets you annotate documents without modifying originals.

- **Meeting minutes**: MTG template with date-prefixed filenames keeps everything chronological
- **Project organization**: One folder per project, folder notes as project dashboards
- **Portable office**: Store your vault on a NAS and access it from office, home, or on the go

### Students (High School & University)

<!-- IMAGE: docs/images/usecase-student.png -->
<!-- Screenshot showing: SEM template with speaker/topic fields, editor with callout blocks -->
<!-- (info, tip, warning types) for study notes, wiki-links connecting concepts across subjects, -->
<!-- and Graph View showing a knowledge network colored by domain tags. -->
<!-- ![Student Use Case](docs/images/usecase-student.png) -->

Systematize your learning across all subjects. Use **SEM templates** for lecture notes with speaker and topic fields. Create concept maps with **wiki-links** that connect ideas across subjects &mdash; link a physics concept to a math derivation to a lab report. The **Graph View** reveals how your knowledge connects, reinforcing memory through visual association.

- **Study notes**: Markdown formatting with callout blocks, code blocks, and math notation
- **Exam prep**: Full-text search across all notes &mdash; find every mention of a concept instantly
- **Knowledge mapping**: Graph View shows which topics are well-connected and which need more study
- **Portable**: Carry your entire study vault on a USB drive between home, school, and library

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

<!-- GIF: docs/gifs/01-editor.gif -->
<!-- Recording (8-10 seconds): Start with an empty NOTE template. Type "# Meeting Summary" (renders as H1), -->
<!-- then "- Action item 1" (renders as bullet), then "> Important quote" (renders as blockquote). -->
<!-- Toggle the editor toolbar between expanded and collapsed mode. Show a callout block being inserted -->
<!-- (select "info" type) with colored border appearing. End by typing a task list "- [ ] Review docs". -->
<!-- Window size: 1200x700, dark theme. Smooth cursor movement, no rushed actions. -->
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

<!-- GIF: docs/gifs/02-wikilinks.gif -->
<!-- Recording (8-10 seconds): In an open note, type "Related to [[" and show the auto-complete dropdown -->
<!-- appearing with note suggestions (show 4-5 note titles in the list). Select a note, link renders. -->
<!-- Then type "![[" to embed an image, show the image rendering inline. -->
<!-- Finally, open the search detail view and scroll to the "Backlinks" section showing 3-4 notes -->
<!-- that reference the current note. -->
<!-- Window size: 1200x700, dark theme. -->
<!-- ![Wiki-links](docs/gifs/02-wikilinks.gif) -->

- **Auto-complete** &mdash; type `[[` and get real-time suggestions from all notes in your vault
- **Image embedding** &mdash; `![[photo.png]]` renders the image inline
- **Auto-update on rename** &mdash; rename a note and all `[[links]]` pointing to it update automatically
- **Backlink tracking** &mdash; see every note that links to the current note in the search detail view
- **Cross-container linking** &mdash; link between different folders freely

### 3. 12 Structured Note Templates

Unlike blank-page note apps, Notology provides **typed notes** with structured frontmatter.

<!-- GIF: docs/gifs/03-templates.gif -->
<!-- Recording (10-12 seconds): Press Ctrl+N to open the template selector modal. -->
<!-- Show the 12 template icons in a grid. Click "MTG" (Meeting) - show the auto-generated filename -->
<!-- with date prefix appearing. The new note opens with pre-filled YAML frontmatter -->
<!-- (title, attendees, agenda fields). Then press Ctrl+N again, select "PAPER" - show the -->
<!-- DOI, authors, abstract fields in frontmatter. Brief pause to show the structured body template. -->
<!-- Window size: 1200x700, dark theme. -->
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

<!-- GIF: docs/gifs/04-hover-windows.gif -->
<!-- Recording (10-12 seconds): Open a note from the sidebar (it opens in a hover window). -->
<!-- Drag the window to reposition it. Open a second note (another hover window appears). -->
<!-- Resize the first window by dragging its corner. Drag the second window to the right -->
<!-- edge of the screen to trigger the snap zone (window auto-arranges to half-screen). -->
<!-- Open a PDF file (third hover window with embedded PDF viewer). Minimize one window -->
<!-- (show the minimize animation). Click the minimized tab to restore it. -->
<!-- Window size: 1400x900, dark theme. Show at least 3 hover windows simultaneously. -->
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

<!-- GIF: docs/gifs/05-graph.gif -->
<!-- Recording (10-12 seconds): Switch to the Graph tab in the search panel. Show the full graph -->
<!-- with 30-50 nodes rendered (notes in various template colors, tag nodes in gray, -->
<!-- folder notes with distinct borders). Drag a node and release it (physics simulation responds). -->
<!-- Adjust the "repulsion" slider to spread nodes apart. Adjust "link distance" slider. -->
<!-- Type a search query in the filter box - non-matching nodes fade out, matches glow yellow. -->
<!-- Click a node to open it as a hover window. Show both dark and light theme if possible. -->
<!-- Window size: 1400x900. -->
<!-- ![Graph View](docs/gifs/05-graph.gif) -->

- **Force-directed layout** powered by d3-force
- **Adjustable physics** &mdash; sliders for repulsion, link distance, gravity, center force
- **Node types** &mdash; notes (colored by template), tags (by namespace), attachments
- **Folder notes** highlighted with distinct color
- **Filter** by note type, tag, or search query
- **Click to open** any note directly from the graph
- **Real-time** &mdash; graph updates as you create/edit notes
- **Dark & Light mode** &mdash; fully adaptive to your theme preference

### 6. Canvas Editor

A spatial thinking tool for creating flowcharts, mind maps, and diagrams.

<!-- GIF: docs/gifs/06-canvas.gif -->
<!-- Recording (10-12 seconds): Open a SKETCH template. The infinite canvas appears. -->
<!-- Add a rectangle node (type "Start Process" inside it). Add a diamond node (type "Decision?"). -->
<!-- Draw a connection arrow from rectangle to diamond. Add a circle node (type "End"). -->
<!-- Draw arrows from diamond to circle. Pan the canvas by dragging, then zoom in/out with scroll. -->
<!-- Show the parallelogram shape being added. End with the complete flowchart visible. -->
<!-- Window size: 1200x700, dark theme. -->
<!-- ![Canvas](docs/gifs/06-canvas.gif) -->

- **Infinite canvas** with pan and zoom
- **4 shape types** &mdash; rectangle, diamond (decision), circle (start/end), parallelogram (I/O)
- **Connection arrows** between shapes
- **Rich text inside nodes** &mdash; not just plain text
- **Export as note** &mdash; canvas data stored in frontmatter

### 7. Full-Text Search (5 Modes)

Powered by **Tantivy** (the Rust equivalent of Apache Lucene), search is instant even with thousands of notes.

<!-- GIF: docs/gifs/07-search.gif -->
<!-- Recording (12-15 seconds): Open the search panel (Ctrl+Shift+F). Type a query in Notes mode -->
<!-- - show instant results appearing. Switch to "Body" tab - show full-text results with -->
<!-- highlighted matching snippets. Switch to "Attachments" tab - show PDF/image files listed. -->
<!-- Switch to "Details" tab - show the metadata filter UI (date range picker, type filter, -->
<!-- tag filter dropdowns). Select a date range and type filter, results update live. -->
<!-- Finally switch to "Graph" tab - show the visual graph with search highlighting. -->
<!-- Window size: 1400x900, dark theme. -->
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

<!-- GIF: docs/gifs/08-calendar.gif -->
<!-- Recording (8-10 seconds): Open the calendar (Ctrl+Shift+C). Show the monthly grid with -->
<!-- task count dots on several dates. Click a date that has tasks - show the detail panel -->
<!-- expanding with note titles, task checkboxes, and memos for that day. -->
<!-- Navigate to the next month with the arrow button. Click another date. -->
<!-- Click "Create note" button on a date to show the template selector. -->
<!-- Window size: 1200x700, dark theme. -->
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

<!-- IMAGE: docs/images/10-comments.png -->
<!-- Screenshot showing: an open note with highlighted text and a comment bubble, -->
<!-- the comment panel on the right side with 3-4 comments (including one with a task checkbox), -->
<!-- and the memo count badge visible in the search results list on the left. -->
<!-- Window size: 1400x900, dark theme. -->
<!-- ![Comments](docs/images/10-comments.png) -->

- **Inline comments** &mdash; highlight text and add a comment
- **Memos** &mdash; standalone notes attached to a file
- **Task tracking** &mdash; comments can contain tasks with checkboxes
- **Memo count** shown in search results for quick overview

### 11. Settings & Customization

<!-- IMAGE: docs/images/11-settings.png -->
<!-- Screenshot showing: the Settings panel open with sections visible: -->
<!-- Appearance (theme selector showing Dark/Light/System, font selector), -->
<!-- Language toggle (Korean/English), Keyboard shortcuts section with remappable keys, -->
<!-- and the template editor showing enabled/disabled template toggles. -->
<!-- Show both dark and light theme variants side by side if possible. -->
<!-- Window size: 1200x700. -->
<!-- ![Settings](docs/images/11-settings.png) -->

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

## Visual Asset Guide

Below is a complete guide for all images and GIFs referenced in this README. Use this as a checklist when creating visual assets.

### Directory Structure

```
docs/
├── images/
│   ├── hero-overview.png        (1920x1080) Main app screenshot
│   ├── usecase-writer.png       (1400x900)  Writer/novelist use case
│   ├── usecase-researcher.png   (1400x900)  Researcher/academic use case
│   ├── usecase-office.png       (1400x900)  Office professional use case
│   ├── usecase-student.png      (1400x900)  Student use case
│   ├── 10-comments.png          (1400x900)  Comment & memo system
│   └── 11-settings.png          (1200x700)  Settings panel
└── gifs/
    ├── 01-editor.gif            (1200x700, 8-10s)   Editor features
    ├── 02-wikilinks.gif         (1200x700, 8-10s)   Wiki-links & backlinks
    ├── 03-templates.gif         (1200x700, 10-12s)  Template selector & frontmatter
    ├── 04-hover-windows.gif     (1400x900, 10-12s)  Multi-window editing
    ├── 05-graph.gif             (1400x900, 10-12s)  Graph view & physics
    ├── 06-canvas.gif            (1200x700, 10-12s)  Canvas editor flowchart
    ├── 07-search.gif            (1400x900, 12-15s)  5 search modes
    └── 08-calendar.gif          (1200x700, 8-10s)   Calendar view
```

### Recording Guidelines

- **Theme**: Use dark theme by default; include light theme variant for hero image and Graph View GIF
- **Content**: Use realistic-looking sample data (not "Lorem ipsum"). Create a demo vault with 20-30 notes across multiple templates
- **Cursor**: Show natural mouse movements. Pause briefly on key UI elements before clicking
- **Frame rate**: 15-20 FPS for GIFs (good quality, reasonable file size)
- **Format**: PNG for static images, GIF for animated recordings. Optimize GIFs to stay under 5 MB each
- **Tool**: [ScreenToGif](https://www.screentogif.com/) (free, open source) or [ShareX](https://getsharex.com/) recommended

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
