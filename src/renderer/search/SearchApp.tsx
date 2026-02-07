
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Prompt, SearchResult, Partial } from '../../types';
import {
    Input,
    List,
    ListItemCustom,
    ListItemStandard,
    Button,
    Title,
    Label,
    Toast,
    Dialog,
    Bar,
    FlexBox,
    Select,
    Option,
    Page,
    Icon,
    Text,
    ResponsivePopover,
    ObjectStatus
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/search.js';
import '@ui5/webcomponents-icons/dist/palette.js';
import '@ui5/webcomponents-icons/dist/decline.js';
import '@ui5/webcomponents-icons/dist/navigation-down-arrow.js';
import '@ui5/webcomponents-icons/dist/navigation-up-arrow.js';
import '@ui5/webcomponents-icons/dist/add.js';
import '@ui5/webcomponents-icons/dist/edit.js';
import '@ui5/webcomponents-icons/dist/delete.js';
import '@ui5/webcomponents-icons/dist/copy.js';
import '@ui5/webcomponents-icons/dist/inspection.js';
import '@ui5/webcomponents-icons/dist/cancel.js';
import '@ui5/webcomponents-icons/dist/open-folder.js';

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
    const themeBtnRef = useRef<any>(null);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

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
    const selectedItemRef = useRef<any | null>(null);

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

    const handleThemeSelect = async (e: any) => {
        const item = e.detail.item;
        // redundancy: check dataset, generic attribute, etc.
        const theme = item.getAttribute('data-theme') || item.dataset.theme;
        console.log('Selecting theme:', theme);
        if (theme) {
            await window.electronAPI.setTheme(theme);
            setThemeMenuOpen(false);
        }
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--sapBackgroundColor)' }}>
            {/* Header Content */}
            <Bar
                design="Header"
                style={{ WebkitAppRegion: 'drag' } as any}
                startContent={
                    <FlexBox alignItems="Center">
                        <Label style={{ marginRight: '5px' }}>Workspace:</Label>
                        <Text style={{ fontWeight: 500 }}>{folderPath ? folderPath.split(/[\\/]/).pop() : 'None'}</Text>
                    </FlexBox>
                }
                endContent={
                    <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as any}>
                        <Button design="Transparent" icon="open-folder" onClick={() => window.electronAPI.openFolderInFilesystem()} tooltip="Open Folder" />
                        <Button design="Transparent" icon="add" onClick={handleCreateWorkspace} tooltip="Create Workspace" />
                        <Button design="Transparent" icon="edit" onClick={handleSelectFolder} tooltip="Change Workspace" />
                        <div style={{ width: '1px', background: 'var(--ui5-v2-3-0-list-item-border-color)', margin: '0 4px' }}></div>
                        <Button ref={themeBtnRef} design="Transparent" icon="palette" onClick={() => setThemeMenuOpen(true)} tooltip="Select Theme" />
                        <Button design="Transparent" icon="decline" onClick={() => window.electronAPI.hideWindow()} tooltip="Close" style={{ color: 'var(--sapNegativeColor)' }} />
                    </div>
                }
            />
            <ResponsivePopover
                open={themeMenuOpen}
                opener={themeBtnRef.current}
                onClose={() => setThemeMenuOpen(false)}
            >
                <List onItemClick={handleThemeSelect} selectionMode="Single">
                    <ListItemStandard data-theme="sap_horizon">Morning Horizon (Light)</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_dark">Evening Horizon (Dark)</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_hcb">Horizon High Contrast Black</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_hcw">Horizon High Contrast White</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3">Quartz Light</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3_dark">Quartz Dark</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3_hcb">Quartz High Contrast Black</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3_hcw">Quartz High Contrast White</ListItemStandard>
                </List>
            </ResponsivePopover>
            <div style={{ padding: '0.5rem 1rem', flexShrink: 0 }}>
                <Input
                    icon={<Icon name="search" />}
                    value={query}
                    onInput={handleSearch}
                    placeholder="Search prompts..."
                    style={{ width: '100%' }}
                />
            </div>

            {/* Results list */}
            <div ref={listRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {prompts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Title level="H5" style={{ color: 'var(--sapContent_LabelColor)' }}>No prompts found</Title>
                        <Text style={{ color: 'var(--sapContent_LabelColor)' }}>Press {modKey}+N to create your first prompt</Text>
                    </div>
                ) : (
                    <List selectionMode="Single" style={{ height: '100%' }}>
                        {prompts.map((res, idx) => (
                            <ListItemCustom
                                ref={idx === selectedIndex ? selectedItemRef : undefined}
                                key={res.prompt.filePath}
                                selected={idx === selectedIndex}
                                onClick={() => {
                                    setSelectedIndex(idx);
                                    handleSelectPrompt(res.prompt);
                                }}
                                style={{
                                    borderLeft: idx === selectedIndex ? '3px solid var(--sapBrandColor)' : '3px solid transparent',
                                    paddingLeft: idx === selectedIndex ? '13px' : '16px' // Adjust padding to compensate for border
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0.5rem 0' }}>
                                    <FlexBox alignItems="Center" style={{ gap: '8px', marginBottom: '4px' }}>
                                        {res.prompt.tag && (
                                            <ObjectStatus state="Information" style={{ marginRight: '4px', fontWeight: 'bold' }}>
                                                {formatTag(res.prompt.tag)}
                                            </ObjectStatus>
                                        )}
                                        {res.prompt.parameters.length > 0 && (
                                            <ObjectStatus state="Critical" style={{ marginRight: '4px', fontWeight: 'bold' }}>
                                                {res.prompt.parameters.length}P
                                            </ObjectStatus>
                                        )}
                                        {res.prompt.partials.length > 0 && (
                                            <ObjectStatus state="Positive" style={{ marginRight: '4px', fontWeight: 'bold' }}>
                                                {res.prompt.partials.length}P
                                            </ObjectStatus>
                                        )}
                                        <Text style={{ fontWeight: 'bold', color: 'var(--sapTextColor)' }}>{res.prompt.title}</Text>
                                    </FlexBox>
                                    <Text style={{ fontSize: '12px', color: 'var(--sapContent_LabelColor)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {res.prompt.content.substring(0, 100).replace(/\n/g, ' ')}...
                                    </Text>
                                </div>
                            </ListItemCustom>
                        ))}
                    </List>
                )}
            </div>

            <Bar design="Footer">
                <div style={{ display: 'flex', gap: '1rem', color: 'var(--sapContent_LabelColor)', fontSize: '0.875rem' }}>
                    <span><kbd className="kbd">↑↓</kbd> Navigate</span>
                    <span><kbd className="kbd">Enter</kbd> Select</span>
                    <span><kbd className="kbd">{modKey}+N</kbd> New</span>
                    <span><kbd className="kbd">{modKey}+E</kbd> Edit</span>
                    <span><kbd className="kbd">{modKey}+R</kbd> Delete</span>
                    <span><kbd className="kbd">{modKey}+P</kbd> Partials</span>
                    <span><kbd className="kbd">Esc</kbd> Close</span>
                </div>
            </Bar>

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
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sapContent_LabelColor)', marginBottom: '8px', textTransform: 'uppercase' }}>
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
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sapContent_LabelColor)', marginBottom: '8px', textTransform: 'uppercase' }}>
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
