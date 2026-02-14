
import { loader, Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Partial } from '../../types';
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

let completionProviderDisposables: monaco.IDisposable[] = [];

/**
 * Registers completion providers for partials and parameters.
 * Should be called once, or when the data sources (getters) change (though getters usually stay stable).
 * 
 * @param getPartials Function to retrieve current partials
 * @param getParameters Function to retrieve current unique parameters
 */
export const registerCompletionProviders = (
    getPartials: () => Partial[],
    getParameters: () => string[]
) => {
    // Dispose previous providers to avoid duplicates
    completionProviderDisposables.forEach(d => d.dispose());
    completionProviderDisposables = [];

    // 1. Partial Provider (Trigger: >)
    // Matches {> ...
    // Note: We trigger on '>' but we need to check if it's preceded by '{'
    const partialProvider = monaco.languages.registerCompletionItemProvider('markdown', {
        triggerCharacters: ['>'],
        provideCompletionItems: (model, position) => {
            try {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                // Check if we are inside a partial tag {> ...
                // Triggers when user types '>' after '{' or is just typing inside
                const match = textUntilPosition.match(/\{>\s*([^}]*)$/);
                if (!match) {
                    return { suggestions: [] };
                }

                const partials = getPartials() || [];
                const suggestions = partials.map(p => ({
                    label: p.path,
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: p.path, // Do not close the tag, user or auto-close handles it
                    documentation: p.content ? p.content.substring(0, 100) : '', // Preview content
                    detail: 'Partial',
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    }
                }));

                return { suggestions };
            } catch (e) {
                console.error('Error in partial completion provider:', e);
                return { suggestions: [] };
            }
        }
    });
    completionProviderDisposables.push(partialProvider);

    // 2. Parameter Provider (Trigger: {)
    // Matches { ... (but not {{)
    const paramProvider = monaco.languages.registerCompletionItemProvider('markdown', {
        triggerCharacters: ['{'],
        provideCompletionItems: (model, position) => {
            try {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                // Check if we are starting a parameter {NAME}
                // We want to match '{' but NOT '{{'
                // MATCH both {param and { param (optional space)

                const lineContent = model.getLineContent(position.lineNumber);
                const col = position.column;
                const lastChar = textUntilPosition.slice(-1);
                const secondLastChar = textUntilPosition.slice(-2, -1);

                if (lastChar !== '{' && lastChar !== ' ') {
                    // Triggered by something else or manual invoke?
                    // Check regex for {Prefix or { Prefix
                    const match = textUntilPosition.match(/([^{]|^)\{\s*([a-zA-Z0-9_]*)$/);
                    if (!match) return { suggestions: [] };
                } else {
                    // Just typed { or space
                    if (lastChar === '{' && secondLastChar === '{') {
                        return { suggestions: [] };
                    }
                    if (lastChar === ' ') {
                        // Check if we have { before space
                        const match = textUntilPosition.match(/([^{]|^)\{\s*$/);
                        if (!match) {
                            // Maybe we are typing inside { param
                            const matchInside = textUntilPosition.match(/([^{]|^)\{\s*([a-zA-Z0-9_]+)\s*$/);
                            if (!matchInside) return { suggestions: [] };
                        }
                    }
                }

                const params = getParameters() || [];
                const suggestions = params.map(param => ({
                    label: param,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: param, // Do not close the brace
                    detail: 'Parameter',
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    }
                }));

                return { suggestions };
            } catch (e) {
                console.error('Error in param completion provider:', e);
                return { suggestions: [] };
            }
        }
    });
    completionProviderDisposables.push(paramProvider);

    // 3. Quick Insert Snippets (Trigger: Explicit invoke or Ctrl+Space)
    const snippetProvider = monaco.languages.registerCompletionItemProvider('markdown', {
        provideCompletionItems: (model, position, context) => {
            // Only show snippets on explicit invoke (Ctrl+Space) or if manually triggered
            // usage of TriggerKind requires us to check the enum
            // Invoke = 0, TriggerCharacter = 1, TriggerForIncompleteCompletions = 2

            if (context.triggerKind !== monaco.languages.CompletionTriggerKind.Invoke) {
                return { suggestions: [] };
            }

            const suggestions = [
                {
                    label: 'Quick Partial',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    documentation: "Insert partial syntax: {> partial }",
                    insertText: '{>${1:partial}}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    }
                },
                {
                    label: 'Quick Picker',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    documentation: "Insert partial picker: {> path.* }",
                    insertText: '{>${1:path}.*}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    }
                },
                {
                    label: 'Quick Param',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    documentation: "Insert parameter syntax: { param }",
                    insertText: '{${1:param}}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    }
                }
            ];
            return { suggestions };
        }
    });
    completionProviderDisposables.push(snippetProvider);
};
