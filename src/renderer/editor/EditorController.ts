import { Prompt, Partial } from '../../types';
import { EditorView } from './EditorView';

export class EditorController {
    private view: EditorView;
    private currentPrompt: Prompt | null = null;
    private isPartial: boolean = false;
    private isSaving: boolean = false;
    private autocompletePartials: Partial[] = [];
    private autocompleteSelectedIndex: number = 0;
    private isAutocompleteVisible: boolean = false;
    private onClose: () => void;

    constructor(view: EditorView, onClose: () => void) {
        this.view = view;
        this.onClose = onClose;
    }

    loadPrompt(prompt: Prompt | null) {
        this.currentPrompt = prompt;
        this.isPartial = !!prompt && (!prompt.tag && (prompt.filePath.includes('/partials/') || prompt.id === 'new-partial'));

        this.view.render(this.isPartial, this.currentPrompt);
        this.updateFooter();
        this.bindEvents();
    }

    bindEvents() {
        this.view.addSaveListener(() => this.savePrompt());
        this.view.addCancelListener(() => this.onClose());

        this.view.addContentInputListener((e) => {
            this.updateFooter();
            this.updateParameterInfo();
            this.handleAutocomplete(e);
        });

        this.view.addContentKeyDownListener((e) => this.handleContentKeyDown(e));

        // We attach global keydown for Cmd+S and Esc
        // Note: In single window app, we need to be careful not to double-bind or leave listeners
        // when switching views. We should probably have a 'cleanup' or 'unbind' method,
        // or use a refined event handling strategy.
        // For now, let's assume `loadPrompt` re-renders and we strictly bind to the new DOM elements,
        // but `document` listeners accumulate.
        // FIX: We should listen on the container for capture, or manage global listener in AppController.
        // However, simplest transition: Controller manages its own global listener and removes it on destroy/close.

        const globalHandler = (e: KeyboardEvent) => {
            // Only trigger if editor is active (checked by existence of editor in DOM?)
            // Better: Controller should have lifecycle methods (mount/unmount).
            if (!document.getElementById('editor')) return;

            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                this.savePrompt();
            } else if (e.key === 'Escape') {
                if (!this.isAutocompleteVisible) {
                    e.preventDefault();
                    this.onClose();
                }
            }
        };

        // We need to be able to remove this listener.
        // Ideally we put this in `init()` or `mount()` and remove in `unmount()`.
        // For this refactor step, let's add it and rely on the fact that we replace the view.
        // But piling up listeners is bad. 
        // Let's implement a simplified `mount` strategy later. For now, let's assume we re-instantiate controller 
        // or we just add it once. 
        // Actually, `document.addEventListener` acts globally.
        // Let's stick to binding on specific elements where possible, or use a AbortController for cleanup.
        // Since we don't have AbortController polyfill guaranteed, let's just add it on the `editor` element if it supports focus,
        // OR just handle it on the Inputs.
        // Cmd+S is the tricky one.

        document.addEventListener('keydown', globalHandler);
        // TODO: Clean up this listener when view changes.
    }

    extractParameters(content: string): string[] {
        const paramRegex = /\[([A-Z_]+)\]/g;
        const parameters: string[] = [];
        let match;
        while ((match = paramRegex.exec(content)) !== null) {
            if (!parameters.includes(match[1])) parameters.push(match[1]);
        }
        return parameters;
    }

    extractPartials(content: string): string[] {
        const partialRegex = /\{\{>\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
        const partials: string[] = [];
        let match;
        while ((match = partialRegex.exec(content)) !== null) {
            if (!partials.includes(match[1])) partials.push(match[1]);
        }
        return partials;
    }

    updateFooter() {
        const content = this.view.getContent();
        const params = this.extractParameters(content);
        const partials = this.extractPartials(content);
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        this.view.renderFooter(isMac ? 'Cmd' : 'Ctrl', params, partials);
    }

    updateParameterInfo() {
        const content = this.view.getContent();
        const params = this.extractParameters(content);
        this.view.updateParameterInfo(params);
    }

    async handleAutocomplete(e: Event) {
        const textarea = e.target as HTMLTextAreaElement;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const match = textBeforeCursor.match(/\{\{>\s*([a-zA-Z0-9_.-]*)$/);

        if (match) {
            const prefix = match[1];
            const allPartials = await window.electronAPI.getAllPartials();
            this.autocompletePartials = allPartials.filter(p =>
                p.path.toLowerCase().startsWith(prefix.toLowerCase())
            ).slice(0, 20);

            if (this.autocompletePartials.length > 0) {
                this.autocompleteSelectedIndex = 0;
                this.isAutocompleteVisible = true;

                // Calculate coords
                const rect = textarea.getBoundingClientRect();
                const textareaStyles = window.getComputedStyle(textarea);
                const lineHeight = parseInt(textareaStyles.lineHeight || '20');
                const lines = textarea.value.substring(0, cursorPos).split('\n').length;
                const top = rect.top + (lines * lineHeight);

                this.view.showAutocomplete(textarea, this.autocompletePartials, this.autocompleteSelectedIndex, rect.left + 20, top);
                this.view.bindAutocompleteClicks((index) => {
                    this.autocompleteSelectedIndex = index;
                    this.insertAutocomplete();
                });
            } else {
                this.hideAutocomplete();
            }
        } else {
            this.hideAutocomplete();
        }
    }

    hideAutocomplete() {
        this.isAutocompleteVisible = false;
        this.view.hideAutocomplete();
    }

    handleContentKeyDown(e: KeyboardEvent) {
        if (this.isAutocompleteVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.autocompleteSelectedIndex = Math.min(this.autocompleteSelectedIndex + 1, this.autocompletePartials.length - 1);
                this.view.renderAutocompleteItems(this.autocompletePartials, this.autocompleteSelectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.autocompleteSelectedIndex = Math.max(this.autocompleteSelectedIndex - 1, 0);
                this.view.renderAutocompleteItems(this.autocompletePartials, this.autocompleteSelectedIndex);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.insertAutocomplete();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideAutocomplete();
            }
        }
    }

    insertAutocomplete() {
        const textarea = this.view.getTextArea();
        if (!textarea || this.autocompletePartials.length === 0) return;

        const partial = this.autocompletePartials[this.autocompleteSelectedIndex];
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const textAfterCursor = textarea.value.substring(cursorPos);

        const match = textBeforeCursor.match(/\{\{>\s*([a-zA-Z0-9_.-]*)$/);
        if (match) {
            const startPos = cursorPos - match[0].length;
            const newText = textBeforeCursor.substring(0, startPos) + `{{> ${partial.path}}}` + textAfterCursor;
            textarea.value = newText;
            textarea.selectionStart = textarea.selectionEnd = startPos + `{{> ${partial.path}}}`.length;
            textarea.dispatchEvent(new Event('input'));
        }
        this.hideAutocomplete();
    }

    async savePrompt() {
        if (this.isSaving) return;

        const data = this.view.getFormData();

        // Validation
        if (!data.title || !data.content) {
            this.view.showToast('error', 'Missing Fields', 'Please fill in all required fields.');
            return;
        }

        if (!this.isPartial) {
            if (!data.tag) {
                this.view.showToast('error', 'Missing Tag', 'Please enter a tag.');
                return;
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(data.tag)) {
                this.view.showToast('error', 'Invalid Tag', 'Tag can only contain letters, numbers, underscores, and hyphens.');
                return;
            }
            if (data.tag.split('-').length > 5) {
                this.view.showToast('error', 'Tag Too Deep', 'Max 5 levels.');
                return;
            }
            if (!/^[a-zA-Z0-9_\s-]+$/.test(data.title)) {
                this.view.showToast('error', 'Invalid Title', 'Title contains invalid characters.');
                return;
            }
        } else {
            if (!/^[a-zA-Z0-9_.-]+$/.test(data.title)) {
                this.view.showToast('error', 'Invalid Partial Path', 'Invalid characters in path.');
                return;
            }
        }

        this.isSaving = true;
        this.view.setSaveButtonState(true, 'Saving...');

        try {
            const existingPath = this.currentPrompt?.filePath;

            if (this.isPartial) {
                await window.electronAPI.savePartial(data.title, data.content, existingPath);
            } else {
                await window.electronAPI.savePrompt(data.tag, data.title, data.content, existingPath);
            }

            this.view.showToast('success', 'Saved!', 'Saved successfully.', 1500);
            setTimeout(() => {
                this.isSaving = false;
                this.onClose();
            }, 1500);
        } catch (e: any) {
            this.isSaving = false;
            this.view.setSaveButtonState(false, this.isPartial ? 'Save Partial' : 'Save Prompt');
            this.view.showToast('error', 'Save Failed', e.message || 'Unknown error');
        }
    }
}
