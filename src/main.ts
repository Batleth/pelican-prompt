import { app, BrowserWindow, globalShortcut, ipcMain, dialog, clipboard, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { PromptManager } from './promptManager';
import { Prompt, ParameterValue } from './types';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const store = new Store();
let searchWindow: BrowserWindow | null = null;
let editorWindow: BrowserWindow | null = null;
let partialsWindow: BrowserWindow | null = null;
let promptManager: PromptManager | null = null;

function migrateUserData() {
  const oldPath = path.join(app.getPath('appData'), 'promptlib');
  const newPath = app.getPath('userData'); // pelican-prompt
  
  if (fs.existsSync(oldPath) && !fs.existsSync(path.join(newPath, 'config.json'))) {
    try {
      fs.mkdirSync(newPath, { recursive: true });
      const files = fs.readdirSync(oldPath);
      files.forEach(file => {
        const srcPath = path.join(oldPath, file);
        const destPath = path.join(newPath, file);
        const stat = fs.statSync(srcPath);
        
        if (stat.isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
        // Skip directories like Cache
      });
    } catch (error) {
      console.error('Migration error:', error);
    }
  }
}


const createSearchWindow = (): void => {
  if (searchWindow && !searchWindow.isDestroyed()) {
    searchWindow.show();
    searchWindow.focus();
    // Force reload prompts from disk when window is reshown
    setTimeout(() => {
      searchWindow?.webContents.send('reload-prompts');
    }, 50);
    return;
  }

  searchWindow = new BrowserWindow({
    width: 700,
    height: 500,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    vibrancy: 'appearance-based',
    webPreferences: {
      preload: SEARCH_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (SEARCH_WINDOW_WEBPACK_ENTRY) {
    searchWindow.loadURL(SEARCH_WINDOW_WEBPACK_ENTRY);
  }

  searchWindow.on('blur', () => {
    if (searchWindow && !searchWindow.isDestroyed()) {
      searchWindow.hide();
    }
  });
  
  searchWindow.once('ready-to-show', () => {
    searchWindow?.show();
    searchWindow?.focus();
  });
};

const createEditorWindow = (prompt?: Prompt): void => {
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.show();
    editorWindow.focus();
    if (prompt) {
      editorWindow.webContents.send('load-prompt', prompt);
    }
    return;
  }

  editorWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: EDITOR_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (EDITOR_WINDOW_WEBPACK_ENTRY) {
    editorWindow.loadURL(EDITOR_WINDOW_WEBPACK_ENTRY);
  }

  editorWindow.once('ready-to-show', () => {
    editorWindow?.show();
    if (prompt) {
      editorWindow?.webContents.send('load-prompt', prompt);
    }
  });

  editorWindow.on('closed', () => {
    editorWindow = null;
  });
};

const createPartialsWindow = (): void => {
  if (partialsWindow && !partialsWindow.isDestroyed()) {
    partialsWindow.show();
    partialsWindow.focus();
    return;
  }

  partialsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: PARTIALS_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (PARTIALS_WINDOW_WEBPACK_ENTRY) {
    partialsWindow.loadURL(PARTIALS_WINDOW_WEBPACK_ENTRY);
  }

  partialsWindow.once('ready-to-show', () => {
    partialsWindow?.show();
  });

  partialsWindow.on('closed', () => {
    partialsWindow = null;
  });
};

app.whenReady().then(() => {
  migrateUserData();
  
  // Set dock icon for macOS (only when packaged, as dev mode doesn't have the icon in the right location)
  if (process.platform === 'darwin' && app.isPackaged) {
    const iconPath = path.join(__dirname, '../../build/icons/pelicanprompt.icns');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
  
  // Register global shortcut
  globalShortcut.register('CommandOrControl+K', () => {
    createSearchWindow();
  });

  // Check if prompts folder is set
  const promptsFolder = store.get('promptsFolder') as string | undefined;
  if (promptsFolder) {
    promptManager = new PromptManager(promptsFolder);
  }
  
  // Open the search window immediately on startup
  createSearchWindow();

  // IPC handlers
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const folder = result.filePaths[0];
      store.set('promptsFolder', folder);
      
      if (promptManager) {
        promptManager.destroy();
      }
      promptManager = new PromptManager(folder);
      
      return folder;
    }
    return null;
  });

  ipcMain.handle('get-prompts-folder', () => {
    return store.get('promptsFolder');
  });

  ipcMain.handle('open-folder-in-filesystem', async () => {
    const folder = store.get('promptsFolder') as string | undefined;
    if (folder) {
      await shell.openPath(folder);
      return true;
    }
    return false;
  });

  ipcMain.handle('search-prompts', (_event, query: string) => {
    if (!promptManager) {
      return [];
    }
    return promptManager.search(query);
  });

  ipcMain.handle('get-all-prompts', () => {
    if (!promptManager) {
      return [];
    }
    // Force reload from disk to catch any changes
    promptManager.reloadFromDisk();
    return promptManager.getAllPrompts();
  });

  ipcMain.handle('save-prompt', async (_event, tag: string, title: string, content: string, existingPath?: string) => {
    if (!promptManager) {
      throw new Error('Prompts folder not set');
    }
    return await promptManager.savePrompt(tag, title, content, existingPath);
  });

  ipcMain.handle('get-prompt', (_event, filePath: string) => {
    if (!promptManager) {
      return null;
    }
    return promptManager.getPrompt(filePath);
  });

  ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('open-editor', (_event, prompt?: Prompt) => {
    createEditorWindow(prompt);
    
    // Hide search window
    if (searchWindow && !searchWindow.isDestroyed()) {
      searchWindow.hide();
    }
  });

  // Partials IPC handlers
  ipcMain.handle('get-all-partials', () => {
    if (!promptManager) {
      return [];
    }
    return promptManager.getAllPartials();
  });

  ipcMain.handle('search-partials', (_event, query: string) => {
    if (!promptManager) {
      return [];
    }
    return promptManager.searchPartials(query);
  });

  ipcMain.handle('get-partial', (_event, dotPath: string) => {
    if (!promptManager) {
      return null;
    }
    return promptManager.getPartial(dotPath);
  });

  ipcMain.handle('validate-partials', (_event, partialRefs: string[]) => {
    if (!promptManager) {
      return [];
    }
    return promptManager.validatePartials(partialRefs);
  });

  ipcMain.handle('validate-partial-content', (_event, content: string) => {
    if (!promptManager) {
      return { valid: false, error: 'Prompt manager not initialized' };
    }
    return promptManager.validatePartialContent(content);
  });

  ipcMain.handle('validate-partial-path', (_event, dotPath: string) => {
    if (!promptManager) {
      return { valid: false, error: 'Prompt manager not initialized' };
    }
    return promptManager.validatePartialPath(dotPath);
  });

  ipcMain.handle('resolve-partials', (_event, content: string) => {
    if (!promptManager) {
      return content;
    }
    return promptManager.resolvePartials(content);
  });

  ipcMain.handle('open-partials-browser', () => {
    createPartialsWindow();
  });

  ipcMain.handle('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle('hide-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.hide();
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  
  // Clean up prompt manager
  if (promptManager) {
    promptManager.destroy();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-open the search window when clicking the dock icon
  createSearchWindow();
});

// Declare webpack entry points for TypeScript
declare const SEARCH_WINDOW_WEBPACK_ENTRY: string;
declare const SEARCH_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const EDITOR_WINDOW_WEBPACK_ENTRY: string;
declare const EDITOR_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const PARTIALS_WINDOW_WEBPACK_ENTRY: string;
declare const PARTIALS_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
