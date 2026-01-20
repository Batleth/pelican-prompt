# Pelican Prompt Architecture

## High-Level Purpose
Pelican Prompt is a file-based prompt manager for desktop (Electron) that enables fast discovery, editing, and clipboard copying of Markdown prompts organized by hierarchical tags. It prioritizes reliability (reload-on-show), speed (lunr search), and consistent theming (light/dark) across frameless, always-on-top windows.

## Module Map (Business Responsibilities)
- src/main.ts: Main process orchestrator — window lifecycle, global shortcuts, IPC handlers, theme broadcast, persistence via electron-store.
- src/preload.ts: Secure IPC bridge — exposes a minimal, type-safe API (`electronAPI`) to renderers.
- src/promptManager.ts: Core data/service layer — scans disk, parses prompts/partials, rebuilds lunr index, executes searches, and watches file changes.
- src/types.ts: Source of truth for shared interfaces (`Prompt`, `SearchResult`, `Partial`).
- src/renderer/search/: Search window UI — drag handle, theme toggle, query input, results list, parameter dialog, copy-to-clipboard.
- src/renderer/editor/: Editor UI — create/edit prompts, parameter detection, validation, save-to-disk.
- src/renderer/partials/: Partials browser — list and edit reusable content snippets.
- example-prompts/: Sample prompts and partials for testing and onboarding.
- webpack.* / forge.config.* / tsconfig.json: Build and tooling configuration for Electron Forge + Webpack + TypeScript.

## Key Data Flows
- Search & Copy Flow:
  1) User presses Cmd/Ctrl+K → main shows search window.
  2) On focus, renderer requests `get-all-prompts` → main triggers `reloadFromDisk()` and returns current prompts.
  3) Renderer builds UI with lunr-ranked results and keyboard navigation.
  4) On select:
     - No parameters → copy content directly, hide window.
     - With parameters → show dialog, collect values, render final text, copy, hide window.
- Save Prompt Flow:
  1) Renderer/editor validates tag/title/content and extracts parameters.
  2) Renderer requests `save-prompt` → main constructs path (nested `prompts/<tag segments>/<Title>.md`), writes file.
  3) Search window refreshes on next show (reload-on-show), ensuring the new/updated prompt appears.
- Theme Change Flow:
  1) Renderer toggles theme → calls `set-theme`.
  2) Main persists theme in electron-store, broadcasts `theme-changed` to all windows.
  3) Each renderer applies `.dark` body class synchronously; parameter modals adapt colors.

## Critical Dependencies (Top 5)
- Electron (40.0.0): Multi-process desktop runtime; enables main/renderer separation, windows, IPC.
- Electron Forge + Webpack (7.11.x / 5.x): Build/packaging pipeline; dev servers, bundling, distribution.
- lunr (2.3.9): Client-side full-text search with field boosting for fast, relevant results.
- chokidar (5.0.0): File system watcher to detect prompt changes; paired with reload-on-show for reliability.
- electron-store (11.0.2): Persistent settings (e.g., prompts folder path, theme) across sessions.
