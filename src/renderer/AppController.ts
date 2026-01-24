import { SearchController } from './search/SearchController';
import { SearchView } from './search/SearchView';
import { EditorController } from './editor/EditorController';
import { EditorView } from './editor/EditorView';
import { PartialsController } from './partials/PartialsController';
import { PartialsView } from './partials/PartialsView';
import { Prompt, Partial } from '../types';

type ViewState = 'SEARCH' | 'EDITOR' | 'PARTIALS';

export class AppController {
    private currentView: ViewState = 'SEARCH';
    private searchController: SearchController | null = null;
    private editorController: EditorController | null = null;
    private partialsController: PartialsController | null = null;

    constructor() {
        this.init();
    }

    init() {
        // Start with Search View
        this.switchToSearch();

        // Listen to IPC events for view switching
        window.electronAPI.onOpenEditor((prompt) => {
            this.switchToEditor(prompt);
        });

        window.electronAPI.onOpenPartialsBrowser(() => {
            this.switchToPartials();
        });

        // Listen for Close Window requests (from main process or shortcuts)
        // ipcRenderer 'hide-window' is called from controllers.

        this.initTheme();
    }

    async initTheme() {
        // Initial load
        const theme = await window.electronAPI.getTheme();
        this.applyTheme(theme);

        // Listener
        window.electronAPI.onThemeChanged((theme) => {
            this.applyTheme(theme);
        });
    }

    applyTheme(theme: string) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    }

    switchToSearch() {
        this.currentView = 'SEARCH';
        this.cleanupControllers();

        const view = new SearchView();
        // We need to modify SearchController to accept callbacks for navigation if we want it to trigger editor
        // But currently SearchController calls `window.electronAPI.openEditor`.
        // We need to intercept that or update `electronAPI` to talk to AppController?
        // NO, `electronAPI` talks to Main. Main talks back to Renderer via IPC.
        // So if SearchController calls `openEditor`, Main receives it, and sends `open-editor` event back to Renderer.
        // This `AppController` listens to that event! So the loop is closed.

        this.searchController = new SearchController(view);
    }

    switchToEditor(prompt: Prompt | null) {
        this.currentView = 'EDITOR';
        this.cleanupControllers();

        const view = new EditorView();
        // Editor needs to know how to close (return to previous view)
        this.editorController = new EditorController(view, () => {
            // On close, go back to search or partials?
            // Usually back to search.
            this.switchToSearch();
        });

        this.editorController.loadPrompt(prompt);
    }

    switchToPartials() {
        this.currentView = 'PARTIALS';
        this.cleanupControllers();

        const view = new PartialsView();
        this.partialsController = new PartialsController(view, (partial) => {
            // On edit partial
            if (partial) {
                // Convert partial to prompt structure or handle as partial object
                // The Editor expects a Prompt object but uses it flexibly
                // We need to conform to the interface
                const promptLike: Prompt = {
                    id: partial.filePath,
                    title: partial.path,
                    content: partial.content,
                    filePath: partial.filePath,
                    tag: '',
                    parameters: [],
                    partials: [],
                    partialPickers: []
                };
                this.switchToEditor(promptLike);
            } else {
                // New Partial
                const newPartial: Prompt = {
                    id: 'new-partial',
                    title: '',
                    content: '',
                    filePath: '',
                    tag: '',
                    parameters: [],
                    partials: [],
                    partialPickers: []
                };
                this.switchToEditor(newPartial);
            }
        }, () => {
            // On close
            this.switchToSearch();
        });

        this.partialsController.load();
    }

    cleanupControllers() {
        // Ideally call destroy() on controllers to remove listeners
        // For now we rely on garbage collection and overwriting #app
        this.searchController = null;
        this.editorController = null;
        this.partialsController = null;

        // Clear DOM
        const app = document.getElementById('app');
        if (app) app.innerHTML = '';
    }
}
