import { app, BrowserWindow, globalShortcut, ipcMain, dialog, clipboard, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { PromptManager } from './promptManager';
import { Prompt } from './types';

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
    
    // Return focus to partials window if it's open
    if (partialsWindow && !partialsWindow.isDestroyed()) {
      partialsWindow.focus();
    }
    // Otherwise return focus to search window if it's open
    else if (searchWindow && !searchWindow.isDestroyed()) {
      searchWindow.show();
      searchWindow.focus();
    }
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
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Workspace Folder',
        buttonLabel: 'Select Workspace'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const folder = result.filePaths[0];
        
        // Verify folder is accessible
        try {
          fs.accessSync(folder, fs.constants.R_OK | fs.constants.W_OK);
        } catch (err) {
          throw new Error('Selected folder is not accessible. Please check permissions.');
        }
        
        // Validate workspace structure - check for prompts and partials folders
        const promptsFolder = path.join(folder, 'prompts');
        const partialsFolder = path.join(folder, 'partials');
        
        const hasPrompts = fs.existsSync(promptsFolder);
        const hasPartials = fs.existsSync(partialsFolder);
        
        if (!hasPrompts || !hasPartials) {
          const missing = [];
          if (!hasPrompts) missing.push('prompts');
          if (!hasPartials) missing.push('partials');
          
          // Create the missing folders
          if (!hasPrompts) {
            fs.mkdirSync(promptsFolder, { recursive: true });
          }
          if (!hasPartials) {
            fs.mkdirSync(partialsFolder, { recursive: true });
          }
          
          console.log(`Created missing workspace folders: ${missing.join(', ')}`);
        }
        
        store.set('promptsFolder', folder);
        
        if (promptManager) {
          promptManager.destroy();
        }
        
        try {
          promptManager = new PromptManager(folder);
        } catch (err: any) {
          throw new Error(`Failed to initialize folder: ${err.message}`);
        }
        
        // Show the search window after successfully selecting workspace
        createSearchWindow();
        
        return folder;
      }
      return null;
    } catch (error: any) {
      console.error('Error selecting folder:', error);
      throw error;
    }
  });

  ipcMain.handle('create-workspace', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Create New Workspace',
        buttonLabel: 'Create Here'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const baseFolder = result.filePaths[0];
        
        // Create workspace folder structure
        const promptsFolder = path.join(baseFolder, 'prompts');
        const partialsFolder = path.join(baseFolder, 'partials');
        
        // Create directories
        fs.mkdirSync(promptsFolder, { recursive: true });
        fs.mkdirSync(partialsFolder, { recursive: true });
        
        // Create example prompt with parameters
        const examplePromptPath = path.join(promptsFolder, 'com', 'mail');
        fs.mkdirSync(examplePromptPath, { recursive: true });
        const examplePromptFile = path.join(examplePromptPath, 'welcome.md');
        const examplePromptContent = `---
tag: com-mail
title: welcome
---

Hi [NAME],

Welcome to [COMPANY]! We're excited to have you on board.

{{> greetings.formal}}

Best regards,
[SENDER_NAME]`;
        fs.writeFileSync(examplePromptFile, examplePromptContent, 'utf-8');
        
        // Create example partial
        const examplePartialPath = path.join(partialsFolder, 'greetings');
        fs.mkdirSync(examplePartialPath, { recursive: true });
        const examplePartialFile = path.join(examplePartialPath, 'formal.md');
        const examplePartialContent = `We look forward to working with you and supporting your success in your new role.`;
        fs.writeFileSync(examplePartialFile, examplePartialContent, 'utf-8');
        
        // Save to store and initialize
        store.set('promptsFolder', baseFolder);
        
        if (promptManager) {
          promptManager.destroy();
        }
        
        promptManager = new PromptManager(baseFolder);
        
        // Show the search window after successfully creating workspace
        createSearchWindow();
        
        return baseFolder;
      }
      return null;
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  });

  ipcMain.handle('get-prompts-folder', () => {
    return store.get('promptsFolder');
  });

  ipcMain.handle('open-folder-in-filesystem', async () => {
    try {
      const folder = store.get('promptsFolder') as string | undefined;
      if (!folder) {
        throw new Error('No prompts folder selected');
      }
      
      if (!fs.existsSync(folder)) {
        throw new Error('Prompts folder no longer exists');
      }
      
      const result = await shell.openPath(folder);
      if (result) {
        throw new Error(`Failed to open folder: ${result}`);
      }
      return true;
    } catch (error: any) {
      console.error('Error opening folder:', error);
      throw error;
    }
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
    try {
      if (!promptManager) {
        throw new Error('Prompts folder not set. Please select a folder first.');
      }
      return await promptManager.savePrompt(tag, title, content, existingPath);
    } catch (error: any) {
      console.error('Error in save-prompt handler:', error);
      throw error;
    }
  });

  ipcMain.handle('save-partial', async (_event, dotPath: string, content: string, existingPath?: string) => {
    try {
      if (!promptManager) {
        throw new Error('Prompts folder not set. Please select a folder first.');
      }
      return await promptManager.savePartial(dotPath, content, existingPath);
    } catch (error: any) {
      console.error('Error in save-partial handler:', error);
      throw error;
    }
  });

  ipcMain.handle('get-prompt', (_event, filePath: string) => {
    if (!promptManager) {
      return null;
    }
    return promptManager.getPrompt(filePath);
  });

  ipcMain.handle('delete-prompt', async (_event, filePath: string) => {
    try {
      if (!promptManager) {
        throw new Error('Prompts folder not set');
      }
      await promptManager.deletePrompt(filePath);
      return true;
    } catch (error: any) {
      console.error('Error deleting prompt:', error);
      throw error;
    }
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

  ipcMain.handle('open-search-window', () => {
    createSearchWindow();
  });

  ipcMain.handle('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle('close-and-open-search', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
    createSearchWindow();
  });

  ipcMain.handle('close-and-open-partials', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
    createPartialsWindow();
  });

  ipcMain.handle('hide-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.hide();
  });

  ipcMain.handle('get-theme', () => {
    return store.get('theme', 'light');
  });

  ipcMain.handle('set-theme', (_event, theme: string) => {
    store.set('theme', theme);
    // Notify all windows about theme change
    if (searchWindow && !searchWindow.isDestroyed()) {
      searchWindow.webContents.send('theme-changed', theme);
    }
    if (editorWindow && !editorWindow.isDestroyed()) {
      editorWindow.webContents.send('theme-changed', theme);
    }
    if (partialsWindow && !partialsWindow.isDestroyed()) {
      partialsWindow.webContents.send('theme-changed', theme);
    }
    return theme;
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
