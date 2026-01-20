import { contextBridge, ipcRenderer } from 'electron';
import { Prompt, SearchResult, ParameterValue } from './types';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getPromptsFolder: () => ipcRenderer.invoke('get-prompts-folder'),
  openFolderInFilesystem: () => ipcRenderer.invoke('open-folder-in-filesystem'),
  searchPrompts: (query: string) => ipcRenderer.invoke('search-prompts', query),
  getAllPrompts: () => ipcRenderer.invoke('get-all-prompts'),
  savePrompt: (tag: string, title: string, content: string, existingPath?: string) => 
    ipcRenderer.invoke('save-prompt', tag, title, content, existingPath),
  getPrompt: (filePath: string) => ipcRenderer.invoke('get-prompt', filePath),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  openEditor: (promptPath?: string) => ipcRenderer.invoke('open-editor', promptPath),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  onLoadPrompt: (callback: (prompt: Prompt) => void) => {
    ipcRenderer.on('load-prompt', (_event, prompt) => callback(prompt));
  },
  onReloadPrompts: (callback: () => void) => {
    ipcRenderer.on('reload-prompts', () => callback());
  }
});

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      getPromptsFolder: () => Promise<string | undefined>;
      openFolderInFilesystem: () => Promise<boolean>;
      searchPrompts: (query: string) => Promise<SearchResult[]>;
      getAllPrompts: () => Promise<Prompt[]>;
      savePrompt: (tag: string, title: string, content: string, existingPath?: string) => Promise<string>;
      getPrompt: (filePath: string) => Promise<Prompt | null>;
      copyToClipboard: (text: string) => Promise<boolean>;
      openEditor: (promptPath?: string) => Promise<void>;
      closeWindow: () => Promise<void>;
      hideWindow: () => Promise<void>;
      onLoadPrompt: (callback: (prompt: Prompt) => void) => void;
      onReloadPrompts: (callback: () => void) => void;
    };
  }
}
