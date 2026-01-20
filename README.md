# Pelican Prompt

A powerful, file-based prompt management application built with Electron for macOS and Windows. Organize, search, and manage your prompts with lightning-fast access via global shortcuts.

## 🌟 Features

### Core Functionality
- **Global Shortcut Access**: Instantly open the search dialog with `Cmd+K` (Mac) or `Ctrl+K` (Windows)
- **File-based Storage**: All prompts stored as Markdown (`.md`) files in your chosen folder
- **Transparent Floating UI**: Clean, always-on-top interface that blurs away when not in focus
- **Auto-reload**: Prompts are automatically reloaded from disk when you open the search window

### Search & Organization
- **Full-text Search**: Powered by lunr.js with intelligent ranking
  - Title matches: 10x boost
  - Tag matches: 5x boost  
  - Content matches: 1x boost
- **Hierarchical Tag System**: Organize prompts using folder-based hierarchical tags
  - Use hyphens to create tag hierarchies (e.g., `com-mail-formal`, `code-python-async`)
  - Maximum 5 levels of hierarchy
  - Stored as nested folders (e.g., `prompts/com/mail/formal/Business_Letter.md`)
- **Tag Filtering**: 
  - Exact match: `tag:work`
  - Prefix match (wildcard): `tag:com*` (matches `com-mail`, `com-letter`, etc.)
- **Auto-cleanup**: Empty tag folders are automatically removed when all prompts are deleted

### Dynamic Parameters
- **Parameter Syntax**: Define parameters using `[PARAM_NAME]` (uppercase with underscores)
- **Parameter Dialog**: Interactive dialog to fill in parameter values before copying
- **Flexible Copying**: 
  - Copy with filled parameters
  - Copy with placeholders and param=value list appended

### Prompt Management
- **Quick Create**: `Cmd+N` to create a new prompt
- **Quick Edit**: `Cmd+E` to edit selected prompt
- **Clipboard Integration**: Copy prompts directly to clipboard
- **Live Preview**: See prompt content and detected parameters while creating/editing

## 📦 Installation

### Prerequisites

- Node.js (v16 or higher)
- npm

### Setup

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

### Building for Distribution

- **macOS**: `npm run make` (creates a .zip file)
- **Windows**: `npm run make` (creates a Squirrel installer)

## Usage

### First Launch

1. When you first open the app (using `Cmd+K` or `Ctrl+K`), you'll be prompted to select a folder where your prompts will be stored.
2. Select or create a folder - the app will automatically create a `prompts/` subfolder where all your prompt files will be organized.

### Folder Structure

Prompts are organized in a hierarchical folder structure:
```
your-selected-folder/
  prompts/
    work/
      Meeting_Notes.md
      Project_Plan.md
    com/
      mail/
        formal/
          Business_Letter.md
        casual/
          Quick_Reply.md
    code/
      python/
        async/
          Retry_Logic.md
```

Tags are automatically derived from the folder path:
- `prompts/work/Meeting_Notes.md` → tag: `work`
- `prompts/com/mail/formal/Business_Letter.md` → tag: `com-mail-formal`
- `prompts/code/python/async/Retry_Logic.md` → tag: `code-python-async`

### Creating a Prompt

1. Open the search dialog with `Cmd+K` (or `Ctrl+K`)
2. Press `Cmd+N` (or `Ctrl+N`) to create a new prompt
3. Fill in:
   - **Tag**: Hierarchical tag using hyphens (e.g., `com-mail-formal`, `code-python-async`)
     - Max 5 levels: `level1-level2-level3-level4-level5`
     - Letters, numbers, underscores, and hyphens only
   - **Title**: A descriptive title for your prompt (becomes the filename)
   - **Content**: The actual prompt text
4. Click **Save Prompt**

#### Using Parameters

You can define dynamic parameters in your prompts using the syntax `[PARAM_NAME]`. Parameters must be uppercase with underscores.

**Example:**
```
Write a [LANGUAGE] function that [DESCRIPTION].
The function should accept [INPUTS] and return [OUTPUTS].
```

When you use this prompt, you'll be asked to fill in values for `LANGUAGE`, `DESCRIPTION`, `INPUTS`, and `OUTPUTS`.

### Searching for Prompts

1. Open the search dialog with `Cmd+K` (or `Ctrl+K`)
2. Start typing to search across all prompt titles, tags, and content
3. Use `↑` and `↓` arrow keys to navigate results
4. Press `Enter` to select a prompt

#### Search Filters

- **Tag Filter**: Use `tag:tagname` to filter by a specific tag
  - Example: `tag:work meeting` (finds all prompts tagged "work" containing "meeting")
- **Full-Text Search**: Just type normally to search across titles, tags, and content
- **Combined Search**: Mix tag filters with regular search terms

#### Search Ranking

Results are ranked by relevance:
1. **Title matches** (highest priority)
2. **Tag matches** (medium priority)
3. **Content matches** (lower priority)

### Using a Prompt

When you select a prompt:

- **Without Parameters**: The prompt is immediately copied to your clipboard
- **With Parameters**: A dialog appears where you can:
  - Fill in the parameter values and click **Copy** (parameters are replaced)
  - Click **Copy with Placeholders** (parameters are listed at the end as `PARAM=value`)
  - Click **Cancel** to go back

### Editing a Prompt

1. Open the search dialog with `Cmd+K` (or `Ctrl+K`)
2. Navigate to the prompt you want to edit
3. Press `Cmd+E` (or `Ctrl+E`)
4. Make your changes in the editor
5. Click **Save Prompt**

Note: If you change the tag or title, the file will be renamed automatically.

### Keyboard Shortcuts

#### Search Window
- `Cmd/Ctrl+K`: Open/toggle search window
- `↑` / `↓`: Navigate through search results
- `Enter`: Select the highlighted prompt
- `Cmd/Ctrl+N`: Create a new prompt
- `Cmd/Ctrl+E`: Edit the selected prompt
- `Esc`: Close the search window

#### Editor Window
- Standard text editing shortcuts apply
- `Cmd/Ctrl+S`: Save prompt (via Save button)

## File Structure

Prompts are saved as Markdown files with the naming convention:

```
[tag]_[title].md
```

**Example:**
- `work_Meeting_Agenda_Template.md`
- `code_Python_Function_Generator.md`
- `personal_Email_Reply.md`

## Technical Details

### Built With

- **Electron**: Cross-platform desktop application framework
- **TypeScript**: Type-safe JavaScript
- **Electron Forge**: Build and packaging toolchain
- **Lunr.js**: Full-text search indexing
- **Chokidar**: File system watcher
- **Electron Store**: Persistent settings storage

### Architecture

- **Main Process** (`src/main.ts`): Manages application lifecycle, windows, and global shortcuts
- **PromptManager** (`src/promptManager.ts`): Handles file operations, indexing, and search
- **Search Window** (`src/renderer/search/`): Quick search and prompt selection interface
- **Editor Window** (`src/renderer/editor/`): Prompt creation and editing interface
- **Preload Script** (`src/preload.ts`): Secure bridge between renderer and main process

### Data Storage

- **Prompts**: Stored as `.md` files in the user-selected folder
- **Settings**: Stored in OS-specific locations via `electron-store`
  - macOS: `~/Library/Application Support/pelican-prompt/`
  - Windows: `%APPDATA%/pelican-prompt/`
  - Linux: `~/.config/pelican-prompt/`

## Development

### Project Structure

```
PromptLib/
├── src/
## 🏗️ Technical Architecture

### Technology Stack
- **Electron 40.0.0**: Cross-platform desktop framework
- **TypeScript 5.9.3**: Type-safe development
- **Electron Forge**: Build toolchain with Webpack
- **lunr.js 2.3.9**: Client-side full-text search
- **chokidar 5.0.0**: File system watcher
- **electron-store 11.0.2**: Persistent settings storage

### Application Structure

```
src/
├── main.ts                 # Main process (window management, IPC handlers, global shortcuts)
├── preload.ts              # IPC bridge (secure renderer-main communication)
├── promptManager.ts        # Core logic (file operations, search indexing, disk reload)
├── types.ts                # TypeScript interfaces (Prompt, SearchResult, Partial)
└── renderer/
    ├── search/             # Search window (frameless, transparent, always-on-top)
    │   ├── index.html
    │   └── renderer.ts
    └── editor/             # Editor window (prompt creation/editing)
        ├── index.html
        └── renderer.ts
```

### Key Design Decisions

1. **File-based Storage**: Markdown files with `[tag]_[title].md` naming convention
2. **Disk Reload Strategy**: Prompts are reloaded from disk on every window show (Cmd+K) to ensure freshness
3. **Search Ranking**: Weighted field boosting (Title: 10x, Tag: 5x, Content: 1x) for relevant results
4. **Parameter Detection**: Regex-based `[PARAM_NAME]` parsing during file read
5. **Window Architecture**: 
   - Search: Frameless, transparent, always-on-top, hides on blur
   - Editor: Standard window for better focus during content creation

### File Watcher
- Monitors `*.md` files in the prompts folder
- Automatically rebuilds search index on file changes
- Backup: Manual reload on window focus ensures no missed changes

## 🔧 Development

### Running in Development

```bash
npm start
```

The app launches with hot-reload for renderer processes. Type `rs` in terminal to restart main process.

### Building for Distribution

```bash
npm run package  # Package without creating installers
npm run make     # Create distributable packages (Squirrel for Windows, ZIP for macOS)
```

### Project Configuration
- `forge.config.js`: Electron Forge with Webpack plugin, dual entry points
- `webpack.main.config.js`: Main process bundle configuration
- `webpack.renderer.config.js`: Renderer process bundle configuration  
- `tsconfig.json`: TypeScript strict mode with synthetic default imports

## 💡 Tips & Best Practices

1. **Organize with Tags**: Use consistent tags (`work`, `code`, `email`, `meeting`) for better organization
2. **Descriptive Titles**: Make titles searchable - include key terms users will search for
3. **Parameter Naming**: Use clear, uppercase names with underscores (`[PROJECT_NAME]`, `[USER_EMAIL]`)
4. **Backup Strategy**: Prompts are just files - sync with cloud storage (Dropbox, iCloud, Google Drive)
5. **Version Control**: Put prompts folder in Git for version history and team collaboration
6. **Search Syntax**: 
   - Search by content: just type words
   - Filter by tag: `tag:work` or `tag:code`
   - Combine: `tag:email client meeting` finds emails about client meetings

## 🐛 Troubleshooting

### Global Shortcut Not Working
- Verify no other app uses `Cmd+K` / `Ctrl+K`
- Restart the application
- macOS: Check System Preferences > Security & Privacy > Accessibility permissions

### New Prompts Not Appearing
- Press `Cmd+K` to close and reopen - prompts reload from disk automatically
- Verify file is saved in the correct folder with `.md` extension
- Check that file is inside the `prompts/` subfolder structure

### Search Not Finding Prompts
- Check your search query - try broader terms
- Use tag filters: 
  - Exact match: `tag:work`
  - Prefix match: `tag:com*` (finds all tags starting with `com-`)
- Verify prompts exist in the selected folder's `prompts/` subfolder

### Window Not Showing
- Press `Cmd+K` / `Ctrl+K` multiple times
- Check if window is hidden behind other applications
- Restart the application

## 🔄 Migrating from Old Version

If you have existing prompts using the old `tag_Title.md` filename format, use the migration script:

```bash
npx ts-node migrate.ts /path/to/your/prompts/folder
```

This will:
1. Create a `prompts/` subfolder in your selected folder
2. Convert `tag_Title.md` files to `prompts/tag/Title.md` structure
3. Preserve all prompt content and parameters
4. Skip non-conforming files (like README.md)

**Example:**
```bash
npx ts-node migrate.ts ~/Documents/MyPrompts

# Before:
# ~/Documents/MyPrompts/
#   work_Meeting_Notes.md
#   code_Python_Function.md

# After:
# ~/Documents/MyPrompts/
#   prompts/
#     work/
#       Meeting_Notes.md
#     code/
#       Python_Function.md
```

## 📝 File Format Specification

### Folder and Filename Convention

Prompts are stored in a hierarchical folder structure within the `prompts/` subfolder:

```
prompts/
  [tag-segment-1]/
    [tag-segment-2]/
      ...
        [Title].md
```

**Examples:**
- `prompts/work/Meeting_Notes.md` → tag: `work`, title: "Meeting Notes"
- `prompts/com/mail/formal/Business_Letter.md` → tag: `com-mail-formal`, title: "Business Letter"  
- `prompts/code/python/async/Retry_Logic.md` → tag: `code-python-async`, title: "Retry Logic"

**Rules:**
- Tag segments joined by hyphens in the UI
- Maximum 5 levels of folder nesting
- Filename (without .md) becomes the prompt title
- Tag segments: letters, numbers, underscores, hyphens only

### Parameter Syntax
Parameters are defined inline using square brackets with uppercase names:
```markdown
Hello [RECIPIENT_NAME],

This is regarding [PROJECT_NAME]...
```

Valid parameter names:
- Uppercase letters: `A-Z`
- Underscores: `_`
- Examples: `[NAME]`, `[PROJECT_ID]`, `[START_DATE]`

## 🤝 Contributing

This is a personal project but suggestions and improvements are welcome! 

## 📄 License

MIT License - feel free to use and modify for your needs.

## 🙏 Acknowledgments

- Built with Electron and TypeScript
- Search powered by lunr.js
- File watching via chokidar

---

**Made with ❤️ for productivity**

- Ensure prompts are saved in the correct folder
- Check that files have the `.md` extension
- Try reopening the app to rebuild the search index

### Application Won't Start

- Run `npm install` again to ensure all dependencies are installed
- Check the console for error messages
- Try deleting `node_modules` and running `npm install` again

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
