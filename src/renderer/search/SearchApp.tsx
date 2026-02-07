
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Prompt, SearchResult, Partial } from '../../types';
import {
    Input,
    List,
    ListItemStandard,
    Button,
    Title,
    Label,
    Toast,
    Dialog,
    Bar,
    FlexBox,
    Select,
    Option
} from '@ui5/webcomponents-react';

interface SearchAppProps {
    onEditPrompt: (prompt: Prompt) => void;
    onOpenPartials: () => void;
}

export const SearchApp: React.FC<SearchAppProps> = ({ onEditPrompt, onOpenPartials }) => {
    const [query, setQuery] = useState('');
    const [prompts, setPrompts] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [hasFolder, setHasFolder] = useState(false);
    const [folderPath, setFolderPath] = useState<string | undefined>(undefined);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);

    // Parameter dialog state
    const [paramDialogOpen, setParamDialogOpen] = useState(false);
    const [paramDialogPrompt, setParamDialogPrompt] = useState<Prompt | null>(null);
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [pickerValues, setPickerValues] = useState<Record<string, string>>({});
    const [pickerOptions, setPickerOptions] = useState<Record<string, Partial[]>>({});

    const toastRef = useRef<any>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? 'Cmd' : 'Ctrl';

    const loadPrompts = useCallback(async (q: string) => {
        let results;
        if (!q.trim()) {
            const all = await window.electronAPI.getAllPrompts();
            results = all.map(p => ({ prompt: p, score: 1 }));
        } else {
            results = await window.electronAPI.searchPrompts(q);
        }
        setPrompts(results);
        setSelectedIndex(0);
    }, []);

    const onWindowFocus = useCallback(async () => {
        const folder = await window.electronAPI.getPromptsFolder();
        setFolderPath(folder);
        await loadPrompts('');
        setQuery('');
        setTimeout(() => {
            const input = document.querySelector('ui5-input') as any;
            if (input) input.focus();
        }, 50);
    }, [loadPrompts]);

    useEffect(() => {
        const init = async () => {
            const folder = await window.electronAPI.getPromptsFolder();
            setHasFolder(!!folder);
            setFolderPath(folder);

            if (folder) {
                loadPrompts('');
            }
        };
        init();

        window.electronAPI.onReloadPrompts(async () => {
            await loadPrompts('');
        });

        window.addEventListener('focus', onWindowFocus);

        return () => {
            window.removeEventListener('focus', onWindowFocus);
        };
    }, [loadPrompts, onWindowFocus]);

    // Scroll to selected item using ref
    const selectedItemRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    const handleSearch = (e: any) => {
        const val = e.target.value;
        setQuery(val);
        loadPrompts(val);
    };

    const handleSelectPrompt = async (prompt: Prompt) => {
        if (prompt.parameters.length > 0 || (prompt.partialPickers && prompt.partialPickers.length > 0)) {
            // Show parameter dialog
            setParamDialogPrompt(prompt);
            setParamValues({});
            setPickerValues({});
            setPickerOptions({});
            setParamDialogOpen(true);

            // Load picker options
            if (prompt.partialPickers && prompt.partialPickers.length > 0) {
                for (const picker of prompt.partialPickers) {
                    try {
                        const options = await window.electronAPI.getPartialsInFolder(picker.path);
                        setPickerOptions(prev => ({ ...prev, [picker.path]: options }));
                        // Set default value
                        if (picker.defaultPath) {
                            setPickerValues(prev => ({ ...prev, [picker.path]: picker.defaultPath! }));
                        } else if (options.length > 0) {
                            setPickerValues(prev => ({ ...prev, [picker.path]: options[0].path }));
                        }
                    } catch (e) {
                        console.error('Failed to load picker options', e);
                    }
                }
            }
        } else {
            const resolved = await window.electronAPI.resolvePartials(prompt.content);
            await window.electronAPI.copyToClipboard(resolved);
            window.electronAPI.hideWindow();
        }
    };

    const handleCopyWithParams = async () => {
        if (!paramDialogPrompt) return;

        // 1. Resolve static partials
        let content = await window.electronAPI.resolvePartials(paramDialogPrompt.content);

        // 2. Resolve dynamic pickers
        if (paramDialogPrompt.partialPickers) {
            for (const picker of paramDialogPrompt.partialPickers) {
                const selectedPath = pickerValues[picker.path];
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
        paramDialogPrompt.parameters.forEach(param => {
            const value = paramValues[param] || '';
            const paramRegex = new RegExp(`\\[${param}\\]`, 'g');
            content = content.replace(paramRegex, value);
        });

        await window.electronAPI.copyToClipboard(content);
        setParamDialogOpen(false);
        window.electronAPI.hideWindow();
    };

    const handleCopyRaw = async () => {
        if (!paramDialogPrompt) return;

        // 1. Resolve static partials
        let content = await window.electronAPI.resolvePartials(paramDialogPrompt.content);

        // 2. Resolve dynamic pickers
        if (paramDialogPrompt.partialPickers) {
            for (const picker of paramDialogPrompt.partialPickers) {
                const selectedPath = pickerValues[picker.path];
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

        // 3. Append params instead of replacing
        const lines: string[] = [];
        paramDialogPrompt.parameters.forEach(param => {
            const value = paramValues[param] || '';
            lines.push(`[${param}] = ${value}`);
        });

        if (lines.length > 0) {
            content += '\n\nReplace the following parameters in the prompt above:\n' + lines.join('\n');
        }

        await window.electronAPI.copyToClipboard(content);
        setParamDialogOpen(false);
        window.electronAPI.hideWindow();
    };

    const confirmDeletePrompt = async () => {
        if (promptToDelete) {
            await window.electronAPI.deletePrompt(promptToDelete.filePath);
            loadPrompts(query);
            if (toastRef.current) {
                toastRef.current.show();
            }
            setDeleteDialogOpen(false);
            setPromptToDelete(null);
        }
    };

    const handleSelectFolder = async () => {
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
            setHasFolder(true);
            setFolderPath(folder);
            loadPrompts('');
        }
    };

    const handleCreateWorkspace = async () => {
        await window.electronAPI.createWorkspace();
        const f = await window.electronAPI.getPromptsFolder();
        setFolderPath(f);
        loadPrompts('');
    };

    // Global keyboard handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if we're in a modal
            if (deleteDialogOpen || paramDialogOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, prompts.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                if (prompts.length > 0) {
                    handleSelectPrompt(prompts[selectedIndex].prompt);
                }
            } else if (e.key === 'Escape') {
                window.electronAPI.hideWindow();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                window.electronAPI.openEditor();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                if (prompts.length > 0) {
                    onEditPrompt(prompts[selectedIndex].prompt);
                }
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
                e.preventDefault();
                onOpenPartials();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
                e.preventDefault();
                if (prompts.length > 0) {
                    setPromptToDelete(prompts[selectedIndex].prompt);
                    setDeleteDialogOpen(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prompts, selectedIndex, deleteDialogOpen, paramDialogOpen, onEditPrompt, onOpenPartials]);

    if (!hasFolder) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
                <Title>Welcome to Pelican Prompt</Title>
                <Label>Select a folder to store your prompts</Label>
                <Button onClick={handleSelectFolder}>Select Folder</Button>
            </div>
        );
    }

    const formatTag = (tag: string): string => {
        if (!tag) return '';
        return tag.split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' > ');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header with folder info */}
            <div style={{ padding: '1rem', marginBottom: '0', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Current Workspace: </span>
                        <span style={{ fontWeight: 500 }}>{folderPath ? folderPath.split(/[\\/]/).pop() : 'None'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <Button design="Transparent" onClick={() => window.electronAPI.openFolderInFilesystem()}>Open Folder</Button>
                        <Button design="Transparent" onClick={handleCreateWorkspace}>Create Workspace</Button>
                        <Button design="Transparent" onClick={handleSelectFolder}>Change Workspace</Button>
                    </div>
                </div>
                <Input
                    value={query}
                    onInput={handleSearch}
                    placeholder={`Search prompts... (e.g., 'tag:com-mail', 'tag:code*', or 'meeting')`}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Results list */}
            <div ref={listRef} style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '0 1rem' }}>
                {prompts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                        <h3>No prompts found</h3>
                        <p>Press {modKey}+N to create your first prompt</p>
                    </div>
                ) : (
                    <List selectionMode="Single">
                        {prompts.map((res, idx) => (
                            <ListItemStandard
                                key={res.prompt.filePath}
                                ref={idx === selectedIndex ? (el: any) => { selectedItemRef.current = el; } : undefined}
                                style={{
                                    background: idx === selectedIndex ? 'var(--sapList_SelectionBackgroundColor)' : 'transparent',
                                    borderLeft: idx === selectedIndex ? '3px solid var(--sapBrandColor)' : '3px solid transparent'
                                }}
                                description={res.prompt.content.substring(0, 100).replace(/\n/g, ' ') + '...'}
                                onClick={() => {
                                    setSelectedIndex(idx);
                                    handleSelectPrompt(res.prompt);
                                }}
                                selected={idx === selectedIndex}
                            >
                                <FlexBox alignItems="Center" style={{ gap: '8px' }}>
                                    {res.prompt.tag && (
                                        <span style={{
                                            background: 'var(--sapBrandColor)',
                                            color: 'white',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                            fontWeight: 500
                                        }}>
                                            {formatTag(res.prompt.tag)}
                                        </span>
                                    )}
                                    {res.prompt.parameters.length > 0 && (
                                        <span style={{
                                            background: '#FF9500',
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontSize: '10px'
                                        }}>
                                            {res.prompt.parameters.length}P
                                        </span>
                                    )}
                                    {res.prompt.partials.length > 0 && (
                                        <span style={{
                                            background: '#34C759',
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontSize: '10px'
                                        }}>
                                            {res.prompt.partials.length}P
                                        </span>
                                    )}
                                    <span style={{ fontWeight: 500 }}>{res.prompt.title}</span>
                                </FlexBox>
                            </ListItemStandard>
                        ))}
                    </List>
                )}
            </div>

            {/* Footer with keyboard hints */}
            <div className="footer">
                <span><kbd className="kbd">↑↓</kbd> Navigate</span>
                <span><kbd className="kbd">Enter</kbd> Select</span>
                <span><kbd className="kbd">{modKey}+N</kbd> New</span>
                <span><kbd className="kbd">{modKey}+E</kbd> Edit</span>
                <span><kbd className="kbd">{modKey}+R</kbd> Delete</span>
                <span><kbd className="kbd">{modKey}+P</kbd> Partials</span>
                <span><kbd className="kbd">Esc</kbd> Close</span>
            </div>

            {/* Delete confirmation dialog */}
            <Dialog
                open={deleteDialogOpen}
                headerText="Delete Prompt?"
                onClose={() => setDeleteDialogOpen(false)}
                footer={
                    <Bar
                        endContent={
                            <>
                                <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                                <Button design="Negative" onClick={confirmDeletePrompt}>Delete</Button>
                            </>
                        }
                    />
                }
            >
                <div style={{ padding: '1rem' }}>
                    <p>Are you sure you want to delete this prompt?</p>
                    {promptToDelete && (
                        <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginTop: '12px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--sapBrandColor)', fontSize: '12px', marginBottom: '4px' }}>
                                {promptToDelete.tag || 'No tag'}
                            </div>
                            <div style={{ fontWeight: 500, color: '#333', fontSize: '14px' }}>
                                {promptToDelete.title}
                            </div>
                        </div>
                    )}
                </div>
            </Dialog>

            {/* Parameter Dialog */}
            <Dialog
                open={paramDialogOpen}
                headerText="Configure Prompt"
                onClose={() => setParamDialogOpen(false)}
                footer={
                    <Bar
                        endContent={
                            <>
                                <Button onClick={() => setParamDialogOpen(false)}>Cancel</Button>
                                <Button design="Transparent" onClick={handleCopyRaw}>Copy with Placeholders</Button>
                                <Button design="Emphasized" onClick={handleCopyWithParams}>Copy</Button>
                            </>
                        }
                    />
                }
            >
                <div style={{ padding: '1rem', minWidth: '400px' }}>
                    {/* Partial Pickers */}
                    {paramDialogPrompt?.partialPickers && paramDialogPrompt.partialPickers.length > 0 && (
                        <>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Options
                            </div>
                            {paramDialogPrompt.partialPickers.map(picker => (
                                <div key={picker.path} style={{ marginBottom: '12px' }}>
                                    <Label>Select {picker.path}</Label>
                                    <Select
                                        style={{ width: '100%' }}
                                        onChange={(e: any) => {
                                            setPickerValues(prev => ({ ...prev, [picker.path]: e.detail.selectedOption.dataset.value }));
                                        }}
                                    >
                                        {(pickerOptions[picker.path] || []).map(opt => (
                                            <Option
                                                key={opt.path}
                                                data-value={opt.path}
                                                selected={pickerValues[picker.path] === opt.path}
                                            >
                                                {opt.path.split('.').pop() || opt.path}
                                            </Option>
                                        ))}
                                    </Select>
                                </div>
                            ))}
                            <div style={{ marginBottom: '16px' }} />
                        </>
                    )}

                    {/* Parameters */}
                    {paramDialogPrompt?.parameters && paramDialogPrompt.parameters.length > 0 && (
                        <>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Parameters
                            </div>
                            {paramDialogPrompt.parameters.map(param => (
                                <div key={param} style={{ marginBottom: '12px' }}>
                                    <Label>{param}</Label>
                                    <Input
                                        style={{ width: '100%' }}
                                        value={paramValues[param] || ''}
                                        onInput={(e: any) => {
                                            setParamValues(prev => ({ ...prev, [param]: e.target.value }));
                                        }}
                                        onKeyDown={(e: any) => {
                                            if (e.key === 'Enter') {
                                                handleCopyWithParams();
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </Dialog>

            <Toast ref={toastRef}>Prompt deleted</Toast>
        </div>
    );
};
