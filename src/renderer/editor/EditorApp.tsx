
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Prompt, Partial } from '../../types';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import {
    Input,
    Button,
    Title,
    Label,
    FlexBox,
    FlexBoxAlignItems,
    Dialog,
    Bar,
    MessageStrip,
    Text
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/nav-back.js';
import '@ui5/webcomponents-icons/dist/save.js';
import '@ui5/webcomponents-icons/dist/decline.js';
import '@ui5/webcomponents-icons/dist/decline.js';
import '@ui5/webcomponents-icons/dist/share.js';
import '@ui5/webcomponents-icons/dist/action-settings.js';
import { List, ResponsivePopover, ListItemCustom } from '@ui5/webcomponents-react';

// Configure Monaco Environment for Electron/Webpack
// This ensures that the editor can load its worker scripts correctly


// Configure Monaco Environment for Electron/Webpack
// This ensures that the editor can load its worker scripts correctly
// Configure Monaco Environment for Electron/Webpack
// This ensures that the editor can load its worker scripts correctly
import { configureMonaco, registerCompletionProviders } from '../config/monacoConfig';
import { parsePathForPrompt } from '../utils/pathUtils';
import { mapUi5ThemeToMonaco } from '../utils/themeUtils';

// Initialize Monaco configuration
configureMonaco();

interface EditorAppProps {
    prompt: Prompt | null;
    onClose: () => void;
}

export const EditorApp: React.FC<EditorAppProps> = ({ prompt, onClose }) => {
    const [path, setPath] = useState('');
    const [content, setContent] = useState(prompt?.content || '');
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeWorkspaceName, setActiveWorkspaceName] = useState<string>('Global');

    // Export state
    const [exportString, setExportString] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const partialsRef = useRef<Partial[]>([]);
    const parametersRef = useRef<string[]>([]);

    const isPartial = !prompt?.tag && (prompt?.id === 'new-partial' || prompt?.filePath?.includes('partials'));
    const isNew = !prompt?.filePath || prompt?.id === 'new-partial';
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? 'Cmd' : 'Ctrl';

    useEffect(() => {
        if (prompt) {
            // ... (existing logic)
            // ...
            // ...
            // Inside Input
            if (isPartial) {
                setPath(prompt.title || '');
            } else {
                const tagPart = prompt.tag ? prompt.tag.replace(/-/g, '.') : '';
                const titlePart = prompt.title || '';
                if (tagPart && titlePart) {
                    setPath(`${tagPart}.${titlePart}`);
                } else if (titlePart) {
                    setPath(titlePart);
                } else {
                    setPath(tagPart);
                }
            }
            setContent(prompt.content || '');
        } else {
            setPath('');
            setContent('');
        }
    }, [prompt, isPartial]);

    // Load active workspace info
    useEffect(() => {
        const loadWorkspaceInfo = async () => {
            try {
                const wsInfo = await window.electronAPI.getWorkspaces();
                if (wsInfo.activeId && wsInfo.workspaces) {
                    const activeWs = wsInfo.workspaces.find((w: any) => w.id === wsInfo.activeId);
                    if (activeWs) {
                        setActiveWorkspaceName(activeWs.name);
                    } else {
                        setActiveWorkspaceName('Global');
                    }
                } else {
                    setActiveWorkspaceName('Global');
                }
            } catch (e) {
                console.error('Failed to load workspace info:', e);
                setActiveWorkspaceName('Global');
            }
        };
        loadWorkspaceInfo();
    }, []);

    // Load partials for autocomplete
    useEffect(() => {
        const loadPartials = async () => {
            try {
                const allPartials = await window.electronAPI.getAllPartials();
                partialsRef.current = allPartials;
            } catch (e) {
                console.error('Failed to load partials for autocomplete:', e);
            }
        };
        loadPartials();
    }, []);

    // Load parameters for autocomplete
    useEffect(() => {
        const loadParams = async () => {
            try {
                const allParams = await window.electronAPI.getUniqueParameters();
                parametersRef.current = allParams;
            } catch (e) {
                console.error('Failed to load parameters:', e);
            }
        };
        loadParams();
    }, []);

    // Update completion providers when data changes (or at least once on mount/data load)
    // Since refs are mutable and pure functions, we can register once or on mount.
    // Ideally we register when the editor mounts, or when data arrives.
    // The current implementation of registerCompletionProviders accepts getters, 
    // so we only need to call it once if we pass the refs.
    useEffect(() => {
        // Register providers with getters that read from current refs
        registerCompletionProviders(
            () => partialsRef.current,
            () => parametersRef.current
        );
    }, []); // Run once on mount (or could depend on nothing if config is global singleton)



    const handleSave = async () => {
        setErrorMessage(null);

        // Validate first
        if (!path) {
            setErrorMessage("Path is required");
            return;
        }

        // Get content from editor if available, otherwise use state
        const currentContent = editorRef.current ? editorRef.current.getValue() : content;

        if (!currentContent) {
            setErrorMessage("Content is required");
            return;
        }

        let tag = '';
        let title = '';

        if (!isPartial) {
            const parsed = parsePathForPrompt(path);
            tag = parsed.tag;
            title = parsed.title;
            if (!title) {
                setErrorMessage("Path must include a title (e.g., 'work.email.draft')");
                return;
            }
        }

        setSaving(true);
        try {
            if (isPartial) {
                await window.electronAPI.savePartial(path, currentContent, prompt?.filePath || undefined);
            } else {
                await window.electronAPI.savePrompt(tag, title, currentContent, prompt?.filePath || undefined);
            }

            onClose();
        } catch (e: any) {
            console.error('Save error:', e);
            let msg = e.message || 'Save failed';
            if (msg.includes('already exists')) {
                msg = 'A prompt with this path already exists. Please use a different path.';
            }
            setErrorMessage(msg);
            setSaving(false);
        }
    };

    // Keep handleSaveRef up to date for keybindings
    const handleSaveRef = useRef(handleSave);
    useEffect(() => {
        handleSaveRef.current = handleSave;
    }, [handleSave]);

    // Global save shortcut (for when focus is outside Monaco, e.g. in Input)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
                // If focus is in Monaco, the Monaco command handling might trigger too.
                // However, Monaco usually stops propagation if it handles it.
                e.preventDefault();
                handleSaveRef.current();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;


        // Register custom completion provider for partials
        // MOVED TO monacoConfig.ts - Global registration
        // monaco.languages.registerCompletionItemProvider...

        // Add keybindings
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            handleSaveRef.current();
        });

        editor.addCommand(monaco.KeyCode.Escape, () => {
            onClose();
        });

        // Focus editor
        editor.focus();

        // Register Quick Insert Command (Ctrl+Enter / Cmd+Enter)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            // Validate if prompt is not empty to avoid overwriting? No, just trigger suggest.
            editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
        });
    };

    const pathHint = isPartial
        ? 'Dot notation path (e.g., tones.urgent)'
        : 'Dot notation path (e.g., work.email.draft) - last part becomes title, rest becomes tag';

    // Determine theme (simplified logic, assuming dark preferred or system match)
    // Providing requested mapping: 
    // Light -> vs
    // Dark -> vs-dark
    // High Contrast -> hc-black
    // Ideally we would detect this from @ui5/webcomponents-react context or event, 
    // for now defaulting to vs-dark as it is good for code, or we could check system preference.


    const [editorTheme, setEditorTheme] = useState('vs-dark');

    useEffect(() => {
        const initTheme = async () => {
            const currentTheme = await window.electronAPI.getTheme();
            setEditorTheme(mapUi5ThemeToMonaco(currentTheme));
        };
        initTheme();

        window.electronAPI.onThemeChanged((newTheme) => {
            setEditorTheme(mapUi5ThemeToMonaco(newTheme));
        });
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--sapBackgroundColor)' }}>
            {/* Header */}
            <Bar
                design="Header"
                style={{ WebkitAppRegion: 'drag', flexShrink: 0 } as any}
                startContent={
                    <Title level="H3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        {isPartial ? (isNew ? 'New Partial' : 'Edit Partial') : (isNew ? 'New Prompt' : 'Edit Prompt')}
                    </Title>
                }
                endContent={
                    <FlexBox alignItems={FlexBoxAlignItems.Center} style={{ WebkitAppRegion: 'no-drag', gap: '0.75rem' } as any}>
                        <Text style={{ fontSize: '0.8rem', color: 'var(--sapNeutralTextColor)' }}>
                            Saving to: <span style={{ fontWeight: 600 }}>{activeWorkspaceName}</span>
                        </Text>
                        {!isNew && !isPartial && (
                            <Button design="Transparent" icon="share" onClick={async () => {
                                if (!prompt?.filePath) return;
                                setExporting(true);
                                try {
                                    const str = await window.electronAPI.exportPrompt(prompt.filePath);
                                    setExportString(str);
                                } catch (err: any) {
                                    setErrorMessage(err.message || 'Export failed');
                                } finally {
                                    setExporting(false);
                                }
                            }} disabled={exporting} tooltip="Export (share)" />
                        )}
                        <Button design="Transparent" icon="save" onClick={handleSave} disabled={saving} tooltip="Save" />
                        <Button design="Transparent" icon="decline" onClick={onClose} tooltip="Cancel" style={{ color: 'var(--sapNegativeColor)' }} />
                    </FlexBox>
                }
            />

            {/* Content Wrapper */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Error message */}
                {errorMessage && (
                    <MessageStrip
                        design="Negative"
                        onClose={() => setErrorMessage(null)}
                        style={{ margin: '1rem', flexShrink: 0 }}
                    >
                        {errorMessage}
                    </MessageStrip>
                )}

                {/* Path field */}
                <div style={{ padding: '1rem', paddingBottom: '0.5rem', flexShrink: 0 }}>
                    <Label>{isPartial ? 'Partial Path' : 'Prompt Path'}</Label>
                    <Input
                        value={path}
                        onInput={(e: any) => {
                            setPath(e.target.value);
                            setErrorMessage(null); // Clear error when user types
                        }}
                        placeholder={isPartial ? 'e.g., tones.urgent' : 'e.g., work.email.draft'}
                        readonly={!isNew && !!prompt?.filePath}
                        style={{ width: '100%' }}
                        valueState={errorMessage && !path ? 'Negative' : 'None'}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--sapContent_LabelColor)', marginTop: '4px' }}>
                        {pathHint}
                    </div>
                </div>

                {/* Monaco Editor */}
                <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <Editor
                        height="100%"
                        defaultLanguage="markdown"
                        theme={editorTheme}
                        value={content}
                        onChange={(value) => setContent(value || '')}
                        onMount={handleEditorDidMount}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 10, bottom: 10 }
                        }}
                    />
                </div>
            </div>

            {/* Footer with keyboard hints */}
            <Bar design="Footer">
                <div style={{ display: 'flex', gap: '1rem', color: 'var(--sapContent_LabelColor)', fontSize: '0.875rem' }}>
                    <span><kbd className="kbd">{modKey}+S</kbd> Save</span>
                    <span><kbd className="kbd">Esc</kbd> Cancel</span>
                    <span style={{ marginLeft: '8px', color: 'var(--sapContent_LabelColor)' }}>
                        Syntax: {'{param}'} and {'{>partial}'}
                    </span>
                </div>
            </Bar>

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
                    <div style={{
                        width: '100%',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        background: 'var(--sapField_Background)',
                        padding: '0.5rem',
                        border: '1px solid var(--sapField_BorderColor)',
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                        maxHeight: '200px',
                        overflow: 'auto'
                    }}>
                        {exportString}
                    </div>
                </FlexBox>
            </Dialog>
        </div>
    );
};
