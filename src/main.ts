import { app, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { PromptManager } from './promptManager';
import { WindowManager } from './main/WindowManager';
import { registerHandlers } from './main/ipcHandlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const store: any = new Store();
const windowManager = new WindowManager();
let promptManager: PromptManager | null = null;
let globalPromptManager: PromptManager | null = null;

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

app.whenReady().then(() => {
  migrateUserData();

  // Set dock icon for macOS (only when packaged, as dev mode doesn't have the icon in the right location)
  if (process.platform === 'darwin' && app.isPackaged) {
    const iconPath = path.join(__dirname, '../../build/icons/pelicanprompt.icns');
    if (fs.existsSync(iconPath)) {
      app.dock?.setIcon(iconPath);
    }
  }

  // Register global shortcut
  globalShortcut.register('CommandOrControl+K', () => {
    windowManager.createMainWindow();
  });

  // Check if prompts folder is set
  const promptsFolder = store.get('promptsFolder') as string | undefined;
  if (promptsFolder) {
    try {
      promptManager = new PromptManager(promptsFolder);
    } catch (e) {
      console.error('Failed to initialize PromptManager:', e);
    }
  }

  // Check if global workspace is set
  const globalPath = store.get('globalWorkspacePath') as string | undefined;
  if (globalPath) {
    try {
      globalPromptManager = new PromptManager(globalPath);
    } catch (e) {
      console.error('Failed to initialize Global PromptManager:', e);
    }
  }

  // Register all IPC handlers
  registerHandlers(
    store,
    windowManager,
    () => promptManager,
    (pm) => { promptManager = pm; },
    () => globalPromptManager,
    (pm) => { globalPromptManager = pm; }
  );

  // Open the search window immediately on startup
  windowManager.createMainWindow();
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

  // Clean up prompt managers
  if (promptManager) {
    promptManager.destroy();
  }
  if (globalPromptManager) {
    globalPromptManager.destroy();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-open the search window when clicking the dock icon
  windowManager.createMainWindow();
});
