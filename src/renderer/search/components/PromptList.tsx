
import React, { useRef, useEffect } from 'react';
import { Prompt, SearchResult } from '../../../types';
import {
    List,
    ListItemCustom,
    Button,
    Title,
    Text,
    FlexBox,
    ObjectStatus
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/share.js';

interface PromptListProps {
    prompts: SearchResult[];
    selectedIndex: number;
    hasFolder: boolean;
    onSelectPrompt: (prompt: Prompt) => void;
    onSetSelectedIndex: (index: number) => void;
    onExportPrompt: (prompt: Prompt) => void;
    onSelectFolder: () => void;
    isMac: boolean;
    exporting: boolean;
}

export const PromptList: React.FC<PromptListProps> = ({
    prompts,
    selectedIndex,
    hasFolder,
    onSelectPrompt,
    onSetSelectedIndex,
    onExportPrompt,
    onSelectFolder,
    isMac,
    exporting
}) => {
    const listRef = useRef<HTMLDivElement>(null);
    const selectedItemRef = useRef<any | null>(null);

    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    const formatTag = (tag: string) => tag.split('/').pop() || tag;
    const modKey = isMac ? 'Cmd' : 'Ctrl';

    return (
        <div ref={listRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {!hasFolder ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <Title level="H5" style={{ color: 'var(--sapContent_LabelColor)' }}>No Folder Selected</Title>
                    <Button onClick={onSelectFolder} style={{ marginTop: '1rem' }}>Open Folder</Button>
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
                                onSetSelectedIndex(idx);
                                onSelectPrompt(res.prompt);
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                onSetSelectedIndex(idx);
                                onExportPrompt(res.prompt);
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
                                        onExportPrompt(res.prompt);
                                    }}
                                    style={{ flexShrink: 0 }}
                                />
                            )}
                        </ListItemCustom>
                    ))}
                </List>
            )}
        </div>
    );
};
