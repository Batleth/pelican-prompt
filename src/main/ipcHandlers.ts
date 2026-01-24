import { ipcMain, dialog, shell, clipboard, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';
import { PromptManager } from '../promptManager';
import { WindowManager } from './WindowManager';
import { Prompt } from '../types';

export function registerHandlers(store: any, windowManager: WindowManager, getPromptManager: () => PromptManager | null, setPromptManager: (pm: PromptManager) => void) {

    // Workspace Handlers
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

                // Validate workspace structure
                const promptsFolder = path.join(folder, 'prompts');
                const partialsFolder = path.join(folder, 'partials');

                const hasPrompts = fs.existsSync(promptsFolder);
                const hasPartials = fs.existsSync(partialsFolder);

                if (!hasPrompts || !hasPartials) {
                    if (!hasPrompts) fs.mkdirSync(promptsFolder, { recursive: true });
                    if (!hasPartials) fs.mkdirSync(partialsFolder, { recursive: true });
                    console.log(`Created missing workspace folders`);
                }

                store.set('promptsFolder', folder);

                const currentPm = getPromptManager();
                if (currentPm) currentPm.destroy();

                try {
                    const newPm = new PromptManager(folder);
                    setPromptManager(newPm);
                } catch (err: any) {
                    throw new Error(`Failed to initialize folder: ${err.message}`);
                }

                windowManager.createSearchWindow();
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
                const promptsFolder = path.join(baseFolder, 'prompts');
                const partialsFolder = path.join(baseFolder, 'partials');

                fs.mkdirSync(promptsFolder, { recursive: true });
                fs.mkdirSync(partialsFolder, { recursive: true });

                // Create example prompt
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

                store.set('promptsFolder', baseFolder);

                const currentPm = getPromptManager();
                if (currentPm) currentPm.destroy();

                const newPm = new PromptManager(baseFolder);
                setPromptManager(newPm);

                windowManager.createSearchWindow();
                return baseFolder;
            }
            return null;
        } catch (error: any) {
            console.error('Error creating workspace:', error);
            throw error;
        }
    });

    ipcMain.handle('get-prompts-folder', () => store.get('promptsFolder'));

    ipcMain.handle('open-folder-in-filesystem', async () => {
        try {
            const folder = store.get('promptsFolder') as string | undefined;
            if (!folder) throw new Error('No prompts folder selected');
            if (!fs.existsSync(folder)) throw new Error('Prompts folder no longer exists');

            const result = await shell.openPath(folder);
            if (result) throw new Error(`Failed to open folder: ${result}`);
            return true;
        } catch (error: any) {
            console.error('Error opening folder:', error);
            throw error;
        }
    });

    // Prompt Handlers
    ipcMain.handle('search-prompts', (_event, query: string) => {
        const pm = getPromptManager();
        return pm ? pm.search(query) : [];
    });

    ipcMain.handle('get-all-prompts', () => {
        const pm = getPromptManager();
        if (!pm) return [];
        pm.reloadFromDisk();
        return pm.getAllPrompts();
    });

    ipcMain.handle('save-prompt', async (_event, tag: string, title: string, content: string, existingPath?: string) => {
        const pm = getPromptManager();
        if (!pm) throw new Error('Prompts folder not set. Please select a folder first.');
        return await pm.savePrompt(tag, title, content, existingPath);
    });

    ipcMain.handle('delete-prompt', async (_event, filePath: string) => {
        const pm = getPromptManager();
        if (!pm) throw new Error('Prompts folder not set');
        await pm.deletePrompt(filePath);
        return true;
    });

    ipcMain.handle('get-prompt', (_event, filePath: string) => {
        const pm = getPromptManager();
        return pm ? pm.getPrompt(filePath) : null;
    });

    // Partial Handlers
    ipcMain.handle('get-all-partials', () => {
        const pm = getPromptManager();
        return pm ? pm.getAllPartials() : [];
    });

    ipcMain.handle('search-partials', (_event, query: string) => {
        const pm = getPromptManager();
        return pm ? pm.searchPartials(query) : [];
    });

    ipcMain.handle('save-partial', async (_event, dotPath: string, content: string, existingPath?: string) => {
        const pm = getPromptManager();
        if (!pm) throw new Error('Prompts folder not set. Please select a folder first.');
        return await pm.savePartial(dotPath, content, existingPath);
    });

    ipcMain.handle('get-partial', (_event, dotPath: string) => {
        const pm = getPromptManager();
        return pm ? pm.getPartial(dotPath) : null;
    });

    ipcMain.handle('resolve-partials', (_event, content: string) => {
        const pm = getPromptManager();
        return pm ? pm.resolvePartials(content) : content;
    });

    ipcMain.handle('get-partials-in-folder', (_event, dotPath: string) => {
        const pm = getPromptManager();
        return pm ? pm.getPartialsInFolder(dotPath) : [];
    });

    ipcMain.handle('validate-partials', (_event, partialRefs: string[]) => {
        const pm = getPromptManager();
        return pm ? pm.validatePartials(partialRefs) : [];
    });

    ipcMain.handle('validate-partial-content', (_event, content: string) => {
        const pm = getPromptManager();
        return pm ? pm.validatePartialContent(content) : { valid: false, error: 'Prompt manager not initialized' };
    });

    ipcMain.handle('validate-partial-path', (_event, dotPath: string) => {
        const pm = getPromptManager();
        return pm ? pm.validatePartialPath(dotPath) : { valid: false, error: 'Prompt manager not initialized' };
    });


    // Window Handlers
    ipcMain.handle('open-editor', (_event, prompt?: Prompt) => {
        windowManager.createEditorWindow(prompt);
        windowManager.hideSearchWindow();
    });

    ipcMain.handle('open-partials-browser', () => {
        windowManager.createPartialsWindow();
    });

    ipcMain.handle('open-search-window', () => {
        windowManager.createSearchWindow();
    });

    ipcMain.handle('close-window', (event) => {
        const window = windowManager.getContextWindow(event.sender);
        window?.close();
    });

    ipcMain.handle('hide-window', (event) => {
        const window = windowManager.getContextWindow(event.sender);
        window?.hide();
    });

    ipcMain.handle('close-and-open-search', (event) => {
        windowManager.closeAndOpenSearch(event.sender);
    });

    ipcMain.handle('close-and-open-partials', (event) => {
        windowManager.closeAndOpenPartials(event.sender);
    });

    // Util Handlers
    ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
        clipboard.writeText(text);
        return true;
    });

    ipcMain.handle('get-theme', () => store.get('theme', 'light'));

    ipcMain.handle('set-theme', (_event, theme: string) => {
        store.set('theme', theme);
        windowManager.notifyThemeChanged(theme);
        return theme;
    });
}
