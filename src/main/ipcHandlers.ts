import { ipcMain, dialog, shell, clipboard, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';
import { PromptManager } from '../promptManager';
import { WindowManager } from './WindowManager';
import { Prompt } from '../types';

export function registerHandlers(
    store: any,
    windowManager: WindowManager,
    getPromptManager: () => PromptManager | null,
    setPromptManager: (pm: PromptManager) => void,
    getGlobalPromptManager: () => PromptManager | null,
    setGlobalPromptManager: (pm: PromptManager) => void
) {

    // Helper: resolve workspace ID to the correct PromptManager
    function resolveWorkspacePm(workspaceId?: string): PromptManager | null {
        if (workspaceId === 'global') return getGlobalPromptManager();
        if (workspaceId && workspaceId !== 'global') {
            // Project workspace — check if it matches the active project PM
            const pm = getPromptManager();
            if (pm) return pm;
        }
        // Default fallback: project first, then global
        return getPromptManager() || getGlobalPromptManager();
    }

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

                windowManager.createMainWindow();
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

Hi {NAME},

Welcome to {COMPANY}! We're excited to have you on board.

{{> greetings.formal}}

Best regards,
{SENDER_NAME}`;
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

                windowManager.createMainWindow();
                return baseFolder;
            }
            return null;
        } catch (error: any) {
            console.error('Error creating workspace:', error);
            throw error;
        }
    });

    ipcMain.handle('get-prompts-folder', () => store.get('promptsFolder'));

    ipcMain.handle('open-folder-in-filesystem', async (_event, folderPath?: string) => {
        try {
            const folder = folderPath || store.get('promptsFolder') as string | undefined;
            if (!folder) throw new Error('No folder specified');
            if (!fs.existsSync(folder)) throw new Error('Folder no longer exists');

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
        const gpm = getGlobalPromptManager();
        const projectResults = pm ? pm.search(query) : [];
        const globalResults = gpm ? gpm.search(query) : [];
        // Merge and deduplicate by file path
        const seen = new Set<string>();
        const merged = [...projectResults];
        for (const r of projectResults) seen.add(r.prompt.filePath);
        for (const r of globalResults) {
            if (!seen.has(r.prompt.filePath)) {
                merged.push(r);
            }
        }
        return merged;
    });

    ipcMain.handle('get-all-prompts', () => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();
        if (pm) pm.reloadFromDisk();
        if (gpm) gpm.reloadFromDisk();
        const projectPrompts = pm ? pm.getAllPrompts() : [];
        const globalPrompts = gpm ? gpm.getAllPrompts() : [];
        // Merge and deduplicate by file path
        const seen = new Set<string>();
        const merged = [...projectPrompts];
        for (const p of projectPrompts) seen.add(p.filePath);
        for (const p of globalPrompts) {
            if (!seen.has(p.filePath)) {
                merged.push(p);
            }
        }
        return merged;
    });

    ipcMain.handle('save-prompt', async (_event, tag: string, title: string, content: string, existingPath?: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        let targetPm = pm;

        // If existing path is provided, determine which PM owns it
        if (existingPath) {
            if (pm && existingPath.startsWith(pm.getPromptsFolder())) {
                targetPm = pm;
            } else if (gpm && existingPath.startsWith(gpm.getPromptsFolder())) {
                targetPm = gpm;
            } else {
                // Unknown path, default to active (pm) or global (gpm) logic below
                // But if it's an existing file not in our folders, maybe we shouldn't touch it? 
                // For now, let's assume if we can't match it, we treat it as new or error?
                // Actually if standard "Save" flow, it might be new.
            }
        } else {
            // New prompt
            if (pm) {
                targetPm = pm;
            } else if (gpm) {
                targetPm = gpm;
            }
        }

        if (!targetPm) throw new Error('Prompts folder not set. Please select a folder first.');
        return await targetPm.savePrompt(tag, title, content, existingPath);
    });

    ipcMain.handle('delete-prompt', async (_event, filePath: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        let targetPm: PromptManager | null = null;

        if (pm && filePath.startsWith(pm.getPromptsFolder())) {
            targetPm = pm;
        } else if (gpm && filePath.startsWith(gpm.getPromptsFolder())) {
            targetPm = gpm;
        }

        if (!targetPm) throw new Error('Could not find workspace for this prompt');
        await targetPm.deletePrompt(filePath);
        return true;
    });

    ipcMain.handle('get-prompt', (_event, filePath: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        // Try project first
        if (pm) {
            const p = pm.getPrompt(filePath);
            if (p) return p;
        }

        // Try global
        if (gpm) {
            return gpm.getPrompt(filePath);
        }

        return null;
    });

    // Partial Handlers
    ipcMain.handle('get-all-partials', () => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();
        const projectPartials = pm ? pm.getAllPartials() : [];
        const globalPartials = gpm ? gpm.getAllPartials() : [];
        // Merge and deduplicate by path
        const seen = new Set<string>();
        const merged = [...projectPartials];
        for (const p of projectPartials) seen.add(p.path);
        for (const p of globalPartials) {
            if (!seen.has(p.path)) {
                merged.push(p);
            }
        }
        return merged;
    });

    ipcMain.handle('search-partials', (_event, query: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();
        const projectResults = pm ? pm.searchPartials(query) : [];
        const globalResults = gpm ? gpm.searchPartials(query) : [];
        // Merge and deduplicate by path
        const seen = new Set<string>();
        const merged = [...projectResults];
        for (const p of projectResults) seen.add(p.path);
        for (const p of globalResults) {
            if (!seen.has(p.path)) {
                merged.push(p);
            }
        }
        return merged;
    });

    ipcMain.handle('save-partial', async (_event, dotPath: string, content: string, existingPath?: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        let targetPm = pm;

        if (existingPath) {
            if (pm && existingPath.startsWith(pm.getPartialsFolder())) {
                targetPm = pm;
            } else if (gpm && existingPath.startsWith(gpm.getPartialsFolder())) {
                targetPm = gpm;
            }
        } else {
            if (pm) {
                targetPm = pm;
            } else if (gpm) {
                targetPm = gpm;
            }
        }

        if (!targetPm) throw new Error('Prompts folder not set. Please select a folder first.');
        return await targetPm.savePartial(dotPath, content, existingPath);
    });

    ipcMain.handle('get-partial', (_event, dotPath: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        if (pm) {
            const p = pm.getPartial(dotPath);
            if (p) return p;
        }

        if (gpm) {
            return gpm.getPartial(dotPath);
        }
        return null;
    });

    ipcMain.handle('resolve-partials', (_event, content: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        // Strategy: Try resolving with project first. 
        // If content still has unresolved partials (checked how?), try global?
        // Actually, PromptManager.resolvePartials recursively resolves. 
        // We need a way to combine them.
        // For now, let's favor the active project manager if exists, otherwise global.
        // Ideally we should inject global partials into project manager context or try to resolve missing ones from global.
        // But PromptManager implementation is self-contained.

        // BETTER APPROACH: 
        // If PM exists, use it. But PM only knows its own partials.
        // If we want to support global partials in project prompts, we need to pass global partials to PM?
        // Or we use GPM if PM is null.

        // Current implementation of resolvePartials in PromptManager (not visible here but assumed) 
        // likely looks up partials in its own index.
        // If we want cross-referencing, that's a bigger change.
        // For now, let's stick to: Use PM if available (covers project), else GPM (covers global).
        // This means Project prompts can only use Project partials, and Global prompts -> Global partials.
        // This is safe V1 behavior.

        if (pm) return pm.resolvePartials(content);
        if (gpm) return gpm.resolvePartials(content);
        return content;
    });

    ipcMain.handle('get-partials-in-folder', (_event, dotPath: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();
        // Similar logic: prefer project, fallback to global
        if (pm) {
            const res = pm.getPartialsInFolder(dotPath);
            if (res.length > 0) return res;
        }
        if (gpm) return gpm.getPartialsInFolder(dotPath);
        return [];
    });

    ipcMain.handle('validate-partials', (_event, partialRefs: string[]) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        // This one returns missing partials.
        // If we have PM, it checks its own.
        // If we are in Global, GPM checks its own.
        // Same limitation as resolve-partials.
        if (pm) return pm.validatePartials(partialRefs);
        if (gpm) return gpm.validatePartials(partialRefs);
        return [];
    });

    ipcMain.handle('validate-partial-content', (_event, content: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();
        const target = pm || gpm;
        return target ? target.validatePartialContent(content) : { valid: false, error: 'No prompt manager initialized' };
    });

    ipcMain.handle('validate-partial-path', (_event, dotPath: string) => {
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();
        const target = pm || gpm;
        return target ? target.validatePartialPath(dotPath) : { valid: false, error: 'No prompt manager initialized' };
    });


    // Window Handlers
    ipcMain.handle('open-editor', (_event, prompt?: Prompt) => {
        windowManager.switchToEditor(prompt);
    });

    ipcMain.handle('open-partials-browser', () => {
        windowManager.switchToPartials();
    });

    ipcMain.handle('open-search-window', () => {
        windowManager.createMainWindow();
    });

    ipcMain.handle('close-window', (event) => {
        // In single window mode, "close" might mean "hide" or "close app".
        // For editor cancel, we might not want to close the window but go back.
        // But the AppController handles 'Esc' by switching views.
        // If the renderer calls 'close-window', it likely means "Close the App Window".
        windowManager.hideWindow();
    });

    ipcMain.handle('hide-window', (event) => {
        windowManager.hideWindow();
    });

    ipcMain.handle('close-and-open-search', (event) => {
        // Obsolete in single window, but for compatibility/safety:
        windowManager.createMainWindow();
    });

    ipcMain.handle('close-and-open-partials', (event) => {
        // Obsolete
        windowManager.switchToPartials();
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

    // Multi-Workspace Handlers
    ipcMain.handle('get-workspaces', () => {
        const globalPath = store.get('globalWorkspacePath') as string | undefined;
        const workspaces = store.get('workspaces', []) as any[];
        const activeId = store.get('activeWorkspaceId') as string | undefined;
        return { globalPath, workspaces, activeId };
    });

    ipcMain.handle('set-global-workspace', async (_event, globalPath: string) => {
        store.set('globalWorkspacePath', globalPath);

        // Reinitialize Global PromptManager
        const currentGpm = getGlobalPromptManager();
        if (currentGpm) currentGpm.destroy();

        const newGpm = new PromptManager(globalPath);
        setGlobalPromptManager(newGpm);

        return globalPath;
    });

    ipcMain.handle('add-project-workspace', async (_event, name: string, workspacePath: string) => {
        const workspaces = store.get('workspaces', []) as any[];
        const id = `ws_${Date.now()}`;
        const newWorkspace = {
            id,
            name,
            path: workspacePath,
            isGlobal: false,
            lastUsed: Date.now()
        };
        workspaces.push(newWorkspace);
        store.set('workspaces', workspaces);
        return newWorkspace;
    });

    ipcMain.handle('switch-project-workspace', async (_event, workspaceId: string | null) => {
        store.set('activeWorkspaceId', workspaceId);
        const workspaces = store.get('workspaces', []) as any[];

        // Destroy current project PromptManager
        const currentPm = getPromptManager();
        if (currentPm) currentPm.destroy();

        let activePath: string | undefined;
        if (workspaceId) {
            const ws = workspaces.find((w: any) => w.id === workspaceId);
            if (ws) {
                ws.lastUsed = Date.now();
                store.set('workspaces', workspaces);
                activePath = ws.path;

                // Create new project PromptManager
                const newPm = new PromptManager(ws.path);
                setPromptManager(newPm);
            }
        } else {
            // No project workspace - set to null so only global is used
            setPromptManager(null as any);
        }

        const globalPath = store.get('globalWorkspacePath') as string | undefined;
        return { activePath, globalPath };
    });

    ipcMain.handle('delete-project-workspace', async (_event, workspaceId: string) => {
        let workspaces = store.get('workspaces', []) as any[];
        workspaces = workspaces.filter((w: any) => w.id !== workspaceId);
        store.set('workspaces', workspaces);

        // If this was the active workspace, clear it
        if (store.get('activeWorkspaceId') === workspaceId) {
            store.set('activeWorkspaceId', null);
        }
        return true;
    });

    ipcMain.handle('update-workspace-settings', async (_event, workspaceId: string, settings: { name?: string }) => {
        const workspaces = store.get('workspaces', []) as any[];
        const ws = workspaces.find((w: any) => w.id === workspaceId);
        if (ws) {
            if (settings.name !== undefined) ws.name = settings.name;
            store.set('workspaces', workspaces);
        }
        return ws;
    });

    // Import/Export
    ipcMain.handle('export-prompt', async (_event, promptFilePath: string) => {
        const { generateExportString } = await import('./services/importExportService');
        const pm = getPromptManager();
        const gpm = getGlobalPromptManager();

        // Determine which PM owns this prompt
        let targetPm: PromptManager | null = null;
        if (pm && promptFilePath.startsWith(pm.getPromptsFolder())) {
            targetPm = pm;
        } else if (gpm && promptFilePath.startsWith(gpm.getPromptsFolder())) {
            targetPm = gpm;
        }

        if (!targetPm) throw new Error('Could not find workspace for this prompt');
        return await generateExportString(promptFilePath, targetPm);
    });

    ipcMain.handle('parse-import-string', async (_event, importString: string, workspaceId?: string) => {
        const { parseImportString, checkConflicts } = await import('./services/importExportService');
        const targetPm = resolveWorkspacePm(workspaceId);

        if (!targetPm) throw new Error('No workspace active. Please set up a workspace first.');

        const payload = parseImportString(importString);
        const conflicts = checkConflicts(payload, targetPm);
        return { payload, conflicts };
    });

    ipcMain.handle('execute-import', async (_event, payloadJson: string, overwriteIndices: number[], workspaceId?: string) => {
        const { parseImportString, executeImport } = await import('./services/importExportService');
        const targetPm = resolveWorkspacePm(workspaceId);

        if (!targetPm) throw new Error('No workspace active. Please set up a workspace first.');

        const payload = parseImportString(payloadJson);
        const result = executeImport(payload, targetPm, overwriteIndices);

        // Reload from disk so the watcher picks up new files
        targetPm.reloadFromDisk();

        return result;
    });
}
