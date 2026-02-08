import React, { useState, useEffect } from 'react';
import { Workspace, GitStatus } from '../../types';
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
import '@ui5/webcomponents-icons/dist/synchronize.js';
import '@ui5/webcomponents-icons/dist/download.js';
import '@ui5/webcomponents-icons/dist/upload.js';
import '@ui5/webcomponents-icons/dist/world.js';
import '@ui5/webcomponents-icons/dist/home.js';
import '@ui5/webcomponents-icons/dist/settings.js';
import '@ui5/webcomponents-icons/dist/source-code.js';

interface WorkspaceManagerProps {
    open: boolean;
    onClose: () => void;
    onWorkspaceChanged: () => void;
}

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ open, onClose, onWorkspaceChanged }) => {
    const [globalPath, setGlobalPath] = useState<string | undefined>();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeId, setActiveId] = useState<string | undefined>();
    const [gitStatus, setGitStatus] = useState<Record<string, GitStatus>>({});

    // Create workspace dialog
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createMode, setCreateMode] = useState<'global' | 'project'>('global');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [createType, setCreateType] = useState<'new' | 'existing'>('new');

    const [conflictError, setConflictError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Remote dialog state
    const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
    const [remoteDialogPath, setRemoteDialogPath] = useState('');
    const [remoteUrl, setRemoteUrl] = useState('');

    // Git settings dialog state
    const [gitDialogOpen, setGitDialogOpen] = useState(false);
    const [gitDialogWorkspace, setGitDialogWorkspace] = useState<{ ws: Workspace; wsId: string; path: string } | null>(null);
    const [gitUserName, setGitUserName] = useState('');
    const [gitUserEmail, setGitUserEmail] = useState('');

    const loadWorkspaces = async () => {
        const data = await window.electronAPI.getWorkspaces();
        setGlobalPath(data.globalPath);
        setWorkspaces(data.workspaces || []);
        setActiveId(data.activeId);

        // Load git status for each workspace
        const statuses: Record<string, GitStatus> = {};
        for (const ws of data.workspaces || []) {
            if (ws.isGit) {
                try {
                    statuses[ws.id] = await window.electronAPI.gitStatus(ws.path);
                } catch (e) {
                    // Ignore errors
                }
            }
        }
        if (data.globalPath) {
            try {
                const globalStatus = await window.electronAPI.gitStatus(data.globalPath);
                statuses['global'] = globalStatus;
            } catch (e) {
                // Ignore errors
            }
        }
        setGitStatus(statuses);
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

    const handleToggleAutoSync = async (ws: Workspace) => {
        await window.electronAPI.updateWorkspaceSettings(ws.id, { autoSync: !ws.autoSync });
        await loadWorkspaces();
    };

    const handleGitPull = async (path: string, wsId: string) => {
        setLoading(true);
        const result = await window.electronAPI.gitPull(path);
        setLoading(false);
        if (!result.success) {
            setConflictError(result.error || 'Pull failed. You may have merge conflicts that need to be resolved manually.');
        } else {
            await loadWorkspaces();
            onWorkspaceChanged();
        }
    };

    const handleGitPush = async (path: string) => {
        setLoading(true);
        const result = await window.electronAPI.gitPush(path);
        setLoading(false);
        if (!result.success) {
            setConflictError(result.error || 'Push failed');
        } else {
            await loadWorkspaces();
        }
    };

    const handleGitInit = async (path: string) => {
        setLoading(true);
        try {
            await window.electronAPI.gitInit(path);
            await loadWorkspaces();
        } catch (e: any) {
            setConflictError(e.message || 'Failed to initialize Git');
        }
        setLoading(false);
    };

    const handleAddRemote = async () => {
        if (!remoteUrl.trim()) return;
        setLoading(true);
        try {
            await window.electronAPI.gitAddRemote(remoteDialogPath, remoteUrl.trim());
            await loadWorkspaces();
            setRemoteDialogOpen(false);
            setRemoteUrl('');
        } catch (e: any) {
            setConflictError(e.message || 'Failed to add remote');
        }
        setLoading(false);
    };

    const handleManualSync = async (path: string, wsId: string) => {
        setLoading(true);
        try {
            const result = await window.electronAPI.gitAutoSync(path, 'Manual sync from Workspace Manager');
            setLoading(false);
            if (!result.success) {
                setConflictError(result.error || 'Sync failed');
            } else {
                await loadWorkspaces();
                // Fetch fresh data for dialog update because 'workspaces' state is stale here
                const data = await window.electronAPI.getWorkspaces();
                const updatedWs = (data.workspaces || []).find((w: any) => w.id === wsId);
                if (updatedWs) {
                    setGitDialogWorkspace({ ws: updatedWs, wsId, path });
                }
            }
        } catch (e: any) {
            setLoading(false);
            setConflictError(e.message || 'Sync failed');
        }
    };

    const openRemoteDialog = (path: string) => {
        setRemoteDialogPath(path);
        setRemoteUrl('');
        setRemoteDialogOpen(true);
    };

    const openGitDialog = async (ws: Workspace, wsId: string, path: string) => {
        setGitDialogWorkspace({ ws, wsId, path });
        // Load current git config
        const config = await window.electronAPI.gitGetConfig();
        setGitUserName(config.name);
        setGitUserEmail(config.email);
        setGitDialogOpen(true);
    };

    // Compact Git status indicator - just shows icon + status, click to open dialog
    const renderGitControls = (ws: Workspace, wsId: string, path: string) => {
        const status = gitStatus[wsId];

        // If not a Git repo, show Initialize button
        if (!ws.isGit || !status?.isGit) {
            return (
                <Button design="Transparent" onClick={() => handleGitInit(path)} disabled={loading} tooltip="Initialize Git Repository">
                    <Icon name="source-code" style={{ marginRight: '0.25rem' }} />
                    Init Git
                </Button>
            );
        }

        // Show compact Git status with button to open settings
        return (
            <Button design="Transparent" onClick={() => openGitDialog(ws, wsId, path)} tooltip="Git Settings">
                <ObjectStatus state={status.hasUncommittedChanges ? 'Critical' : 'Positive'} style={{ marginRight: '0.25rem' }}>
                    {status.branch || 'main'}
                </ObjectStatus>
                <Icon name="settings" />
            </Button>
        );
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
                                {gitStatus['global']?.isGit && (
                                    <FlexBox alignItems="Center" style={{ gap: '0.5rem' }}>
                                        <ObjectStatus state={gitStatus['global'].hasUncommittedChanges ? 'Critical' : 'Positive'}>
                                            {gitStatus['global'].branch || 'main'}
                                        </ObjectStatus>
                                        {gitStatus['global'].hasRemote && (
                                            <>
                                                <Button icon="download" tooltip="Pull" design="Transparent" onClick={() => handleGitPull(globalPath, 'global')} disabled={loading} />
                                                <Button icon="upload" tooltip="Push" design="Transparent" onClick={() => handleGitPush(globalPath)} disabled={loading} />
                                            </>
                                        )}
                                    </FlexBox>
                                )}
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
                                                {renderGitControls(ws, ws.id, ws.path)}
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

            {/* Git Settings Dialog */}
            <Dialog
                open={gitDialogOpen}
                onClose={() => setGitDialogOpen(false)}
                headerText="Git Settings"
                style={{ width: '450px' }}
                footer={
                    <Bar endContent={<Button onClick={() => setGitDialogOpen(false)}>Close</Button>} />
                }
            >
                {gitDialogWorkspace && (() => {
                    const { ws, wsId, path } = gitDialogWorkspace;
                    const status = gitStatus[wsId];
                    return (
                        <FlexBox direction="Column" style={{ gap: '1.5rem', padding: '1rem' }}>
                            {/* Status Section */}
                            <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                                <Title level="H5">Repository Status</Title>
                                <FlexBox alignItems="Center" style={{ gap: '1rem' }}>
                                    <Label>Branch:</Label>
                                    <ObjectStatus state={status?.hasUncommittedChanges ? 'Critical' : 'Positive'}>
                                        {status?.branch || 'main'}
                                    </ObjectStatus>
                                </FlexBox>
                                <FlexBox alignItems="Center" style={{ gap: '1rem' }}>
                                    <Label>Remote:</Label>
                                    <Text>{status?.hasRemote ? 'Configured' : 'Not configured'}</Text>
                                </FlexBox>
                                {status?.hasUncommittedChanges && (
                                    <Text style={{ color: 'var(--sapNegativeTextColor)', fontSize: '0.85rem' }}>
                                        You have uncommitted changes
                                    </Text>
                                )}
                            </FlexBox>

                            {/* Actions Section */}
                            <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                                <Title level="H5">Actions</Title>
                                {status?.hasRemote ? (
                                    <FlexBox style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <Button icon="synchronize" onClick={() => handleManualSync(path, wsId)} disabled={loading} design="Emphasized">
                                            Sync Changes
                                        </Button>
                                        <Button icon="download" onClick={() => { handleGitPull(path, wsId); setGitDialogOpen(false); }} disabled={loading}>
                                            Pull
                                        </Button>
                                        <Button icon="upload" onClick={() => { handleGitPush(path); setGitDialogOpen(false); }} disabled={loading}>
                                            Push
                                        </Button>
                                    </FlexBox>
                                ) : (
                                    <Button onClick={() => { setGitDialogOpen(false); openRemoteDialog(path); }} disabled={loading}>
                                        Add Remote Repository
                                    </Button>
                                )}
                            </FlexBox>

                            {/* Settings Section */}
                            <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                                <Title level="H5">Settings</Title>
                                <FlexBox alignItems="Center" style={{ gap: '1rem' }}>
                                    <Label>Auto-Sync:</Label>
                                    <Switch checked={ws.autoSync} onChange={() => handleToggleAutoSync(ws)} />
                                </FlexBox>
                                <Text style={{ fontSize: '0.8rem', color: 'var(--sapNeutralTextColor)' }}>
                                    Automatically pull on open and push on save.
                                </Text>
                            </FlexBox>

                            {/* Identity Section */}
                            <FlexBox direction="Column" style={{ gap: '0.75rem' }}>
                                <Title level="H5">Git Identity</Title>
                                <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                                    <Label>Name:</Label>
                                    <Input
                                        value={gitUserName}
                                        onInput={(e: any) => setGitUserName(e.target.value)}
                                        placeholder="Your Name"
                                        style={{ width: '100%' }}
                                    />
                                </FlexBox>
                                <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                                    <Label>Email:</Label>
                                    <Input
                                        value={gitUserEmail}
                                        onInput={(e: any) => setGitUserEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        style={{ width: '100%' }}
                                    />
                                </FlexBox>
                                <Button
                                    onClick={async () => {
                                        await window.electronAPI.gitSetConfig(gitUserName, gitUserEmail);
                                    }}
                                    disabled={!gitUserName.trim() || !gitUserEmail.trim()}
                                >
                                    Save Identity
                                </Button>
                                <Text style={{ fontSize: '0.8rem', color: 'var(--sapNeutralTextColor)' }}>
                                    Required for making commits.
                                </Text>
                            </FlexBox>
                        </FlexBox>
                    );
                })()}
            </Dialog>

            {/* Add Remote Dialog */}
            <Dialog
                open={remoteDialogOpen}
                onClose={() => setRemoteDialogOpen(false)}
                headerText="Add Git Remote"
                style={{ width: '450px' }}
                footer={
                    <Bar endContent={
                        <FlexBox style={{ gap: '0.5rem' }}>
                            <Button design="Transparent" onClick={() => setRemoteDialogOpen(false)}>Cancel</Button>
                            <Button design="Emphasized" onClick={handleAddRemote} disabled={loading || !remoteUrl.trim()}>Add Remote</Button>
                        </FlexBox>
                    } />
                }
            >
                <FlexBox direction="Column" style={{ gap: '1rem', padding: '1rem' }}>
                    <Text>Enter the remote repository URL (e.g., https://github.com/user/repo.git or git@github.com:user/repo.git)</Text>
                    <Input
                        value={remoteUrl}
                        onInput={(e: any) => setRemoteUrl(e.target.value)}
                        placeholder="https://github.com/user/repo.git"
                        style={{ width: '100%' }}
                    />
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
