
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
import { SearchHeader } from './components/SearchHeader';
import { PromptList } from './components/PromptList';
import { ParameterDialog } from './components/ParameterDialog';
import { DeleteDialog } from './components/DeleteDialog';

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

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleSearch = (e: any) => {
        const val = e.target.value;
        setQuery(val);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            loadPrompts(val);
        }, 300);
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
                        const pickerRegex = new RegExp(`\\{>\\s*${escapedPath}\\.\\*[^}]*\\}`, 'g');
                        content = content.replace(pickerRegex, partial.content);
                    }
                }
            }
        }

        // 3. Replace Parameters
        paramDialogPrompt.parameters.forEach(param => {
            const value = paramValues[param] || '';
            // Match {param}, { param }, {  param  } (case insensitive)
            const paramRegex = new RegExp(`\\{\\s*${param}\\s*\\}`, 'gi');
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
                        const pickerRegex = new RegExp(`\\{>\\s*${escapedPath}\\.\\*[^}]*\\}`, 'g');
                        content = content.replace(pickerRegex, partial.content);
                    }
                }
            }
        }

        // 3. Append params list for manual filling
        const lines: string[] = [];
        paramDialogPrompt.parameters.forEach(param => {
            lines.push(`{ ${param} }`);
        });

        if (lines.length > 0) {
            content += '\n\nFill in placeholders:\n' + lines.join('\n');
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
                // User requested to remove Ctrl+S for share in list
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prompts, selectedIndex, deleteDialogOpen, paramDialogOpen, onEditPrompt, onOpenPartials, handleExportPrompt]);

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--sapBackgroundColor)' }}>
            {/* Header / Drag Region */}
            <SearchHeader
                activeWorkspaceName={activeWorkspaceName}
                onOpenWorkspaceManager={() => setWorkspaceManagerOpen(true)}
                onThemeSelect={async (theme) => {
                    await window.electronAPI.setTheme(theme);
                }}
            />

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

            <PromptList
                prompts={prompts}
                selectedIndex={selectedIndex}
                hasFolder={hasFolder}
                onSelectPrompt={handleSelectPrompt}
                onSetSelectedIndex={setSelectedIndex}
                onExportPrompt={handleExportPrompt}
                onSelectFolder={handleSelectFolder}
                isMac={isMac}
                exporting={exporting}
            />




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
            <DeleteDialog
                open={deleteDialogOpen}
                prompt={promptToDelete}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={confirmDeletePrompt}
            />

            {/* Parameter Dialog */}
            <ParameterDialog
                open={paramDialogOpen}
                prompt={paramDialogPrompt}
                onClose={() => setParamDialogOpen(false)}
                onCopyRaw={handleCopyRaw}
                onCopyWithParams={handleCopyWithParams}
                paramValues={paramValues}
                setParamValues={setParamValues}
                pickerValues={pickerValues}
                setPickerValues={setPickerValues}
                pickerOptions={pickerOptions}
            />

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
