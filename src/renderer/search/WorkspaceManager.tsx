import React, { useState, useEffect } from 'react';
import { Workspace } from '../../types';
import {
    Dialog,
    Bar,
    Button,
    Title,
    List,
    ListItemCustom,
    Input,
    FlexBox,
    Label,
    Switch,
    MessageBox,
    Text,
    Icon,
    ObjectStatus,
    RadioButton
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/folder-blank.js';
import '@ui5/webcomponents-icons/dist/add.js';
import '@ui5/webcomponents-icons/dist/delete.js';
import '@ui5/webcomponents-icons/dist/home.js';

interface WorkspaceManagerProps {
    open: boolean;
    onClose: () => void;
    onWorkspaceChanged: () => void;
}

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ open, onClose, onWorkspaceChanged }) => {
    const [globalPath, setGlobalPath] = useState<string | undefined>();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeId, setActiveId] = useState<string | undefined>();

    // Create workspace dialog
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createMode, setCreateMode] = useState<'global' | 'project'>('global');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [createType, setCreateType] = useState<'new' | 'existing'>('new');

    const [conflictError, setConflictError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);



    const loadWorkspaces = async () => {
        const data = await window.electronAPI.getWorkspaces();
        setGlobalPath(data.globalPath);
        setWorkspaces(data.workspaces || []);
        setActiveId(data.activeId);
    };

    useEffect(() => {
        if (open) {
            loadWorkspaces();
        }
    }, [open]);

    const handleCreateWorkspace = async () => {
        if (createType === 'new') {
            // Create new workspace with folder structure
            const folder = await window.electronAPI.createWorkspace();
            if (folder) {
                if (createMode === 'global') {
                    await window.electronAPI.setGlobalWorkspace(folder);
                } else if (newWorkspaceName.trim()) {
                    await window.electronAPI.addProjectWorkspace(newWorkspaceName.trim(), folder);
                }
                setCreateDialogOpen(false);
                setNewWorkspaceName('');
                await loadWorkspaces();
                onWorkspaceChanged();
            }
        } else {
            // Select existing folder
            const folder = await window.electronAPI.selectFolder();
            if (folder) {
                if (createMode === 'global') {
                    await window.electronAPI.setGlobalWorkspace(folder);
                } else if (newWorkspaceName.trim()) {
                    await window.electronAPI.addProjectWorkspace(newWorkspaceName.trim(), folder);
                }
                setCreateDialogOpen(false);
                setNewWorkspaceName('');
                await loadWorkspaces();
                onWorkspaceChanged();
            }
        }
    };

    const handleSwitchWorkspace = async (id: string | null) => {
        await window.electronAPI.switchProjectWorkspace(id);
        setActiveId(id || undefined);
        onWorkspaceChanged();
    };

    const handleDeleteWorkspace = async (id: string) => {
        await window.electronAPI.deleteProjectWorkspace(id);
        await loadWorkspaces();
        if (activeId === id) {
            onWorkspaceChanged();
        }
    };



    const openCreateDialog = (mode: 'global' | 'project') => {
        setCreateMode(mode);
        setCreateType('new');
        setNewWorkspaceName('');
        setCreateDialogOpen(true);
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                headerText="Workspace Manager"
                style={{ width: '650px' }}
                footer={
                    <Bar endContent={<Button onClick={onClose}>Close</Button>} />
                }
            >
                <FlexBox direction="Column" style={{ gap: '1.5rem', padding: '1rem' }}>
                    {/* Global Workspace Section */}
                    <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                        <FlexBox justifyContent="SpaceBetween" alignItems="Center">
                            <Title level="H5"><Icon name="home" style={{ marginRight: '0.5rem' }} />Global Workspace</Title>
                            {!globalPath && (
                                <Button icon="add" design="Transparent" onClick={() => openCreateDialog('global')}>Set Up</Button>
                            )}
                        </FlexBox>
                        {globalPath ? (
                            <FlexBox direction="Column" style={{ gap: '0.5rem', padding: '0.5rem', background: 'var(--sapList_Background)', borderRadius: '8px' }}>
                                <FlexBox alignItems="Center" justifyContent="SpaceBetween">
                                    <FlexBox direction="Column">
                                        <Text style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{globalPath}</Text>
                                    </FlexBox>
                                    <FlexBox alignItems="Center" style={{ gap: '0.5rem' }}>
                                        {!activeId ? (
                                            <ObjectStatus state="Positive">Active</ObjectStatus>
                                        ) : (
                                            <Button design="Emphasized" onClick={() => handleSwitchWorkspace(null)}>Use Only</Button>
                                        )}
                                        <Button icon="open-folder" design="Transparent" tooltip="Open in Explorer" onClick={() => window.electronAPI.openFolderInFilesystem(globalPath)} />
                                        <Button design="Transparent" onClick={() => openCreateDialog('global')}>Change</Button>
                                    </FlexBox>
                                </FlexBox>

                            </FlexBox>
                        ) : (
                            <Text style={{ color: 'var(--sapNeutralTextColor)', fontSize: '0.85rem' }}>
                                No global workspace set. Set one up to have shared prompts across projects.
                            </Text>
                        )}
                    </FlexBox>

                    {/* Project Workspaces Section */}
                    <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                        <FlexBox justifyContent="SpaceBetween" alignItems="Center">
                            <Title level="H5"><Icon name="world" style={{ marginRight: '0.5rem' }} />Project Workspaces</Title>
                            <Button icon="add" design="Transparent" onClick={() => openCreateDialog('project')}>Add</Button>
                        </FlexBox>
                        {workspaces.length === 0 ? (
                            <Text style={{ color: 'var(--sapNeutralTextColor)', fontSize: '0.85rem' }}>
                                No project workspaces. Add one to organize project-specific prompts.
                            </Text>
                        ) : (
                            <List style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {workspaces.map(ws => (
                                    <ListItemCustom key={ws.id}>
                                        <FlexBox alignItems="Center" justifyContent="SpaceBetween" style={{ width: '100%', padding: '0.5rem 0' }}>
                                            <FlexBox direction="Column" style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={{ fontWeight: 'bold' }}>{ws.name}</Text>
                                                <Text style={{ fontSize: '0.75rem', color: 'var(--sapNeutralTextColor)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ws.path}</Text>
                                            </FlexBox>
                                            <FlexBox alignItems="Center" style={{ gap: '0.5rem', flexShrink: 0 }}>

                                                <Button icon="open-folder" design="Transparent" tooltip="Open in Explorer" onClick={() => window.electronAPI.openFolderInFilesystem(ws.path)} />
                                                {activeId === ws.id ? (
                                                    <ObjectStatus state="Positive">Active</ObjectStatus>
                                                ) : (
                                                    <Button design="Transparent" onClick={() => handleSwitchWorkspace(ws.id)}>Switch</Button>
                                                )}
                                                <Button icon="delete" design="Transparent" onClick={() => handleDeleteWorkspace(ws.id)} />
                                            </FlexBox>
                                        </FlexBox>
                                    </ListItemCustom>
                                ))}
                            </List>
                        )}
                    </FlexBox>
                </FlexBox>
            </Dialog>

            {/* Create/Add Workspace Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                headerText={createMode === 'global' ? 'Set Up Global Workspace' : 'Add Project Workspace'}
                footer={
                    <Bar endContent={
                        <>
                            <Button design="Transparent" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                            <Button design="Emphasized" onClick={handleCreateWorkspace} disabled={createMode === 'project' && !newWorkspaceName.trim()}>
                                {createType === 'new' ? 'Create' : 'Select'}
                            </Button>
                        </>
                    } />
                }
            >
                <FlexBox direction="Column" style={{ gap: '1rem', padding: '1rem', minWidth: '350px' }}>
                    {createMode === 'project' && (
                        <>
                            <Label>Workspace Name</Label>
                            <Input
                                value={newWorkspaceName}
                                onInput={(e: any) => setNewWorkspaceName(e.target.value)}
                                placeholder="e.g., My Project"
                            />
                        </>
                    )}

                    <Label>Folder</Label>
                    <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                        <FlexBox alignItems="Center" style={{ gap: '0.5rem' }}>
                            <RadioButton
                                name="createType"
                                text="Create new workspace folder"
                                checked={createType === 'new'}
                                onChange={() => setCreateType('new')}
                            />
                        </FlexBox>
                        <Text style={{ fontSize: '0.8rem', color: 'var(--sapNeutralTextColor)', marginLeft: '1.5rem' }}>
                            Creates a new folder with prompts/ and partials/ subdirectories.
                        </Text>
                        <FlexBox alignItems="Center" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                            <RadioButton
                                name="createType"
                                text="Use existing folder"
                                checked={createType === 'existing'}
                                onChange={() => setCreateType('existing')}
                            />
                        </FlexBox>
                        <Text style={{ fontSize: '0.8rem', color: 'var(--sapNeutralTextColor)', marginLeft: '1.5rem' }}>
                            Select an existing folder that already contains prompts.
                        </Text>
                    </FlexBox>
                </FlexBox>
            </Dialog>



            {/* Error Dialog */}
            <MessageBox
                open={!!conflictError}
                onClose={() => setConflictError(null)}
                type="Error"
                titleText="Git Operation Failed"
            >
                {conflictError}
            </MessageBox>
        </>
    );
};
