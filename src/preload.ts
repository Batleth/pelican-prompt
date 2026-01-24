import { contextBridge, ipcRenderer } from 'electron';
import { Prompt, SearchResult, Partial } from './types';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  createWorkspace: () => ipcRenderer.invoke('create-workspace'),
  getPromptsFolder: () => ipcRenderer.invoke('get-prompts-folder'),
  openFolderInFilesystem: () => ipcRenderer.invoke('open-folder-in-filesystem'),
  searchPrompts: (query: string) => ipcRenderer.invoke('search-prompts', query),
  getAllPrompts: () => ipcRenderer.invoke('get-all-prompts'),
  savePrompt: (tag: string, title: string, content: string, existingPath?: string) =>
    ipcRenderer.invoke('save-prompt', tag, title, content, existingPath),
  savePartial: (dotPath: string, content: string, existingPath?: string) =>
    ipcRenderer.invoke('save-partial', dotPath, content, existingPath),
  getPrompt: (filePath: string) => ipcRenderer.invoke('get-prompt', filePath),
  deletePrompt: (filePath: string) => ipcRenderer.invoke('delete-prompt', filePath),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  openEditor: (prompt?: Prompt) => ipcRenderer.invoke('open-editor', prompt),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  closeAndOpenSearch: () => ipcRenderer.invoke('close-and-open-search'),
  closeAndOpenPartials: () => ipcRenderer.invoke('close-and-open-partials'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  onLoadPrompt: (callback: (prompt: Prompt) => void) => {
    ipcRenderer.on('load-prompt', (_event, prompt) => callback(prompt));
  },
  onReloadPrompts: (callback: () => void) => {
    ipcRenderer.on('reload-prompts', () => callback());
  },
  // Theme APIs
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: string) => ipcRenderer.invoke('set-theme', theme),
  onThemeChanged: (callback: (theme: string) => void) => {
    ipcRenderer.on('theme-changed', (_event, theme) => callback(theme));
  },
  // Partials APIs
  getAllPartials: () => ipcRenderer.invoke('get-all-partials'),
  searchPartials: (query: string) => ipcRenderer.invoke('search-partials', query),
  getPartial: (dotPath: string) => ipcRenderer.invoke('get-partial', dotPath),
  validatePartials: (refs: string[]) => ipcRenderer.invoke('validate-partials', refs),
  validatePartialContent: (content: string) => ipcRenderer.invoke('validate-partial-content', content),
  validatePartialPath: (dotPath: string) => ipcRenderer.invoke('validate-partial-path', dotPath),
  resolvePartials: (content: string) => ipcRenderer.invoke('resolve-partials', content),
  getPartialsInFolder: (dotPath: string) => ipcRenderer.invoke('get-partials-in-folder', dotPath),
  openPartialsBrowser: () => ipcRenderer.invoke('open-partials-browser'),
  onOpenEditor: (callback: (prompt: Prompt | null) => void) => {
    ipcRenderer.on('open-editor', (_event, prompt) => callback(prompt));
  },
  onOpenPartialsBrowser: (callback: () => void) => {
    ipcRenderer.on('open-partials-browser', () => callback());
  }
});

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      createWorkspace: () => Promise<string | null>;
      getPromptsFolder: () => Promise<string | undefined>;
      openFolderInFilesystem: () => Promise<boolean>;
      searchPrompts: (query: string) => Promise<SearchResult[]>;
      getAllPrompts: () => Promise<Prompt[]>;
      savePrompt: (tag: string, title: string, content: string, existingPath?: string) => Promise<string>;
      savePartial: (dotPath: string, content: string, existingPath?: string) => Promise<string>;
      getPrompt: (filePath: string) => Promise<Prompt | null>;
      deletePrompt: (filePath: string) => Promise<boolean>;
      copyToClipboard: (text: string) => Promise<boolean>;
      openEditor: (prompt?: Prompt) => Promise<void>;
      closeWindow: () => Promise<void>;
      closeAndOpenSearch: () => Promise<void>;
      closeAndOpenPartials: () => Promise<void>;
      hideWindow: () => Promise<void>;
      onLoadPrompt: (callback: (prompt: Prompt) => void) => void;
      onReloadPrompts: (callback: () => void) => void;
      getTheme: () => Promise<string>;
      setTheme: (theme: string) => Promise<string>;
      onThemeChanged: (callback: (theme: string) => void) => void;
      // Partials APIs
      getAllPartials: () => Promise<Partial[]>;
      searchPartials: (query: string) => Promise<Partial[]>;
      getPartial: (dotPath: string) => Promise<Partial | null>;
      validatePartials: (refs: string[]) => Promise<{ valid: boolean; missing: string[] }>;
      validatePartialContent: (content: string) => Promise<{ valid: boolean; error?: string }>;
      validatePartialPath: (dotPath: string) => Promise<{ valid: boolean; error?: string }>;
      resolvePartials: (content: string) => Promise<string>;
      getPartialsInFolder: (dotPath: string) => Promise<Partial[]>;
      openPartialsBrowser: () => Promise<void>;
      onOpenEditor: (callback: (prompt: Prompt | null) => void) => void;
      onOpenPartialsBrowser: (callback: () => void) => void;
    };
  }
}
