
import React, { useState, useEffect, useRef } from 'react';
import { Partial } from '../../types';
import {
    Input,
    List,
    ListItemStandard,
    Button,
    Title,
    Label,
    BusyIndicator,
    Toast,
    Dialog,
    Bar,
    FlexBox
} from '@ui5/webcomponents-react';

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
    const selectedItemRef = useRef<HTMLElement | null>(null);

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
            await window.electronAPI.deletePrompt(partialToDelete.filePath);
            loadPartials(query);
            setDeleteDialogOpen(false);
            setPartialToDelete(null);
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
            <div style={{ padding: '1rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <FlexBox alignItems="Center" style={{ gap: '12px' }}>
                        <Button design="Transparent" icon="nav-back" onClick={onClose} title="Back to Search" />
                        <Title level="H3">Partials Library</Title>
                    </FlexBox>
                    <Button design="Emphasized" onClick={handleNewPartial}>New Partial</Button>
                </div>
                <Input
                    value={query}
                    onInput={handleSearch}
                    placeholder="Search partials..."
                    style={{ width: '100%' }}
                />
            </div>

            {/* List */}
            {loading ? <BusyIndicator active /> : (
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '0 1rem' }}>
                    {partials.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            <h3>No partials found</h3>
                            <p>Press {modKey}+N to create your first partial</p>
                        </div>
                    ) : (
                        <List selectionMode="Single">
                            {partials.map((p, idx) => (
                                <ListItemStandard
                                    key={p.filePath || p.path}
                                    ref={idx === selectedIndex ? (el: any) => { selectedItemRef.current = el; } : undefined}
                                    style={{
                                        background: idx === selectedIndex ? 'var(--sapList_SelectionBackgroundColor)' : 'transparent',
                                        borderLeft: idx === selectedIndex ? '3px solid var(--sapBrandColor)' : '3px solid transparent'
                                    }}
                                    description={p.content.substring(0, 100).replace(/\n/g, ' ') + '...'}
                                    onClick={() => {
                                        setSelectedIndex(idx);
                                        onEditPartial(p);
                                    }}
                                    selected={idx === selectedIndex}
                                >
                                    <span style={{
                                        background: 'var(--color-success)',
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        marginRight: '8px'
                                    }}>
                                        {p.path}
                                    </span>
                                </ListItemStandard>
                            ))}
                        </List>
                    )}
                </div>
            )}

            {/* Footer with keyboard hints */}
            <div className="footer">
                <span><kbd className="kbd">↑↓</kbd> Navigate</span>
                <span><kbd className="kbd">Enter</kbd> Edit</span>
                <span><kbd className="kbd">{modKey}+N</kbd> New</span>
                <span><kbd className="kbd">{modKey}+C</kbd> Copy</span>
                <span><kbd className="kbd">{modKey}+R</kbd> Delete</span>
                <span><kbd className="kbd">Esc</kbd> Back to Search</span>
            </div>

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
        </div>
    );
};
