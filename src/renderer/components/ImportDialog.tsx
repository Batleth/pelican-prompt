import React, { useState } from 'react';
import {
    Dialog,
    Bar,
    Button,
    TextArea,
    FlexBox,
    Title,
    Text,
    MessageStrip,
    CheckBox,
    Icon,
    ObjectStatus,
    Label
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/download.js';
import '@ui5/webcomponents-icons/dist/document.js';
import '@ui5/webcomponents-icons/dist/add-document.js';

interface ConflictItem {
    item: { type: string; relativePath: string; content: string };
    status: 'new' | 'conflict' | 'identical';
    existingContent?: string;
}

interface ImportDialogProps {
    open: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

type Step = 'paste' | 'review' | 'done';

export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose, onImportComplete }) => {
    const [step, setStep] = useState<Step>('paste');
    const [importString, setImportString] = useState('');
    const [conflictItems, setConflictItems] = useState<ConflictItem[]>([]);
    const [overwriteChecked, setOverwriteChecked] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

    const reset = () => {
        setStep('paste');
        setImportString('');
        setConflictItems([]);
        setOverwriteChecked(new Set());
        setLoading(false);
        setError(null);
        setResult(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleParse = async () => {
        if (!importString.trim()) return;
        setLoading(true);
        setError(null);

        try {
            const { conflicts } = await window.electronAPI.parseImportString(importString.trim());
            setConflictItems(conflicts.items);
            // Auto-check "overwrite" for identical items
            const autoCheck = new Set<number>();
            conflicts.items.forEach((ci: ConflictItem, i: number) => {
                if (ci.status === 'identical' || ci.status === 'new') {
                    autoCheck.add(i);
                }
            });
            setOverwriteChecked(autoCheck);
            setStep('review');
        } catch (err: any) {
            setError(err.message || 'Failed to parse import string');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await window.electronAPI.executeImport(
                importString.trim(),
                Array.from(overwriteChecked)
            );
            setResult(res);
            setStep('done');
            onImportComplete();
        } catch (err: any) {
            setError(err.message || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    const toggleOverwrite = (index: number) => {
        setOverwriteChecked(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const hasConflicts = conflictItems.some(ci => ci.status === 'conflict');

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            headerText="Import Prompt"
            style={{ width: '550px', maxHeight: '80vh' }}
            footer={
                <Bar endContent={
                    <FlexBox style={{ gap: '0.5rem' }}>
                        {step === 'paste' && (
                            <>
                                <Button design="Transparent" onClick={handleClose}>Cancel</Button>
                                <Button design="Emphasized" onClick={handleParse} disabled={loading || !importString.trim()}>
                                    {loading ? 'Parsing...' : 'Next'}
                                </Button>
                            </>
                        )}
                        {step === 'review' && (
                            <>
                                <Button design="Transparent" onClick={() => setStep('paste')}>Back</Button>
                                <Button design="Emphasized" onClick={handleImport} disabled={loading}>
                                    {loading ? 'Importing...' : 'Import'}
                                </Button>
                            </>
                        )}
                        {step === 'done' && (
                            <Button design="Emphasized" onClick={handleClose}>Done</Button>
                        )}
                    </FlexBox>
                } />
            }
        >
            <FlexBox direction="Column" style={{ gap: '1rem', padding: '1rem' }}>
                {error && (
                    <MessageStrip design="Negative" onClose={() => setError(null)}>
                        {error}
                    </MessageStrip>
                )}

                {step === 'paste' && (
                    <>
                        <Text>Paste an import string below. These strings start with <code>PELICAN:</code> and contain a prompt with its partial dependencies.</Text>
                        <TextArea
                            value={importString}
                            onInput={(e: any) => setImportString(e.target.value)}
                            placeholder="PELICAN:H4sIAAAAA..."
                            rows={6}
                            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
                            growing
                        />
                    </>
                )}

                {step === 'review' && (
                    <>
                        <Text style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {conflictItems.length} item{conflictItems.length !== 1 ? 's' : ''} to import
                            {hasConflicts && ' — some conflicts detected'}
                        </Text>

                        {hasConflicts && (
                            <MessageStrip design="Critical" hideCloseButton>
                                Items with conflicts already exist in your workspace with different content. Check the items you want to overwrite.
                            </MessageStrip>
                        )}

                        <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--sapGroup_TitleBorderColor)', borderRadius: '8px' }}>
                            {conflictItems.map((ci, index) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        borderBottom: index < conflictItems.length - 1 ? '1px solid var(--sapGroup_TitleBorderColor)' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        background: ci.status === 'conflict' ? 'var(--sapWarningBackground, rgba(255, 175, 0, 0.08))' : 'transparent'
                                    }}
                                >
                                    {(ci.status === 'conflict' || ci.status === 'identical') && (
                                        <CheckBox
                                            checked={overwriteChecked.has(index)}
                                            onChange={() => toggleOverwrite(index)}
                                        />
                                    )}
                                    <Icon name={ci.item.type === 'prompt' ? 'document' : 'add-document'} style={{ flexShrink: 0 }} />
                                    <FlexBox direction="Column" style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ fontWeight: 500, wordBreak: 'break-all' }}>
                                            {ci.item.relativePath}
                                        </Text>
                                        <Label style={{ fontSize: '0.75rem', color: 'var(--sapNeutralTextColor)' }}>
                                            {ci.item.type === 'prompt' ? 'Prompt' : 'Partial'}
                                        </Label>
                                    </FlexBox>
                                    <ObjectStatus
                                        state={ci.status === 'new' ? 'Positive' : ci.status === 'identical' ? 'Information' : 'Critical'}
                                        style={{ flexShrink: 0 }}
                                    >
                                        {ci.status === 'new' ? 'New' : ci.status === 'identical' ? (overwriteChecked.has(index) ? 'Overwrite' : 'Skip') : (overwriteChecked.has(index) ? 'Overwrite' : 'Skip')}
                                    </ObjectStatus>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {step === 'done' && result && (
                    <FlexBox direction="Column" alignItems="Center" style={{ gap: '1rem', padding: '1rem' }}>
                        <Title level="H3" style={{ color: 'var(--sapPositiveTextColor)' }}>Import Complete!</Title>
                        <Text>{result.imported} item{result.imported !== 1 ? 's' : ''} imported</Text>
                        {result.skipped > 0 && (
                            <Text style={{ color: 'var(--sapNeutralTextColor)' }}>
                                {result.skipped} item{result.skipped !== 1 ? 's' : ''} skipped
                            </Text>
                        )}
                    </FlexBox>
                )}
            </FlexBox>
        </Dialog>
    );
};
