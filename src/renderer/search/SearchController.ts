import { Prompt, SearchResult } from '../../types';
import { SearchView } from './SearchView';

export class SearchController {
    private view: SearchView;
    private prompts: SearchResult[] = [];
    private selectedIndex: number = 0;
    private hasPromptsFolder: boolean = false;
    private currentTheme: string = 'light';

    constructor(view: SearchView) {
        this.view = view;
        this.init();
    }

    async init() {
        this.initTheme();
        await this.initializeFolder();

        // Bind global events handled by controller logic
        window.addEventListener('focus', () => this.handleWindowFocus());

        // Listen for reload requests
        window.electronAPI.onReloadPrompts(() => this.reloadPrompts());
    }

    async initTheme() {
        this.currentTheme = await window.electronAPI.getTheme();
        this.view.applyTheme(this.currentTheme);

        window.electronAPI.onThemeChanged((theme) => {
            this.currentTheme = theme;
            this.view.applyTheme(theme);
        });

        // Bind toggle button
        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    async toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.currentTheme = newTheme;
        await window.electronAPI.setTheme(newTheme);
        this.view.applyTheme(newTheme);
        this.view.focusSearchInput();
    }

    async initializeFolder() {
        const folder = await window.electronAPI.getPromptsFolder();
        this.hasPromptsFolder = !!folder;

        this.render(); // Initial render

        if (this.hasPromptsFolder) {
            await this.loadPrompts();
            this.view.updateFolderDisplay(folder);
        } else {
            this.view.renderNoFolderState();
            this.bindNoFolderEvents();
        }
    }

    bindNoFolderEvents() {
        const selectBtn = document.getElementById('select-folder-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', async () => {
                await this.handleChangeFolder();
            });
        }
    }

    render() {
        if (this.hasPromptsFolder) {
            this.view.renderMainLayout(this.isMac() ? 'Cmd' : 'Ctrl');
            this.view.renderResults(this.prompts, this.selectedIndex, this.isMac() ? 'Cmd' : 'Ctrl');
            this.view.updateFolderDisplay(this.hasPromptsFolder ? 'Loading...' : undefined); // Will be updated by loadPrompts logic or initialize
            this.bindMainEvents();
        } else {
            this.view.renderNoFolderState();
            this.bindNoFolderEvents();
        }
    }

    bindMainEvents() {
        const searchInput = this.view.getSearchInput();
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = (e.target as HTMLInputElement).value;
                this.handleSearch(query);
            });

            searchInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
            searchInput.focus();
        }

        // Wire up buttons
        document.getElementById('change-folder-btn')?.addEventListener('click', () => this.handleChangeFolder());
        document.getElementById('create-workspace-btn')?.addEventListener('click', () => this.handleCreateWorkspace());
        document.getElementById('open-folder-btn')?.addEventListener('click', () => window.electronAPI.openFolderInFilesystem());

        // Result clicks delegated via View rendering, but we need to bind them.
        // Since View re-renders the list, we should probably re-bind or delegate to container.
        // For simplicity, let's re-bind in renderResults or let logic handle delegation.
        // The View renderResults replaces HTML, so we need to add listeners after render.
        this.addResultClickListeners();
    }

    addResultClickListeners() {
        const items = document.querySelectorAll('.result-item');
        items.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectedIndex = index;
                this.selectPrompt(this.prompts[index].prompt);
                this.updateSelection();
            });
        });
    }

    isMac(): boolean {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    }

    async loadPrompts(query: string = '') {
        if (query.trim() === '') {
            const allPrompts = await window.electronAPI.getAllPrompts();
            this.prompts = allPrompts.map(p => ({ prompt: p, score: 1 }));
        } else {
            this.prompts = await window.electronAPI.searchPrompts(query);
        }
        this.selectedIndex = 0;
        this.view.renderResults(this.prompts, this.selectedIndex, this.isMac() ? 'Cmd' : 'Ctrl');
        this.addResultClickListeners();
    }

    async reloadPrompts() {
        const input = this.view.getSearchInput();
        if (input) input.value = '';
        await this.loadPrompts('');
    }

    async handleSearch(query: string) {
        await this.loadPrompts(query);
    }

    async handleWindowFocus() {
        // Clear toasts
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) toastContainer.innerHTML = '';

        // Reload prompts
        await this.reloadPrompts();

        // Update folder display
        const folder = await window.electronAPI.getPromptsFolder();
        this.view.updateFolderDisplay(folder);

        this.view.focusSearchInput();
    }

    async handleChangeFolder() {
        const newFolder = await window.electronAPI.selectFolder();
        if (newFolder) {
            this.hasPromptsFolder = true;
            this.render(); // Re-render main layout
            await this.loadPrompts();
            this.view.updateFolderDisplay(newFolder);
        }
    }

    async handleCreateWorkspace() {
        try {
            const newFolder = await window.electronAPI.createWorkspace();
            if (newFolder) {
                this.hasPromptsFolder = true;
                this.render();
                await this.loadPrompts();
                this.view.updateFolderDisplay(newFolder);
                this.view.showToast('Workspace created successfully!', 2000);
            }
        } catch (e: any) {
            this.view.showToast(e.message || 'Failed to create workspace');
        }
    }

    handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.prompts.length - 1);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.prompts.length > 0) {
                this.selectPrompt(this.prompts[this.selectedIndex].prompt);
            }
        } else if (e.key === 'Escape') {
            window.electronAPI.hideWindow();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
            e.preventDefault();
            window.electronAPI.openEditor();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
            e.preventDefault();
            if (this.prompts.length > 0) {
                window.electronAPI.openEditor(this.prompts[this.selectedIndex].prompt);
            }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
            e.preventDefault();
            window.electronAPI.openPartialsBrowser();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
            e.preventDefault();
            if (this.prompts.length > 0) {
                this.view.showDeleteConfirmation(
                    this.prompts[this.selectedIndex].prompt,
                    async () => this.deletePrompt(this.prompts[this.selectedIndex].prompt),
                    () => this.view.focusSearchInput()
                );
            }
        }
    }

    updateSelection() {
        this.view.renderResults(this.prompts, this.selectedIndex, this.isMac() ? 'Cmd' : 'Ctrl');
        this.addResultClickListeners();
        this.view.scrollToSelected();
    }

    async selectPrompt(prompt: Prompt) {
        if (prompt.parameters.length > 0 || (prompt.partialPickers && prompt.partialPickers.length > 0)) {
            this.view.showParameterDialog(
                prompt,
                {
                    onCopy: (values) => this.handleCopy(prompt, values),
                    onCopyRaw: (values) => this.handleCopyRaw(prompt, values),
                    onCancel: () => this.view.focusSearchInput(),
                    loadOptionsForPicker: (path) => window.electronAPI.getPartialsInFolder(path)
                }
            );
        } else {
            const resolved = await window.electronAPI.resolvePartials(prompt.content);
            await window.electronAPI.copyToClipboard(resolved);
            window.electronAPI.hideWindow();
        }
    }

    async handleCopy(prompt: Prompt, values: { params: Record<string, string>, pickers: Record<string, string> }) {
        // 1. Resolve static partials
        let content = await window.electronAPI.resolvePartials(prompt.content);

        // 2. Resolve dynamic pickers
        if (prompt.partialPickers) {
            for (const picker of prompt.partialPickers) {
                const selectedPath = values.pickers[picker.path];
                if (selectedPath) {
                    const partial = await window.electronAPI.getPartial(selectedPath);
                    if (partial) {
                        const escapedPath = picker.path.replace(/\./g, '\\.');
                        const pickerRegex = new RegExp(`\\{\\{>\\s*${escapedPath}\\.\\*[^}]*\\}\\}`, 'g');
                        content = content.replace(pickerRegex, partial.content);
                    }
                }
            }
        }

        // 3. Replace Parameters
        prompt.parameters.forEach(param => {
            const value = values.params[param] || '';
            const paramRegex = new RegExp(`\\[${param}\\]`, 'g');
            content = content.replace(paramRegex, value);
        });

        await window.electronAPI.copyToClipboard(content);
        window.electronAPI.hideWindow();
    }

    async handleCopyRaw(prompt: Prompt, values: { params: Record<string, string>, pickers: Record<string, string> }) {
        // 1. Resolve static partials
        let content = await window.electronAPI.resolvePartials(prompt.content);

        // 2. Resolve dynamic pickers
        if (prompt.partialPickers) {
            for (const picker of prompt.partialPickers) {
                const selectedPath = values.pickers[picker.path];
                if (selectedPath) {
                    const partial = await window.electronAPI.getPartial(selectedPath);
                    if (partial) {
                        const escapedPath = picker.path.replace(/\./g, '\\.');
                        const pickerRegex = new RegExp(`\\{\\{>\\s*${escapedPath}\\.\\*[^}]*\\}\\}`, 'g');
                        content = content.replace(pickerRegex, partial.content);
                    }
                }
            }
        }

        // 3. Append params
        const lines: string[] = [];
        prompt.parameters.forEach(param => {
            const value = values.params[param] || '';
            lines.push(`[${param}] = ${value}`);
        });

        if (lines.length > 0) {
            content += '\n\nReplace the following parameters in the prompt above:\n' + lines.join('\n');
        }

        await window.electronAPI.copyToClipboard(content);
        window.electronAPI.hideWindow();
    }

    async deletePrompt(prompt: Prompt) {
        try {
            await window.electronAPI.deletePrompt(prompt.filePath);
            this.view.showToast(`Deleted: ${prompt.title}`, 3000);
            await this.loadPrompts(); // Reload
            this.view.focusSearchInput();
        } catch (e: any) {
            this.view.showToast(e.message || 'Failed to delete prompt');
        }
    }
}
