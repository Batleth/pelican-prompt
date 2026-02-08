import * as path from 'path';
import * as fs from 'fs';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { Workspace, GitStatus } from '../types';

export class WorkspaceService {
    private git: SimpleGit | null = null;
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.initGit();
    }

    private initGit(): void {
        if (fs.existsSync(path.join(this.workspacePath, '.git'))) {
            this.git = simpleGit(this.workspacePath);
        }
    }

    public async getGitStatus(): Promise<GitStatus> {
        if (!this.git) {
            return { isGit: false };
        }

        try {
            const status: StatusResult = await this.git.status();
            const remotes = await this.git.getRemotes(true);
            const hasRemote = remotes.some(r => r.name === 'origin');

            return {
                isGit: true,
                branch: status.current || 'unknown',
                hasRemote,
                hasUncommittedChanges: !status.isClean(),
                ahead: status.ahead,
                behind: status.behind
            };
        } catch (e) {
            console.error('Git status error:', e);
            return { isGit: false };
        }
    }

    public async initializeGit(): Promise<void> {
        if (!this.git) {
            this.git = simpleGit(this.workspacePath);
            // Initialize with 'main' as the default branch
            await this.git.init(['--initial-branch=main']);

            // Stage all existing files and create initial commit
            await this.git.add('.');
            await this.git.commit('Initial commit');
        }
    }

    public async addRemote(url: string): Promise<void> {
        if (!this.git) throw new Error('Git not initialized');
        await this.git.addRemote('origin', url);
    }

    public async pull(): Promise<{ success: boolean; error?: string }> {
        if (!this.git) throw new Error('Git not initialized');
        try {
            const status = await this.git.status();
            const branch = status.current || 'main';
            await this.git.pull('origin', branch);
            return { success: true };
        } catch (e: any) {
            const errorMessage = e.message || String(e);
            if (errorMessage.includes('CONFLICT') || errorMessage.includes('Merge conflict')) {
                return {
                    success: false,
                    error: `Merge conflicts detected in ${this.workspacePath}. Please resolve them manually using your Git client.`
                };
            }
            // Handle "no tracking info" or "couldn't find remote ref" errors gracefully
            if (errorMessage.includes("Couldn't find remote ref") || errorMessage.includes('no tracking information')) {
                return { success: true }; // Nothing to pull yet
            }
            return { success: false, error: errorMessage };
        }
    }

    public async push(): Promise<{ success: boolean; error?: string }> {
        if (!this.git) throw new Error('Git not initialized');
        try {
            const status = await this.git.status();
            const branch = status.current || 'main';

            // Check if there are any commits - if log fails, there are no commits yet
            let hasCommits = true;
            try {
                await this.git.log(['-1']);
            } catch {
                hasCommits = false;
            }

            // If no commits, create initial commit
            if (!hasCommits) {
                await this.git.add('.');
                await this.git.commit('Initial commit');
            }

            // Use -u flag to set upstream on first push
            await this.git.push(['-u', 'origin', branch]);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || String(e) };
        }
    }

    public async autoSync(message: string): Promise<{ success: boolean; error?: string }> {
        if (!this.git) return { success: false, error: 'Git not initialized' };

        try {
            // Stage all changes
            await this.git.add('.');

            // Check if there's anything to commit
            const status = await this.git.status();
            if (status.isClean()) {
                return { success: true }; // Nothing to commit
            }

            // Commit
            await this.git.commit(message);

            // Push if remote exists
            const remotes = await this.git.getRemotes(true);
            if (remotes.some(r => r.name === 'origin')) {
                const branch = status.current || 'main';
                await this.git.push(['-u', 'origin', branch]);
            }

            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || String(e) };
        }
    }

    public isGitEnabled(): boolean {
        return this.git !== null;
    }

    // Static methods for global Git config
    public static async getGitConfig(): Promise<{ name: string; email: string }> {
        const git = simpleGit();
        try {
            const name = await git.getConfig('user.name', 'global');
            const email = await git.getConfig('user.email', 'global');
            return {
                name: name.value || '',
                email: email.value || ''
            };
        } catch {
            return { name: '', email: '' };
        }
    }

    public static async setGitConfig(name: string, email: string): Promise<void> {
        const git = simpleGit();
        await git.addConfig('user.name', name, undefined, 'global');
        await git.addConfig('user.email', email, undefined, 'global');
    }
}
