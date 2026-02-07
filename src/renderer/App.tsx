
import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@ui5/webcomponents-react';
import { SearchApp } from './search/SearchApp';
import { EditorApp } from './editor/EditorApp';
import { PartialsApp } from './partials/PartialsApp';
import { Prompt } from '../types';

type View = 'SEARCH' | 'EDITOR' | 'PARTIALS';

export const App = () => {
    const [view, setView] = useState<View>('SEARCH');
    const [editorPrompt, setEditorPrompt] = useState<Prompt | null>(null);

    useEffect(() => {
        // Listeners for view switching
        const removeOpenEditor = window.electronAPI.onOpenEditor((prompt) => {
            setEditorPrompt(prompt);
            setView('EDITOR');
        });

        const removeOpenPartials = window.electronAPI.onOpenPartialsBrowser(() => {
            setView('PARTIALS');
        });

        return () => {
            // Cleanup listeners if your API supports it, otherwise this is fine for a top-level component
        };
    }, []);

    const handleNavigateToSearch = () => {
        setView('SEARCH');
        // Also notify main process if needed, but client-side nav is faster
        // If main process expects a signal (e.g. to resize window?), we might need to send one
        // But for now, we just switch view.
    };

    const handleNavigateToEditor = (prompt?: Prompt) => {
        setEditorPrompt(prompt || null);
        setView('EDITOR');
    };

    const handleNavigateToPartials = () => {
        setView('PARTIALS');
    };

    return (
        <ThemeProvider>
            <div className="app-container" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {view === 'SEARCH' && (
                    <SearchApp
                        onEditPrompt={handleNavigateToEditor}
                        onOpenPartials={handleNavigateToPartials}
                    />
                )}
                {view === 'EDITOR' && (
                    <EditorApp
                        prompt={editorPrompt}
                        onClose={handleNavigateToSearch}
                    />
                )}
                {view === 'PARTIALS' && (
                    <PartialsApp
                        onEditPartial={(partial) => {
                            // Convert partial to prompt-like structure for editor
                            // Set id to 'new-partial' when creating new partial so EditorApp knows it's a partial
                            const promptLike: Prompt = {
                                id: partial.filePath ? partial.filePath : 'new-partial',
                                title: partial.path,
                                content: partial.content,
                                filePath: partial.filePath,
                                tag: '',
                                parameters: [],
                                partials: [],
                                partialPickers: []
                            };
                            handleNavigateToEditor(promptLike);
                        }}
                        onClose={handleNavigateToSearch}
                    />
                )}
            </div>
        </ThemeProvider>
    );
};
