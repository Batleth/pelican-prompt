import { BrowserWindow, app } from 'electron';
import { Prompt } from '../types';

declare const SEARCH_WINDOW_WEBPACK_ENTRY: string;
declare const SEARCH_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const EDITOR_WINDOW_WEBPACK_ENTRY: string;
declare const EDITOR_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const PARTIALS_WINDOW_WEBPACK_ENTRY: string;
declare const PARTIALS_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

export class WindowManager {
    private searchWindow: BrowserWindow | null = null;
    private editorWindow: BrowserWindow | null = null;
    private partialsWindow: BrowserWindow | null = null;

    constructor() { }

    createSearchWindow(): void {
        if (this.searchWindow && !this.searchWindow.isDestroyed()) {
            this.searchWindow.show();
            this.searchWindow.focus();
            // Force reload prompts from disk when window is reshown
            setTimeout(() => {
                this.searchWindow?.webContents.send('reload-prompts');
            }, 50);
            return;
        }

        this.searchWindow = new BrowserWindow({
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
            this.searchWindow.loadURL(SEARCH_WINDOW_WEBPACK_ENTRY);
        }

        this.searchWindow.on('blur', () => {
            if (this.searchWindow && !this.searchWindow.isDestroyed()) {
                this.searchWindow.hide();
            }
        });

        this.searchWindow.once('ready-to-show', () => {
            this.searchWindow?.show();
            this.searchWindow?.focus();
        });
    }

    createEditorWindow(prompt?: Prompt): void {
        if (this.editorWindow && !this.editorWindow.isDestroyed()) {
            this.editorWindow.show();
            this.editorWindow.focus();
            if (prompt) {
                this.editorWindow.webContents.send('load-prompt', prompt);
            }
            return;
        }

        this.editorWindow = new BrowserWindow({
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
            this.editorWindow.loadURL(EDITOR_WINDOW_WEBPACK_ENTRY);
        }

        this.editorWindow.once('ready-to-show', () => {
            this.editorWindow?.show();
            if (prompt) {
                this.editorWindow?.webContents.send('load-prompt', prompt);
            }
        });

        this.editorWindow.on('closed', () => {
            this.editorWindow = null;

            // Return focus to partials window if it's open
            if (this.partialsWindow && !this.partialsWindow.isDestroyed()) {
                this.partialsWindow.focus();
            }
            // Otherwise return focus to search window if it's open
            else if (this.searchWindow && !this.searchWindow.isDestroyed()) {
                this.searchWindow.show();
                this.searchWindow.focus();
            }
        });
    }

    createPartialsWindow(): void {
        if (this.partialsWindow && !this.partialsWindow.isDestroyed()) {
            this.partialsWindow.show();
            this.partialsWindow.focus();
            return;
        }

        this.partialsWindow = new BrowserWindow({
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
            this.partialsWindow.loadURL(PARTIALS_WINDOW_WEBPACK_ENTRY);
        }

        this.partialsWindow.once('ready-to-show', () => {
            this.partialsWindow?.show();
        });

        this.partialsWindow.on('closed', () => {
            this.partialsWindow = null;
        });
    }

    getContextWindow(sender: any): BrowserWindow | null {
        return BrowserWindow.fromWebContents(sender);
    }

    hideSearchWindow() {
        if (this.searchWindow && !this.searchWindow.isDestroyed()) {
            this.searchWindow.hide();
        }
    }

    closeAndOpenSearch(sender: any) {
        const window = this.getContextWindow(sender);
        window?.close();
        this.createSearchWindow();
    }

    closeAndOpenPartials(sender: any) {
        const window = this.getContextWindow(sender);
        window?.close();
        this.createPartialsWindow();
    }

    notifyThemeChanged(theme: string) {
        if (this.searchWindow && !this.searchWindow.isDestroyed()) {
            this.searchWindow.webContents.send('theme-changed', theme);
        }
        if (this.editorWindow && !this.editorWindow.isDestroyed()) {
            this.editorWindow.webContents.send('theme-changed', theme);
        }
        if (this.partialsWindow && !this.partialsWindow.isDestroyed()) {
            this.partialsWindow.webContents.send('theme-changed', theme);
        }
    }
}
