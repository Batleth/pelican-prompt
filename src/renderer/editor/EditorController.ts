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
    private isPathAutocomplete: boolean = false;
    private pathAutocompleteSuggestions: string[] = [];
    private onClose: () => void;
    private globalKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

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

        this.view.addTitleInputListener((e) => this.handlePathAutocomplete(e));
        this.view.addTitleKeyDownListener((e) => this.handlePathKeyDown(e));

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

        this.globalKeyDownHandler = globalHandler;
        document.addEventListener('keydown', this.globalKeyDownHandler);
    }

    destroy() {
        if (this.globalKeyDownHandler) {
            document.removeEventListener('keydown', this.globalKeyDownHandler);
            this.globalKeyDownHandler = null;
        }
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

    async handlePathAutocomplete(e: Event) {
        const input = e.target as HTMLInputElement;
        const value = input.value;

        if (!value) {
            this.hideAutocomplete();
            return;
        }

        const lastDotIndex = value.lastIndexOf('.');
        const prefix = lastDotIndex !== -1 ? value.substring(0, lastDotIndex + 1) : '';

        let suggestions: string[] = [];

        const options = new Set<string>();

        if (this.isPartial) {
            const allPartials = await window.electronAPI.getAllPartials();
            allPartials.forEach(p => {
                if (p.path.toLowerCase().startsWith(prefix.toLowerCase())) {
                    const suffix = p.path.substring(prefix.length);
                    const parts = suffix.split('.');
                    if (parts.length > 0 && parts[0]) {
                        options.add(prefix + parts[0]);
                    }
                }
            });
        } else {
            const allPrompts = await window.electronAPI.getAllPrompts();
            allPrompts.forEach(p => {
                if (p.tag) {
                    const dotTag = p.tag.replace(/-/g, '.');
                    if (dotTag.toLowerCase().startsWith(prefix.toLowerCase())) {
                        const suffix = dotTag.substring(prefix.length);
                        const parts = suffix.split('.');
                        if (parts.length > 0 && parts[0]) {
                            options.add(prefix + parts[0]);
                        }
                    }
                }
            });
        }

        suggestions = Array.from(options)
            .filter(r => r.toLowerCase().startsWith(value.toLowerCase()))
            .sort();

        if (suggestions.length > 0) {
            this.pathAutocompleteSuggestions = suggestions;
            this.autocompleteSelectedIndex = 0;
            this.isAutocompleteVisible = true;
            this.isPathAutocomplete = true;
            this.view.showPathAutocomplete(input, suggestions, 0);

            this.view.bindAutocompleteClicks((index) => {
                this.autocompleteSelectedIndex = index;
                this.insertPathAutocomplete();
            });
        } else {
            this.hideAutocomplete();
        }
    }

    insertPathAutocomplete() {
        const input = document.getElementById('title-input') as HTMLInputElement;
        if (!input || !this.pathAutocompleteSuggestions.length) return;

        const suggestion = this.pathAutocompleteSuggestions[this.autocompleteSelectedIndex];
        input.value = suggestion + '.'; // Append dot for convenience?
        this.hideAutocomplete();
        input.focus();
    }

    hideAutocomplete() {
        this.isAutocompleteVisible = false;
        this.isPathAutocomplete = false;
        this.view.hideAutocomplete();
    }

    handlePathKeyDown(e: KeyboardEvent) {
        if (this.isAutocompleteVisible && this.isPathAutocomplete) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.autocompleteSelectedIndex = Math.min(this.autocompleteSelectedIndex + 1, this.pathAutocompleteSuggestions.length - 1);
                this.view.renderPathAutocompleteItems(this.pathAutocompleteSuggestions, this.autocompleteSelectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.autocompleteSelectedIndex = Math.max(this.autocompleteSelectedIndex - 1, 0);
                this.view.renderPathAutocompleteItems(this.pathAutocompleteSuggestions, this.autocompleteSelectedIndex);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.insertPathAutocomplete();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideAutocomplete();
            }
        }
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
        if (!data.path || !data.content) {
            this.view.showToast('error', 'Missing Fields', 'Please fill in all required fields.');
            return;
        }

        let tag = '';
        let title = '';

        if (!this.isPartial) {
            // Parse path into tag and title
            const lastDotIndex = data.path.lastIndexOf('.');
            if (lastDotIndex === -1) {
                this.view.showToast('error', 'Invalid Format', 'Prompt path must follow dot notation (e.g. category.name).');
                return;
            }

            const tagPart = data.path.substring(0, lastDotIndex);
            title = data.path.substring(lastDotIndex + 1);

            // Convert dot notation back to hyphens for storage
            tag = tagPart.replace(/\./g, '-');

            if (!tag) {
                this.view.showToast('error', 'Missing Tag', 'Please include a category (e.g. work.email).');
                return;
            }
            if (!title) {
                this.view.showToast('error', 'Missing Title', 'Please include a prompt name.');
                return;
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
                this.view.showToast('error', 'Invalid Characters', 'Tag can only contain letters, numbers, underscores, and hyphens (dots in input).');
                return;
            }
            if (tag.split('-').length > 5) {
                this.view.showToast('error', 'Tag Too Deep', 'Max 5 levels allowed.');
                return;
            }
            if (!/^[a-zA-Z0-9_\s-]+$/.test(title)) {
                this.view.showToast('error', 'Invalid Title', 'Title contains invalid characters.');
                return;
            }
        } else {
            // Partial: title is the full path
            title = data.path;
            if (!/^[a-zA-Z0-9_.-]+$/.test(title)) {
                this.view.showToast('error', 'Invalid Partial Path', 'Invalid characters in path.');
                return;
            }
            // Partials don't use tag
        }

        this.isSaving = true;
        this.view.setSaveButtonState(true, 'Saving...');

        try {
            const existingPath = this.currentPrompt?.filePath;

            if (this.isPartial) {
                await window.electronAPI.savePartial(title, data.content, existingPath);
            } else {
                await window.electronAPI.savePrompt(tag, title, data.content, existingPath);
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
