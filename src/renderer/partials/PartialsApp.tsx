
import React, { useState, useEffect, useRef } from 'react';
import { Partial } from '../../types';
import {
    Input,
    List,
    Button,
    Title,
    Label,
    BusyIndicator,
    Toast,
    Dialog,
    Bar,
    FlexBox,
    Icon,
    ListItemCustom,
    Text
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/nav-back.js';
import '@ui5/webcomponents-icons/dist/search.js';
import '@ui5/webcomponents-icons/dist/add.js';

interface PartialsAppProps {
    onEditPartial: (partial: Partial) => void;
    onClose: () => void;
}

export const PartialsApp: React.FC<PartialsAppProps> = ({ onEditPartial, onClose }) => {
    const [query, setQuery] = useState('');
    const [partials, setPartials] = useState<Partial[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [partialToDelete, setPartialToDelete] = useState<Partial | null>(null);
    const toastRef = useRef<any>(null);
    const selectedItemRef = useRef<any | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? 'Cmd' : 'Ctrl';

    useEffect(() => {
        loadPartials('');

        window.addEventListener('focus', onWindowFocus);
        return () => window.removeEventListener('focus', onWindowFocus);
    }, []);

    // Scroll to selected item using ref
    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    const onWindowFocus = () => {
        loadPartials(query);
    };

    const loadPartials = async (q: string) => {
        setLoading(true);
        let results;
        if (!q.trim()) {
            results = await window.electronAPI.getAllPartials();
        } else {
            results = await window.electronAPI.searchPartials(q);
        }
        setPartials(results);
        setSelectedIndex(0);
        setLoading(false);
    };

    const handleSearch = (e: any) => {
        const val = e.target.value;
        setQuery(val);
        loadPartials(val);
    };

    const handleNewPartial = () => {
        const newPartial: Partial = {
            content: '',
            path: '',
            filePath: ''
        };
        onEditPartial(newPartial);
    };

    const handleCopyPartial = async (partial: Partial) => {
        await window.electronAPI.copyToClipboard(partial.content);
        if (toastRef.current) {
            toastRef.current.show();
        }
    };

    const confirmDeletePartial = async () => {
        if (partialToDelete) {
            try {
                await window.electronAPI.deletePartial(partialToDelete.filePath);
                loadPartials(query);
                setDeleteDialogOpen(false);
                setPartialToDelete(null);
            } catch (error: any) {
                console.error('Failed to delete partial:', error);
                setDeleteDialogOpen(false); // Close dialog anyway
                // Ideally show a message, but for now console is better than stuck dialog.
                // We'll use the toast if available or alert
                alert(`Failed to delete partial: ${error.message}`);
            }
        }
    };

    // Global keyboard handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if in dialog
            if (deleteDialogOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, partials.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                if (partials.length > 0) {
                    onEditPartial(partials[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                onClose();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                handleNewPartial();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                if (partials.length > 0) {
                    onEditPartial(partials[selectedIndex]);
                }
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
                // Copy selected partial content
                if (partials.length > 0 && document.activeElement?.tagName !== 'INPUT') {
                    e.preventDefault();
                    handleCopyPartial(partials[selectedIndex]);
                }
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
                e.preventDefault();
                if (partials.length > 0) {
                    setPartialToDelete(partials[selectedIndex]);
                    setDeleteDialogOpen(true);
                }
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
                // Go back to search (same as Escape in this context)
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [partials, selectedIndex, deleteDialogOpen, onClose, onEditPartial]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <Bar
                design="Header"
                style={{ WebkitAppRegion: 'drag', flexShrink: 0 } as any}
                startContent={
                    <Button design="Transparent" icon="nav-back" onClick={onClose} tooltip="Back to Search" style={{ WebkitAppRegion: 'no-drag' } as any} />
                }
                endContent={
                    <Button design="Transparent" icon="add" onClick={handleNewPartial} tooltip="New Partial" style={{ WebkitAppRegion: 'no-drag' } as any} />
                }
            >
                <Title level="H3" style={{ WebkitAppRegion: 'no-drag' } as any}>Partials Library</Title>
            </Bar>
            <div style={{ padding: '0.5rem 1rem', flexShrink: 0 }}>
                <Input
                    icon={<Icon name="search" />}
                    value={query}
                    onInput={handleSearch}
                    placeholder="Search partials..."
                    style={{ width: '100%' }}
                />
            </div>

            {/* Results list */}
            {loading ? <BusyIndicator active /> : (
                <div ref={listRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    {partials.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Title level="H5" style={{ color: 'var(--sapContent_LabelColor)' }}>No partials found</Title>
                            <Text style={{ color: 'var(--sapContent_LabelColor)' }}>Press {modKey}+N to create your first partial</Text>
                        </div>
                    ) : (
                        <List selectionMode="Single">
                            {partials.map((p, idx) => (
                                <ListItemCustom
                                    key={p.filePath || p.path}
                                    ref={idx === selectedIndex ? (el: any) => { selectedItemRef.current = el; } : undefined}
                                    style={{
                                        borderLeft: idx === selectedIndex ? '3px solid var(--sapBrandColor)' : '3px solid transparent',
                                        paddingLeft: idx === selectedIndex ? '13px' : '16px'
                                    }}
                                    selected={idx === selectedIndex}
                                    onClick={() => {
                                        setSelectedIndex(idx);
                                        onEditPartial(p);
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0.5rem 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>{p.path}</div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--sapContent_LabelColor)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {p.content.substring(0, 100).replace(/\n/g, ' ')}
                                        </div>
                                    </div>
                                </ListItemCustom>
                            ))}
                        </List>
                    )
                    }
                </div >
            )}

            {/* Footer with keyboard hints */}
            <Bar design="Footer">
                <div style={{ display: 'flex', gap: '1rem', color: 'var(--sapContent_LabelColor)', fontSize: '0.875rem' }}>
                    <span><kbd className="kbd">↑↓</kbd> Navigate</span>
                    <span><kbd className="kbd">Enter</kbd> Edit</span>
                    <span><kbd className="kbd">{modKey}+N</kbd> New</span>
                    <span><kbd className="kbd">{modKey}+C</kbd> Copy</span>
                    <span><kbd className="kbd">{modKey}+R</kbd> Delete</span>
                    <span><kbd className="kbd">Esc</kbd> Back to Search</span>
                </div>
            </Bar>

            {/* Delete confirmation dialog */}
            <Dialog
                open={deleteDialogOpen}
                headerText="Delete Partial?"
                onClose={() => setDeleteDialogOpen(false)}
                footer={
                    <Bar
                        endContent={
                            <>
                                <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                                <Button design="Negative" onClick={confirmDeletePartial}>Delete</Button>
                            </>
                        }
                    />
                }
            >
                <div style={{ padding: '1rem' }}>
                    <p>Are you sure you want to delete this partial?</p>
                    {partialToDelete && (
                        <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginTop: '12px' }}>
                            <div style={{ fontWeight: 600, color: '#34C759', fontSize: '12px' }}>
                                {partialToDelete.path}
                            </div>
                        </div>
                    )}
                </div>
            </Dialog>

            <Toast ref={toastRef}>Copied to clipboard</Toast>
        </div >
    );
};
