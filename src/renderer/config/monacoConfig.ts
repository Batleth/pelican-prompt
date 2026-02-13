
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
import 'monaco-editor/esm/vs/basic-languages/handlebars/handlebars.contribution';

/**
 * Configures the Monaco Editor loader and environment.
 * Should be called once at application startup or before using the Editor.
 */
export const configureMonaco = () => {
    // Configures the monaco-react wrapper to use our bundled monaco instance
    // instead of loading from CDN.
    try {
        loader.config({ monaco });
    } catch (e) {
        // Ignore error if already configured
        console.error('[Monaco] Failed to configure loader:', e);
    }

    // Configure Monaco Environment for Electron/Webpack
    (self as any).MonacoEnvironment = {
        getWorkerUrl: function (moduleId: any, label: string) {
            // Return a dummy worker to prevent 404 errors and build issues
            // We cannot use actual workers because bundles are too large for electron-forge default config
            // and manual copying is fragile.
            // Basic editing and custom autocomplete (main thread) will still work.
            return 'data:text/javascript;charset=utf-8,' + encodeURIComponent('self.onmessage = () => {};');
        }
    };
};
