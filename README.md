# Pelican Prompt

A powerful, file-based prompt management application built with Electron for macOS and Windows. Organize, search, and manage your prompts with lightning-fast access via global shortcuts.

## 🌟 Features

### Core Functionality
- **Global Shortcut Access**: Instantly open the search dialog with `Cmd+K` (Mac) or `Ctrl+K` (Windows)
- **File-based Storage**: All prompts stored as Markdown (`.md`) files in your chosen folder
- **Transparent Floating UI**: Clean, always-on-top interface that blurs away when not in focus
- **Dark Mode**: Toggle between light and dark themes with the button in the window's drag handle (theme syncs across all windows)
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
  
### Dynamic Partials
- **Dynamic Selection**: Use `{{> path.to.folder.* }}` to show a dropdown of all partials in that folder
- **Default Value**: tailored specific defaults using `{{> path.to.folder.* default_partial_name }}`
- **Placement**: Great for creating flexible templates where you swap out tone, language, or format on the fly

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

#### Using Dynamic Partials

You can create drop-down menus for selecting partials (reusable snippets) using the syntax `{{> folder.path.* (default) }}`.

**Example structure:**
```
prompts/
  partials/
    tone/
      professional.md
      casual.md
      pirate.md
```

**Prompt content:**
```
Write a response to this email:
[EMAIL_BODY]

Use a {{> partials.tone.* professional }} tone.
```

When you select this prompt, you'll see a dropdown menu to choose between `professional`, `casual`, or `pirate`, with `professional` selected by default.

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
- **Theme Toggle**: Click the 🌙/☀️ button in the drag handle to switch between light and dark modes

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
- **Theme**: User's theme preference (light/dark) persists across sessions

## Development

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
7. **Dark Mode**: Your theme preference syncs across all windows and persists between sessions

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

### Theme Not Applying
- The theme toggle button is in the drag handle at the top of the search window
- Theme changes sync automatically across all open windows
- If theme seems stuck, try restarting the application

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
