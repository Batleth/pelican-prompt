# Pelican Prompt - Technical Implementation Guide

## Architecture Overview

PromptLib follows Electron's multi-process architecture with a focus on reliability, speed, and user experience.

### Process Model

**Main Process** (`src/main.ts`)
- Application lifecycle management
- Window creation and control (search, editor)
- Global shortcut registration (Cmd+K)
- IPC handlers for all renderer requests
- PromptManager instance ownership

**Renderer Processes**
- **Search Window**: Transparent, frameless UI for finding and selecting prompts
- **Editor Window**: Standard window for creating and editing prompts

**Preload Bridge** (`src/preload.ts`)
- Secure IPC communication via `contextBridge`
- No direct Node.js access from renderers
- Type-safe API surface

## Key Components

### 1. PromptManager (`src/promptManager.ts`)

**Purpose**: Central hub for all prompt operations, search indexing, and file system operations.

**Core Methods**:
```typescript
constructor(promptsFolder: string)
  → Initializes with folder path
  → Loads initial prompts from disk
  → Sets up file watcher

reloadFromDisk(): void
  → PUBLIC: Force reload all prompts
  → Called on every window show for reliability
  → Clears Map, rescans directory, rebuilds index

loadPrompts(): void
  → PRIVATE: Scans *.md files
  → Parses each into Prompt objects
  → Stores in Map<filePath, Prompt>

rebuildIndex(): void
  → Builds lunr.js search index
  → Field boosting: Title (10x), Tag (5x), Content (1x)

search(query: string): SearchResult[]
  → Parses tag filter (tag:name)
  → Executes lunr search
  → Returns sorted by relevance

parsePromptFile(filePath: string): Prompt | null
  → Extracts tag/title from filename
  → Regex: /\[([A-Z_]+)\]/g for parameters
  → Returns structured Prompt object
```

**Critical Design Decision**: **Reload on Window Show**

**Problem**: File watcher (chokidar) occasionally misses file creation, especially atomic writes (temp file → rename).

**Solution**: Force `reloadFromDisk()` on every `getAllPrompts()` call:

```typescript
// main.ts
ipcMain.handle('get-all-prompts', () => {
  if (!promptManager) return [];
  promptManager.reloadFromDisk(); // Always fresh from disk
  return promptManager.getAllPrompts();
});
```

**Trade-off**: ~10-50ms delay on window open, but 100% reliability.

### 2. Search Window (`src/renderer/search/`)

**Architecture**:
- Frameless (`frame: false`)
- Transparent (`transparent: true`)
- Always on top (`alwaysOnTop: true`)
- Auto-hide on blur

**Reload Strategy**:
```typescript
window.addEventListener('focus', async () => {
  searchInput.value = ''; // Clear previous search
  await loadPrompts(''); // Triggers disk reload via IPC
  renderResults(); // Update UI
  searchInput.focus(); // Ready for typing
});
```

**Event Listener Management**:

**Problem**: Re-rendering entire DOM would duplicate event listeners (typing "abc" → "aabbcc").

**Solution**: Separate full render from partial updates:

```typescript
// Called once on init
function render() {
  app.innerHTML = `...full DOM...`;
  setupEventListeners(); // Attach once
  renderResults();
}

// Called frequently
function renderResults() {
  resultsContainer.innerHTML = `...only results...`;
  // Re-attach only result click listeners
}
```

**Keyboard Navigation**:
- `↑↓` arrows: Navigate results
- `Enter`: Select prompt
- `Escape`: Hide window
- `Cmd+N`: New prompt
- `Cmd+E`: Edit selected prompt

### 3. Editor Window (`src/renderer/editor/`)

**Features**:
- Standard window (not frameless) for focus
- Real-time parameter detection
- Live preview of detected parameters
- Validation (tag + title required)

**Parameter Detection**:
```typescript
function extractParameters(content: string): string[] {
  const paramRegex = /\[([A-Z_]+)\]/g;
  const params: string[] = [];
  let match;
  while ((match = paramRegex.exec(content)) !== null) {
    if (!params.includes(match[1])) {
      params.push(match[1]);
    }
  }
  return params;
}
```

**Save Flow**:
1. Validate inputs (tag + title)
2. Construct file path from tag hierarchy
3. Create nested folders if needed
4. Write content to disk
5. Close editor window
6. Main window auto-reloads on next show

### 4. Dark Mode & Theme Management

**Architecture**:
- CSS class-based theming (`.dark` on `<body>`)
- Theme stored in electron-store as `'light'` or `'dark'`
- Cross-window theme synchronization via IPC
- Theme persists across sessions

**Implementation**:

```typescript
// Main Process (main.ts)
ipcMain.handle('get-theme', () => {
  return store.get('theme', 'light');
});

ipcMain.handle('set-theme', (_event, theme: string) => {
  store.set('theme', theme);
  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('theme-changed', theme);
  });
  return theme;
});

// Renderer Process
async function initTheme() {
  const theme = await window.electronAPI.getTheme();
  applyTheme(theme);
  
  window.electronAPI.onThemeChanged((theme) => {
    applyTheme(theme);
  });
}

function applyTheme(theme: string) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}
```

**Theme Toggle UI**:
- Positioned in drag handle (search window)
- Toggle button shows 🌙 (light mode) or ☀️ (dark mode)
- Clicking toggles theme, updates all windows instantly
- Focus restored to search input after toggle

**CSS Variables**:
All colors defined with light/dark variants:
```css
body {
  --bg-primary: #ffffff;
  --text-primary: #2c3e50;
  /* ...other light mode colors */
}

body.dark {
  --bg-primary: #1e1e1e;
  --text-primary: #e0e0e0;
  /* ...other dark mode colors */
}
```

**Modal Theming**:
Dynamic modals (parameter dialog) compute colors based on current theme:
```typescript
const isDark = document.body.classList.contains('dark');
const bgColor = isDark ? '#2d2d2d' : '#ffffff';
const textColor = isDark ? '#e0e0e0' : '#2c3e50';
```

## Data Flow Diagrams

### Prompt Creation Flow
2. Call `electronAPI.savePrompt(tag, title, content)`
3. IPC → Main process
4. PromptManager writes file: `[tag]_[title].md`
5. Close editor window
6. File watcher detects change (backup)
7. Next window open reloads from disk (primary)

## Data Flow

### Creating a New Prompt

```
User: Cmd+N in Search Window
  ↓
IPC: electronAPI.openEditor()
  ↓
Main: createEditorWindow()
  ↓
User: Fills tag, title, content
  ↓
User: Clicks Save
  ↓
IPC: electronAPI.savePrompt(tag, title, content)
  ↓
Main: promptManager.savePrompt()
  ↓
FS: Write [tag]_[title].md to disk
  ↓
[File Watcher: Detects change → rebuildIndex() - backup]
  ↓
User: Presses Cmd+K (reopen search)
  ↓
Window Focus Event
  ↓
Renderer: loadPrompts() → electronAPI.getAllPrompts()
  ↓
Main: promptManager.reloadFromDisk()
  ↓
FS: Scan directory, read all .md files
  ↓
Main: rebuildIndex() + return Prompt[]
  ↓
Renderer: renderResults() → Show new prompt ✓
```

### Searching and Copying

```
User: Types query in Search Window
  ↓
Input Event: debounced
  ↓
IPC: electronAPI.searchPrompts(query)
  ↓
Main: promptManager.search(query)
  ↓
Lunr: Execute search with boosted fields
  ↓
Main: Return SearchResult[]
  ↓
Renderer: renderResults() with scores
  ↓
User: Selects prompt (Enter or Click)
  ↓
Check: Does prompt have parameters?
  ├─ NO → Copy directly to clipboard
  └─ YES → Show parameter dialog
       ↓
     User: Fills parameters OR chooses "Copy with Placeholders"
       ↓
     Generate final text
       ↓
     Copy to clipboard
       ↓
     Hide window
```

## Technical Decisions & Rationale

### 1. Disk Reload vs. File Watcher Only

**Chosen**: Hybrid approach - file watcher + reload-on-show

**Rationale**:
- File watchers can miss atomic writes (common in editors)
- Users expect 100% reliability
- Performance cost (10-50ms) acceptable for UX gain
- File watcher remains as optimization for rapid changes

### 2. lunr.js for Search

**Why lunr.js?**
- ✅ Client-side: No backend needed
- ✅ Fast: Sub-millisecond searches for <10k docs
- ✅ Relevance ranking: TF-IDF algorithm
- ✅ Field boosting: Prioritize title/tag matches

**Index Configuration**:
```typescript
lunr(function() {
  this.ref('id'); // File path
  this.field('title', { boost: 10 }); // 10x importance
  this.field('tag', { boost: 5 });    // 5x importance
  this.field('content');              // 1x baseline
  
  documents.forEach(doc => this.add(doc));
});
```

### 3. Transparent Window Styling

**Challenge**: macOS transparent windows show dark vibrancy.

**Solution**:
```typescript
// main.ts
new BrowserWindow({
  transparent: true,
  vibrancy: 'appearance-based', // macOS native blur
  frame: false,
})

// CSS
html, body { background: transparent; }
.container { 
  background: white; /* Solid for readability */
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
```

### 4. IPC Security Model

**Approach**: `contextIsolation` + `contextBridge`

```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getAllPrompts: () => ipcRenderer.invoke('get-all-prompts'),
  // ... limited, validated API
});
```

**Security Benefits**:
- Renderer cannot access Node.js directly
- No `nodeIntegration`
- IPC calls validated in main process
- Type-safe via TypeScript interfaces

## File Format Specification

### Filename Convention
```
[TAG]_[TITLE].md

Examples:
- code_Python_Function.md
- work_Meeting_Notes.md
- email_Professional_Reply.md
```

**Parsing**:
```typescript
const parts = filename.split('_');
const tag = parts[0]; // First part
const title = parts.slice(1).join('_'); // Rest (may contain underscores)
```

### Parameter Syntax

**Format**: `[PARAM_NAME]`

**Rules**:
- Uppercase letters A-Z
- Underscores allowed
- No spaces or special characters

**Regex**: `/\[([A-Z_]+)\]/g`

**Examples**:
```markdown
Hello [RECIPIENT_NAME],

Regarding [PROJECT_NAME], I wanted to discuss [TOPIC]...

Best regards,
[SENDER_NAME]
```

## Performance Characteristics

### Search Index
- **Build Time**: O(n) where n = number of prompts
- **Search Time**: O(log n) with lunr's inverted index
- **Memory**: ~5KB per prompt, 1000 prompts ≈ 5MB
- **Acceptable Range**: <10,000 prompts

### Disk I/O
- **Read Strategy**: Synchronous `fs.readFileSync()`
- **Performance**: <50ms for 1000 files on SSD
- **Optimization**: Could use async if needed for large collections

### Rendering
- **Strategy**: innerHTML replacement
- **Performance**: Smooth for <500 results
- **Future**: Virtual scrolling for >1000 results

## Build & Distribution

### Development
```bash
npm start
```
- Webpack compiles TypeScript
- Hot reload for renderer
- Type `rs` to restart main process

### Production
```bash
npm run make
```

**Output**:
- **macOS**: ZIP in `out/make/zip/darwin/`
- **Windows**: Squirrel installer in `out/make/squirrel.windows/`

**Configuration** (`forge.config.js`):
```javascript
module.exports = {
  makers: [
    { name: '@electron-forge/maker-squirrel' }, // Windows
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] } // macOS
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            { name: 'search_window', html: './src/renderer/search/index.html', js: './src/renderer/search/renderer.ts', preload: { js: './src/preload.ts' } },
            { name: 'editor_window', html: './src/renderer/editor/index.html', js: './src/renderer/editor/renderer.ts', preload: { js: './src/preload.ts' } }
          ]
        }
      }
    }
  ]
};
```

## Known Issues & Limitations

### 1. File Watcher Reliability
**Issue**: Chokidar may miss atomic file writes
**Mitigation**: Reload-on-show strategy (100% reliable)
**Future**: Consider polling as fallback

### 2. Single Tag Per Prompt
**Limitation**: Only one tag allowed
**Workaround**: Use descriptive titles or content
**Future**: Multi-tag support planned

### 3. Global Shortcut Conflicts
**Issue**: Cmd+K may conflict with other apps
**Mitigation**: User can quit conflicting apps
**Future**: Customizable shortcuts

### 4. No Built-in Sync
**Limitation**: No cloud sync
**Workaround**: Use Dropbox/iCloud/Google Drive for folder
**Future**: Could add sync provider integrations

## Future Enhancements

### Short-term
- [ ] Customizable keyboard shortcuts
- [ ] Export/import prompt collections
- [ ] Prompt usage statistics
- [ ] Partial templates browser

### Medium-term
- [ ] Multi-tag support
- [ ] Prompt templates
- [ ] Fuzzy search option
- [ ] Snippet macros

### Long-term
- [ ] Cloud sync integration
- [ ] Collaboration features
- [ ] API for external integrations
- [ ] Plugin system

## Troubleshooting Guide

### Issue: Prompts not appearing after creation
**Cause**: Window not reloading
**Fix**: Press Cmd+K to close and reopen (triggers reload)

### Issue: Search returning no results
**Cause**: Query too specific or typos
**Fix**: Try broader terms, use tag filter: `tag:work`

### Issue: Global shortcut not working
**Cause**: Conflict with another app
**Fix**: Quit other apps using Cmd+K or restart PromptLib

### Issue: Window stuck hidden
**Cause**: macOS window management
**Fix**: Force quit (Cmd+Q) and restart

---

**Version**: 1.0.0  
**Last Updated**: January 20, 2026  
**Platform**: Electron 40.0.0 + TypeScript 5.9.3
