
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
    const [previousView, setPreviousView] = useState<View>('SEARCH');

    useEffect(() => {
        // Listeners for view switching
        const removeOpenEditor = window.electronAPI.onOpenEditor((prompt) => {
            setEditorPrompt(prompt);
            setPreviousView('SEARCH'); // Default to search if opened via global shortcut
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
    };

    const handleNavigateToEditor = (prompt?: Prompt, from: View = 'SEARCH') => {
        setEditorPrompt(prompt || null);
        setPreviousView(from);
        setView('EDITOR');
    };

    const handleNavigateToPartials = () => {
        setView('PARTIALS');
    };

    const handleCloseEditor = () => {
        if (previousView === 'PARTIALS') {
            setView('PARTIALS');
        } else {
            setView('SEARCH');
        }
    };

    return (
        <ThemeProvider>
            <div className="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--sapBackgroundColor)' }}>
                {view === 'SEARCH' && (
                    <SearchApp
                        onEditPrompt={(p) => handleNavigateToEditor(p, 'SEARCH')}
                        onOpenPartials={handleNavigateToPartials}
                    />
                )}
                {view === 'EDITOR' && (
                    <EditorApp
                        prompt={editorPrompt}
                        onClose={handleCloseEditor}
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
                            handleNavigateToEditor(promptLike, 'PARTIALS');
                        }}
                        onClose={handleNavigateToSearch}
                    />
                )}
            </div>
        </ThemeProvider>
    );
};
