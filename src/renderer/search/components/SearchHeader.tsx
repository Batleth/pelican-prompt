
import React, { useRef, useState } from 'react';
import {
    Title,
    Button,
    ResponsivePopover,
    List,
    ListItemStandard
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/group.js';
import '@ui5/webcomponents-icons/dist/palette.js';

interface SearchHeaderProps {
    activeWorkspaceName: string;
    onOpenWorkspaceManager: () => void;
    onThemeSelect: (theme: string) => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({ activeWorkspaceName, onOpenWorkspaceManager, onThemeSelect }) => {
    const themeBtnRef = useRef<any>(null);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

    const handleThemeSelectInternal = (e: any) => {
        const items = e.detail.selectedItems;
        if (!items || items.length === 0) return;
        const item = items[0];
        const theme = item.getAttribute('data-theme') || item.dataset.theme;
        if (theme) {
            onThemeSelect(theme);
            setThemeMenuOpen(false);
        }
    };

    return (
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
                    onClick={onOpenWorkspaceManager}
                    style={{
                        color: 'var(--sapTextColor)',
                        fontSize: '0.8rem',
                        padding: '2px 2px',
                        cursor: 'pointer',
                        WebkitAppRegion: 'no-drag'
                    } as any}
                >
                    {activeWorkspaceName || 'Global'}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', WebkitAppRegion: 'no-drag' } as any}>
                <Button
                    icon="group"
                    design="Transparent"
                    onClick={onOpenWorkspaceManager}
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

            <ResponsivePopover
                open={themeMenuOpen}
                opener={themeBtnRef.current}
                onClose={() => setThemeMenuOpen(false)}
            >
                <List onSelectionChange={handleThemeSelectInternal} selectionMode="Single">
                    <ListItemStandard data-theme="sap_horizon">Morning Horizon (Light)</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_dark">Evening Horizon (Dark)</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_hcb">High Contrast Black</ListItemStandard>
                    <ListItemStandard data-theme="sap_horizon_hcw">High Contrast White</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3">Quartz Light</ListItemStandard>
                    <ListItemStandard data-theme="sap_fiori_3_dark">Quartz Dark</ListItemStandard>
                </List>
            </ResponsivePopover>
        </div>
    );
};
