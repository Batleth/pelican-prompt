
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
import { TextArea } from '@ui5/webcomponents-react';
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
import '@ui5/webcomponents-icons/dist/group.js';
import '@ui5/webcomponents-icons/dist/download.js';
import '@ui5/webcomponents-icons/dist/share.js';
import { WorkspaceManager } from './WorkspaceManager';
import { ImportDialog } from '../components/ImportDialog';

interface SearchAppProps {
    onEditPrompt: (prompt: Prompt) => void;
    onOpenPartials: () => void;
}

export const SearchApp: React.FC<SearchAppProps> = ({ onEditPrompt, onOpenPartials }) => {
    const formatTag = (tag: string) => tag.split('/').pop() || tag;

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
    const [workspaceManagerOpen, setWorkspaceManagerOpen] = useState(false);
    const [activeWorkspaceName, setActiveWorkspaceName] = useState<string>('');
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // Export state
    const [exportString, setExportString] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const handleExportPrompt = useCallback(async (prompt: Prompt) => {
        if (!prompt.filePath || exporting) return;
        setExporting(true);
        try {
            const str = await window.electronAPI.exportPrompt(prompt.filePath);
            setExportString(str);
        } catch (err: any) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
        }
    }, [exporting]);

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

            // Load active workspace name
            try {
                const wsInfo = await window.electronAPI.getWorkspaces();
                if (wsInfo.activeId && wsInfo.workspaces) {
                    const activeWs = wsInfo.workspaces.find((w: any) => w.id === wsInfo.activeId);
                    setActiveWorkspaceName(activeWs ? activeWs.name : 'Global');
                } else {
                    setActiveWorkspaceName('Global');
                }
            } catch (e) {
                setActiveWorkspaceName('Global');
            }

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
            const paramRegex = new RegExp(`\\\\{${param}\\\\}`, 'gi');
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
            lines.push(`{${param}} = ${value}`);
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
            setDeleteDialogOpen(false);
            try {
                await window.electronAPI.deletePrompt(promptToDelete.filePath);
                loadPrompts(query);
            } catch (err) {
                console.error('Delete failed:', err);
            }
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
        const items = e.detail.selectedItems;
        if (!items || items.length === 0) return;
        const item = items[0];
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
            } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                // e.preventDefault();
                // if (prompts.length > 0) {
                //     handleExportPrompt(prompts[selectedIndex].prompt);
                // }
                // User requested to remove Ctrl+S for share in list
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prompts, selectedIndex, deleteDialogOpen, paramDialogOpen, onEditPrompt, onOpenPartials, handleExportPrompt]);
    // ...
    // ...
    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--sapBackgroundColor)' }}>
            {/* Header / Drag Region */}
            <div style={{
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1rem',
                borderBottom: '1px solid var(--sapList_BorderColor)',
                // @ts-ignore
                WebkitAppRegion: 'drag',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Title level="H5" style={{ margin: 0, color: 'var(--sapTextColor)' }}>PelicanPrompt</Title>
                    <span style={{ fontSize: '0.8rem', color: 'var(--sapTextColor)', marginLeft: '1rem' }}>Current Workspace:</span>
                    <div
                        onClick={() => setWorkspaceManagerOpen(true)}
                        style={{
                            color: 'var(--sapTextColor)',
                            fontSize: '0.8rem',
                            padding: '2px 2px'
                        }}
                    >
                        {activeWorkspaceName || 'Global'}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', WebkitAppRegion: 'no-drag' } as any}>
                    <Button
                        icon="group"
                        design="Transparent"
                        onClick={() => setWorkspaceManagerOpen(true)}
                        tooltip="Workspaces"
                    />
                    <Button
                        ref={themeBtnRef}
                        icon="palette"
                        design="Transparent"
                        onClick={() => setThemeMenuOpen(true)}
                        tooltip="Change Theme"
                    />
                </div>
            </div>

            {/* Search Bar & Actions */}
            <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Input
                    placeholder="Search prompts..."
                    value={query}
                    onInput={handleSearch}
                    icon={<Icon name="search" />}
                    style={{ flex: 1 }}
                />
                <Button
                    icon="add"
                    design="Emphasized"
                    onClick={() => window.electronAPI.openEditor()}
                    tooltip="New Prompt"
                />
                <Button
                    icon="open-folder"
                    design="Transparent"
                    onClick={handleSelectFolder}
                    tooltip="Open Folder"
                />
            </div>

            <ResponsivePopover
                open={themeMenuOpen}
                opener={themeBtnRef.current}
                onClose={() => setThemeMenuOpen(false)}
            >
                <List onSelectionChange={handleThemeSelect} selectionMode="Single">
                    <ListItemStandard data-theme="sap_horizon">Morning Horizon (Light)</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_dark">Evening Horizon (Dark)</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_hcb">High Contrast Black</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_hcw">High Contrast White</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3">Quartz Light</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3_dark">Quartz Dark</ListItemStandard>
                </List>
            </ResponsivePopover>


            <div ref={listRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {!hasFolder ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Title level="H5" style={{ color: 'var(--sapContent_LabelColor)' }}>No Folder Selected</Title>
                        <Button onClick={handleSelectFolder} style={{ marginTop: '1rem' }}>Open Folder</Button>
                    </div>
                ) : prompts.length === 0 ? (
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
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setSelectedIndex(idx);
                                    handleExportPrompt(res.prompt);
                                }}
                                style={{
                                    borderLeft: idx === selectedIndex ? '3px solid var(--sapBrandColor)' : '3px solid transparent',
                                    paddingLeft: idx === selectedIndex ? '13px' : '16px'
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
                                {idx === selectedIndex && (
                                    <Button
                                        design="Transparent"
                                        icon="share"
                                        tooltip="Export (share)"
                                        disabled={exporting}
                                        onClick={(e: any) => {
                                            e.stopPropagation();
                                            handleExportPrompt(res.prompt);
                                        }}
                                        style={{ flexShrink: 0 }}
                                    />
                                )}
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

            <WorkspaceManager
                open={workspaceManagerOpen}
                onClose={() => setWorkspaceManagerOpen(false)}
                onWorkspaceChanged={async () => {
                    loadPrompts(query);
                    const folder = await window.electronAPI.getPromptsFolder();
                    setFolderPath(folder);
                    setHasFolder(!!folder);

                    // Refresh workspace name
                    try {
                        const wsInfo = await window.electronAPI.getWorkspaces();
                        if (wsInfo.activeId && wsInfo.workspaces) {
                            const activeWs = wsInfo.workspaces.find((w: any) => w.id === wsInfo.activeId);
                            setActiveWorkspaceName(activeWs ? activeWs.name : 'Global');
                        } else {
                            setActiveWorkspaceName('Global');
                        }
                    } catch (e) {
                        setActiveWorkspaceName('Global');
                    }
                }}
            />
            <ImportDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                onImportComplete={() => loadPrompts(query)}
            />

            {/* Export String Dialog */}
            <Dialog
                open={!!exportString}
                onClose={() => setExportString(null)}
                headerText="Export String"
                style={{ width: '500px' }}
                footer={
                    <Bar endContent={
                        <FlexBox style={{ gap: '0.5rem' }}>
                            <Button design="Emphasized" onClick={async () => {
                                if (exportString) {
                                    await window.electronAPI.copyToClipboard(exportString);
                                    setExportString(null);
                                }
                            }}>Copy & Close</Button>
                            <Button design="Transparent" onClick={() => setExportString(null)}>Close</Button>
                        </FlexBox>
                    } />
                }
            >
                <FlexBox direction="Column" style={{ gap: '1rem', padding: '1rem' }}>
                    <Text>Share this string with others. They can import it into their Pelican Prompt to get this prompt and its partials.</Text>
                    <TextArea
                        value={exportString || ''}
                        readonly
                        rows={6}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        growing
                    />
                </FlexBox>
            </Dialog>
        </div >
    );
};
