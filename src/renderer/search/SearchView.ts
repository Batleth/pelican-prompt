import { Prompt, SearchResult } from '../../types';

export class SearchView {
    private searchInput: HTMLInputElement | null = null;
    private resultsContainer: HTMLElement | null = null;
    private themeToggle: HTMLElement | null = null;

    constructor() {
        this.searchInput = document.getElementById('search-input') as HTMLInputElement;
        this.resultsContainer = document.getElementById('results-container');
        this.themeToggle = document.getElementById('themeToggle');
    }

    getSearchInput(): HTMLInputElement | null {
        // Re-query in case it was re-rendered
        return document.getElementById('search-input') as HTMLInputElement;
    }

    setSearchValue(value: string) {
        const input = this.getSearchInput();
        if (input) {
            input.value = value;
        }
    }

    focusSearchInput() {
        const input = this.getSearchInput();
        if (input) {
            // Small timeout to ensure focus works even if window just focused
            setTimeout(() => input.focus(), 50);
        }
    }

    updateFolderDisplay(folderPath: string | undefined) {
        const openFolderBtn = document.getElementById('open-folder-btn');
        const workspaceNameEl = document.getElementById('workspace-name');

        if (openFolderBtn) {
            openFolderBtn.title = folderPath || 'No folder selected';
        }

        if (workspaceNameEl) {
            if (folderPath) {
                // Extract just the folder name from the path
                const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop() || 'Unknown';
                workspaceNameEl.textContent = folderName;
            } else {
                workspaceNameEl.textContent = 'None';
            }
        }
    }

    renderNoFolderState() {
        const app = document.getElementById('app');
        if (!app) return;

        app.innerHTML = `
      <div class="no-folder">
        <h3>Welcome to Pelican Prompt</h3>
        <p>Select a folder to store your prompts</p>
        <button id="select-folder-btn">Select Folder</button>
      </div>
    `;
    }

    renderMainLayout(modKey: string) {
        const app = document.getElementById('app');
        if (!app) return;

        app.innerHTML = `
      <div class="search-box">
        <div class="folder-info">
          <div>
            <span style="color: #666; font-size: 11px;">Current Workspace: </span>
            <span class="workspace-name" id="workspace-name">Loading...</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="open-folder-btn" title="Loading...">Open in Filesystem</button>
            <button class="btn btn-secondary btn-sm" id="create-workspace-btn">Create Workspace</button>
            <button class="btn btn-secondary btn-sm" id="change-folder-btn">Change Workspace</button>
          </div>
        </div>
        <input 
          type="text" 
          id="search-input" 
          class="search-input" 
          placeholder="Search prompts... (e.g., 'tag:com-mail', 'tag:code*', or 'meeting')"
          autocomplete="off"
        />
      </div>
      <div class="results" id="results-container"></div>
      <div class="footer">
        <div class="keyboard-hint">
          <span class="kbd">↑↓</span> Navigate • <span class="kbd">Enter</span> Select • <span class="kbd">${modKey}+N</span> New • <span class="kbd">${modKey}+E</span> Edit • <span class="kbd">${modKey}+R</span> Delete • <span class="kbd">${modKey}+P</span> Partials </br> <span class="kbd">Esc</span> Close
        </div>
        <div class="badge-legend">
          <div class="legend-item">
            <span class="badge badge-param">P</span>
            <span>Parameters</span>
          </div>
          <div class="legend-item">
            <span class="badge badge-partial">P</span>
            <span>Partials</span>
          </div>
        </div>
      </div>
    `;
    }

    renderResults(prompts: SearchResult[], selectedIndex: number, modKey: string) {
        const container = document.getElementById('results-container');
        if (!container) return;

        let html = '';

        if (prompts.length === 0) {
            html = `
        <div class="empty-state">
          <h3>No prompts found</h3>
          <p>Press ${modKey}+N to create your first prompt</p>
        </div>
      `;
        } else {
            html = '<div class="results">';
            prompts.forEach((result, index) => {
                const prompt = result.prompt;
                const preview = prompt.content.substring(0, 100).replace(/\n/g, ' ');
                const selected = index === selectedIndex ? 'selected' : '';

                // Create badges for params and partials
                const paramBadge = prompt.parameters.length > 0 ?
                    `<span class="badge badge-param">${prompt.parameters.length}P</span>` : '';
                const partialsBadge = prompt.partials.length > 0 ?
                    `<span class="badge badge-partial">${prompt.partials.length}P</span>` : '';

                html += `
          <div class="result-item ${selected}" data-index="${index}">
            <div class="result-title">
              <div class="badge-container">
                ${prompt.tag ? `<span class="badge badge-primary result-tag">${prompt.tag}</span>` : ''}
                ${paramBadge}
                ${partialsBadge}
              </div>
              ${prompt.title}
            </div>
            <div class="result-preview">${preview}...</div>
          </div>
        `;
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    scrollToSelected() {
        const selectedElement = document.querySelector('.result-item.selected');
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    applyTheme(theme: string) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            this.updateThemeToggleIcon('☀️');
        } else {
            document.body.classList.remove('dark');
            this.updateThemeToggleIcon('🌙');
        }
    }

    updateThemeToggleIcon(icon: string) {
        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.textContent = icon;
        }
    }

    showToast(message: string, duration: number = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
      <div class="toast-icon">⚠️</div>
      <div class="toast-message">${message}</div>
    `;

        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.add('slide-out');
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }
    }

    showDeleteConfirmation(prompt: Prompt, onConfirm: () => Promise<void>, onCancel: () => void) {
        const app = document.getElementById('app');
        if (!app) return;

        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';

        const dialogContent = document.createElement('div');
        dialogContent.className = 'modal-dialog';

        dialogContent.innerHTML = `
      <h3 class="modal-title">Delete Prompt?</h3>
      <div class="modal-content">
        <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
          Are you sure you want to delete this prompt?
        </div>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
          <div style="font-weight: 600; color: #007AFF; font-size: 12px; margin-bottom: 4px;">${prompt.tag || 'No tag'}</div>
          <div style="font-weight: 500; color: #333; font-size: 14px;">${prompt.title}</div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="delete-cancel" class="btn btn-secondary">Cancel</button>
        <button id="delete-confirm" class="btn btn-primary" style="background: #FF3B30;">Delete</button>
      </div>
    `;

        dialog.appendChild(dialogContent);
        app.appendChild(dialog);

        const cancelBtn = document.getElementById('delete-cancel');
        const confirmBtn = document.getElementById('delete-confirm');

        setTimeout(() => cancelBtn?.focus(), 50);

        const cleanup = () => {
            dialog.remove();
            onCancel(); // Return focus
        };

        cancelBtn?.addEventListener('click', cleanup);

        confirmBtn?.addEventListener('click', async () => {
            dialog.remove();
            await onConfirm();
        });

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (document.activeElement === confirmBtn) {
                    confirmBtn?.click();
                } else {
                    cancelBtn?.click();
                }
            }
        });
    }

    showParameterDialog(
        prompt: Prompt,
        options: {
            onCopy: (values: { params: Record<string, string>, pickers: Record<string, string> }) => void;
            onCopyRaw: (values: { params: Record<string, string>, pickers: Record<string, string> }) => void;
            onCancel: () => void;
            loadOptionsForPicker: (path: string) => Promise<Array<{ path: string }>>;
        }
    ) {
        const app = document.getElementById('app');
        if (!app) return;

        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';

        const dialogContent = document.createElement('div');
        dialogContent.className = 'modal-dialog';

        let html = `
      <h3 class="modal-title">Configure Prompt</h3>
      <div class="modal-content">
    `;

        // 1. Partial Pickers
        if (prompt.partialPickers && prompt.partialPickers.length > 0) {
            html += `<div class="section-title" style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 8px; text-transform: uppercase;">Options</div>`;

            prompt.partialPickers.forEach(picker => {
                html += `
          <div class="form-group">
            <label class="form-label">Select ${picker.path}</label>
            <select id="picker-${picker.path}" class="form-select" disabled>
              <option>Loading...</option>
            </select>
          </div>
        `;
            });

            html += `<div style="margin-bottom: 16px;"></div>`;
        }

        // 2. Parameters
        if (prompt.parameters.length > 0) {
            html += `<div class="section-title" style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 8px; text-transform: uppercase;">Parameters</div>`;
            prompt.parameters.forEach(param => {
                html += `
          <div class="form-group">
            <label class="form-label">${param}</label>
            <input type="text" id="param-${param}" class="form-input" />
          </div>
        `;
            });
        }

        html += `
      </div>
      <div class="modal-actions">
        <button id="param-cancel" class="btn btn-secondary">Cancel</button>
        <button id="param-copy-raw" class="btn btn-secondary" style="background: #666; color: white;">Copy with Placeholders</button>
        <button id="param-copy" class="btn btn-primary">Copy</button>
      </div>
    `;

        dialogContent.innerHTML = html;
        dialog.appendChild(dialogContent);
        app.appendChild(dialog);

        // Populate pickers
        if (prompt.partialPickers && prompt.partialPickers.length > 0) {
            prompt.partialPickers.forEach(async (picker) => {
                try {
                    const optionsList = await options.loadOptionsForPicker(picker.path);
                    const select = document.getElementById(`picker-${picker.path}`) as HTMLSelectElement;
                    if (select) {
                        const defaultOption = picker.defaultPath ? picker.defaultPath : (optionsList.length > 0 ? optionsList[0].path : '');

                        select.innerHTML = optionsList.map(opt => {
                            const fileName = opt.path.split('.').pop() || opt.path;
                            const isSelected = opt.path === defaultOption ? 'selected' : '';
                            return `<option value="${opt.path}" ${isSelected}>${fileName}</option>`;
                        }).join('');
                        select.disabled = false;
                    }
                } catch (e) {
                    console.error(`Failed to load options for ${picker.path}`, e);
                }
            });
        }

        const getValues = () => {
            const params: Record<string, string> = {};
            const pickers: Record<string, string> = {};

            prompt.parameters.forEach(param => {
                const input = document.getElementById(`param-${param}`) as HTMLInputElement;
                if (input) params[param] = input.value;
            });

            if (prompt.partialPickers) {
                prompt.partialPickers.forEach(picker => {
                    const select = document.getElementById(`picker-${picker.path}`) as HTMLSelectElement;
                    if (select) pickers[picker.path] = select.value;
                });
            }

            return { params, pickers };
        };

        // Event Bindings
        document.getElementById('param-cancel')?.addEventListener('click', () => {
            dialog.remove();
            options.onCancel();
        });

        document.getElementById('param-copy')?.addEventListener('click', () => {
            options.onCopy(getValues());
            dialog.remove();
        });

        document.getElementById('param-copy-raw')?.addEventListener('click', () => {
            options.onCopyRaw(getValues());
            dialog.remove();
        });

        // Enter key support
        const inputs = dialog.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('keydown', (e) => {
                if ((e as KeyboardEvent).key === 'Enter') {
                    e.preventDefault();
                    options.onCopy(getValues());
                    dialog.remove();
                } else if ((e as KeyboardEvent).key === 'Escape') {
                    e.preventDefault();
                    dialog.remove();
                    options.onCancel();
                }
            });
        });

        // Focus first input
        setTimeout(() => {
            const firstField = dialog.querySelector('select:not([disabled]), input') as HTMLElement;
            firstField?.focus();
        }, 100);
    }
}
