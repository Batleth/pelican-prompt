
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Prompt, Partial } from '../../types';
import {
    TextArea,
    Input,
    Button,
    Title,
    Label,
    FlexBox,
    FlexBoxAlignItems,
    Dialog,
    Bar,
    MessageStrip
} from '@ui5/webcomponents-react';

interface EditorAppProps {
    prompt: Prompt | null;
    onClose: () => void;
}

export const EditorApp: React.FC<EditorAppProps> = ({ prompt, onClose }) => {
    const [path, setPath] = useState('');
    const [content, setContent] = useState(prompt?.content || '');
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Autocomplete state
    const [autocompleteVisible, setAutocompleteVisible] = useState(false);
    const [autocompleteItems, setAutocompleteItems] = useState<Partial[]>([]);
    const [autocompleteIndex, setAutocompleteIndex] = useState(0);
    const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });
    const [triggerStart, setTriggerStart] = useState(-1);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const isPartial = !prompt?.tag && (prompt?.id === 'new-partial' || prompt?.filePath?.includes('partials'));
    const isNew = !prompt?.filePath || prompt?.id === 'new-partial';
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? 'Cmd' : 'Ctrl';

    useEffect(() => {
        if (prompt) {
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

    const parsePathForPrompt = (pathValue: string): { tag: string; title: string } => {
        const parts = pathValue.split('.');
        if (parts.length === 1) {
            return { tag: '', title: parts[0] };
        }
        const title = parts.pop() || '';
        const tag = parts.join('-');
        return { tag, title };
    };

    const handleSave = async () => {
        setErrorMessage(null);

        // Validate first
        if (!path) {
            setErrorMessage("Path is required");
            return;
        }
        if (!content) {
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
                await window.electronAPI.savePartial(path, content, prompt?.filePath || undefined);
            } else {
                await window.electronAPI.savePrompt(tag, title, content, prompt?.filePath || undefined);
            }
            onClose();
        } catch (e: any) {
            console.error('Save error:', e);
            // Extract cleaner error message
            let msg = e.message || 'Save failed';
            if (msg.includes('already exists')) {
                msg = 'A prompt with this path already exists. Please use a different path.';
            }
            setErrorMessage(msg);
            setSaving(false);
        }
    };

    // Check for partial trigger in content
    const checkAutocomplete = useCallback(async (text: string, cursorPos: number) => {
        const beforeCursor = text.substring(0, cursorPos);
        const triggerMatch = beforeCursor.match(/\{\{>\s*([a-zA-Z0-9._]*)$/);

        if (triggerMatch) {
            const query = triggerMatch[1] || '';
            setTriggerStart(cursorPos - query.length);

            try {
                let partials;
                if (query.trim()) {
                    partials = await window.electronAPI.searchPartials(query);
                } else {
                    partials = await window.electronAPI.getAllPartials();
                }

                if (partials.length > 0) {
                    setAutocompleteItems(partials.slice(0, 8));
                    setAutocompleteIndex(0);
                    setAutocompleteVisible(true);

                    const lines = beforeCursor.split('\n');
                    const lineNumber = lines.length;
                    setAutocompletePos({
                        top: lineNumber * 20 + 100,
                        left: 50
                    });
                } else {
                    setAutocompleteVisible(false);
                }
            } catch (e) {
                setAutocompleteVisible(false);
            }
        } else {
            setAutocompleteVisible(false);
        }
    }, []);

    const insertPartial = (partial: Partial) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const beforeTrigger = content.substring(0, triggerStart);
        const afterCursor = content.substring(cursorPos);

        const newContent = beforeTrigger + partial.path + '}}' + afterCursor;
        setContent(newContent);
        setAutocompleteVisible(false);

        setTimeout(() => {
            if (textareaRef.current) {
                const newPos = triggerStart + partial.path.length + 2;
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleContentInput = (e: any) => {
        const newContent = e.target.value;
        setContent(newContent);

        const textarea = e.target.shadowRoot?.querySelector('textarea') || textareaRef.current;
        if (textarea) {
            textareaRef.current = textarea;
            const cursorPos = textarea.selectionStart;
            checkAutocomplete(newContent, cursorPos);
        }
    };

    const handleContentKeyDown = (e: React.KeyboardEvent) => {
        if (autocompleteVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAutocompleteIndex(prev => Math.min(prev + 1, autocompleteItems.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAutocompleteIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (autocompleteItems[autocompleteIndex]) {
                    insertPartial(autocompleteItems[autocompleteIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setAutocompleteVisible(false);
            }
        } else {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                onClose();
            }
        }
    };

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape' && !autocompleteVisible) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [content, path, autocompleteVisible]);

    const pathHint = isPartial
        ? 'Dot notation path (e.g., tones.urgent)'
        : 'Dot notation path (e.g., work.email.draft) - last part becomes title, rest becomes tag';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', position: 'relative' }}>
            {/* Header */}
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <Title level="H3">{isPartial ? (isNew ? 'New Partial' : 'Edit Partial') : (isNew ? 'New Prompt' : 'Edit Prompt')}</Title>
                <FlexBox alignItems={FlexBoxAlignItems.Center}>
                    <Button design="Emphasized" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button design="Transparent" onClick={onClose} style={{ marginLeft: '0.5rem' }}>Cancel</Button>
                </FlexBox>
            </div>

            {/* Error message */}
            {errorMessage && (
                <MessageStrip
                    design="Negative"
                    onClose={() => setErrorMessage(null)}
                    style={{ marginBottom: '1rem' }}
                >
                    {errorMessage}
                </MessageStrip>
            )}

            {/* Path field */}
            <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
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
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {pathHint}
                </div>
            </div>

            {/* Content textarea with autocomplete */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                <Label>Content</Label>
                <TextArea
                    value={content}
                    onInput={handleContentInput}
                    onKeyDown={handleContentKeyDown}
                    placeholder={isPartial
                        ? "Partial content..."
                        : "Prompt content...\n\nUse [PARAM_NAME] for parameters\nUse {{> partial.path}} for partials (autocomplete shows after typing {{>)"}
                    style={{ flex: 1, height: '100%', minHeight: '250px' }}
                    growing={true}
                    valueState={errorMessage && !content ? 'Negative' : 'None'}
                />

                {/* Autocomplete dropdown */}
                {autocompleteVisible && autocompleteItems.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: autocompletePos.top,
                        left: autocompletePos.left,
                        background: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border-medium)',
                        borderRadius: '4px',
                        boxShadow: 'var(--shadow-lg)',
                        maxHeight: '200px',
                        overflow: 'auto',
                        zIndex: 1000,
                        minWidth: '300px'
                    }}>
                        {autocompleteItems.map((partial, idx) => (
                            <div
                                key={partial.filePath}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    background: idx === autocompleteIndex ? 'var(--sapList_SelectionBackgroundColor)' : 'transparent',
                                    borderLeft: idx === autocompleteIndex ? '3px solid var(--sapBrandColor)' : '3px solid transparent'
                                }}
                                onClick={() => insertPartial(partial)}
                                onMouseEnter={() => setAutocompleteIndex(idx)}
                            >
                                <div style={{ fontWeight: 500 }}>{partial.path}</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                    {partial.content.substring(0, 60).replace(/\n/g, ' ')}...
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer with keyboard hints */}
            <div className="footer">
                <span><kbd className="kbd">{modKey}+S</kbd> Save</span>
                <span><kbd className="kbd">Esc</kbd> Cancel</span>
                {!isPartial && (
                    <span style={{ marginLeft: '8px', color: 'var(--color-text-secondary)' }}>
                        Tip: Type <kbd className="kbd">{'{{>'}</kbd> to insert partials
                    </span>
                )}
            </div>
        </div>
    );
};
