import { BrowserWindow, app } from 'electron';
import { Prompt } from '../types';

declare const SEARCH_WINDOW_WEBPACK_ENTRY: string;
declare const SEARCH_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

export class WindowManager {
    private mainWindow: BrowserWindow | null = null;

    constructor() { }

    createMainWindow(): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            if (this.mainWindow.isMinimized()) this.mainWindow.restore();
            this.mainWindow.show();
            this.mainWindow.focus();
            return;
        }

        this.mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            frame: false,
            resizable: true, // Allow resizing since it's now a full app window
            transparent: true,
            vibrancy: 'appearance-based',
            webPreferences: {
                preload: SEARCH_WINDOW_PRELOAD_WEBPACK_ENTRY,
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        if (SEARCH_WINDOW_WEBPACK_ENTRY) {
            this.mainWindow.loadURL(SEARCH_WINDOW_WEBPACK_ENTRY);
        }

        // In single window mode, we might not want to hide on blur if it's acting as a regular app
        // But original search window behavior was "hide on blur".
        // User requested consistency. If it's an editor, it shouldn't auto-hide.
        // So we should remove auto-hide on blur for the unified window, or make it conditional.
        // Given the request "aligned and easy navigation", it sounds more like a standard app window.
        // I will remove the auto-hide for now.

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow?.show();
            this.mainWindow?.focus();
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    switchToEditor(prompt?: Prompt) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            this.createMainWindow();
        } else {
            this.mainWindow?.show();
            this.mainWindow?.focus();
        }
        // Send event to renderer logic
        setTimeout(() => {
            this.mainWindow?.webContents.send('open-editor', prompt);
        }, 100);
    }

    switchToPartials() {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            this.createMainWindow();
        } else {
            this.mainWindow?.show();
            this.mainWindow?.focus();
        }
        setTimeout(() => {
            this.mainWindow?.webContents.send('open-partials-browser');
        }, 100);
    }

    notifyThemeChanged(theme: string) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('theme-changed', theme);
        }
    }

    hideWindow() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.hide();
        }
    }

    closeWindow() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.close();
        }
    }
}
