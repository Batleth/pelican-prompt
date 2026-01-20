import { Prompt, SearchResult } from '../../types';
import '../styles/design-system.css';
import '../styles/search.css';

// Platform-aware modifier key
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? 'Cmd' : 'Ctrl';

let prompts: SearchResult[] = [];
let selectedIndex = 0;
let hasPromptsFolder = false;
let currentTheme = 'light';

// Initialize theme
async function initTheme() {
  currentTheme = await window.electronAPI.getTheme();
  applyTheme(currentTheme);
  
  // Listen for theme changes from other windows
  window.electronAPI.onThemeChanged((theme) => {
    currentTheme = theme;
    applyTheme(theme);
  });
}

function applyTheme(theme: string) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    updateThemeToggleIcon('☀️');
  } else {
    document.body.classList.remove('dark');
    updateThemeToggleIcon('🌙');
  }
}

function updateThemeToggleIcon(icon: string) {
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = icon;
  }
}

async function toggleTheme() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  currentTheme = newTheme;
  await window.electronAPI.setTheme(newTheme);
  applyTheme(newTheme);
  
  // Restore focus to search input after theme toggle
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  if (searchInput) {
    searchInput.focus();
  }
}

function showToast(message: string, duration: number = 4000) {
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

function showDeleteConfirmation(prompt: Prompt) {
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

  // Focus on Cancel button by default
  const cancelBtn = document.getElementById('delete-cancel');
  const confirmBtn = document.getElementById('delete-confirm');
  
  setTimeout(() => cancelBtn?.focus(), 50);

  // Cancel handler
  cancelBtn?.addEventListener('click', () => {
    dialog.remove();
    // Return focus to search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.focus();
  });

  // Confirm delete handler
  confirmBtn?.addEventListener('click', async () => {
    dialog.remove();
    await deletePrompt(prompt);
  });

  // ESC key to cancel
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dialog.remove();
      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      searchInput?.focus();
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

async function deletePrompt(prompt: Prompt) {
  try {
    await window.electronAPI.deletePrompt(prompt.filePath);
    
    // Show success toast
    showToast(`Deleted: ${prompt.title}`, 3000);
    
    // Reload prompts
    await loadPrompts('');
    renderResults();
    
    // Return focus to search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.focus();
  } catch (error: any) {
    showToast(error?.message || 'Failed to delete prompt', 5000);
  }
}

async function initialize() {
  const folder = await window.electronAPI.getPromptsFolder();
  hasPromptsFolder = !!folder;

  if (hasPromptsFolder) {
    await loadPrompts();
  }

  render();
  updateFolderDisplay();
}

async function loadPrompts(query: string = '') {
  if (query.trim() === '') {
    const allPrompts = await window.electronAPI.getAllPrompts();
    prompts = allPrompts.map(p => ({ prompt: p, score: 1 }));
  } else {
    prompts = await window.electronAPI.searchPrompts(query);
  }
  selectedIndex = 0;
}

async function updateFolderDisplay() {
  const folderPath = await window.electronAPI.getPromptsFolder();
  const openFolderBtn = document.getElementById('open-folder-btn');
  const workspaceNameEl = document.getElementById('workspace-name');
  
  if (openFolderBtn) {
    if (folderPath) {
      openFolderBtn.title = folderPath;
    } else {
      openFolderBtn.title = 'No folder selected';
    }
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

function setupEventListeners() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const changeFolderBtn = document.getElementById('change-folder-btn') as HTMLButtonElement;
  const createWorkspaceBtn = document.getElementById('create-workspace-btn') as HTMLButtonElement;
  const openFolderBtn = document.getElementById('open-folder-btn') as HTMLButtonElement;
  
  if (changeFolderBtn) {
    changeFolderBtn.addEventListener('click', async () => {
      const newFolder = await window.electronAPI.selectFolder();
      if (newFolder) {
        hasPromptsFolder = true;
        await loadPrompts();
        renderResults();
        updateFolderDisplay();
      }
    });
  }

  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', async () => {
      try {
        await window.electronAPI.openFolderInFilesystem();
      } catch (error: any) {
        showToast(error?.message || 'Failed to open folder');
      }
    });
  }

  if (createWorkspaceBtn) {
    createWorkspaceBtn.addEventListener('click', async () => {
      try {
        const newFolder = await window.electronAPI.createWorkspace();
        if (newFolder) {
          hasPromptsFolder = true;
          await loadPrompts('');
          render();
          updateFolderDisplay();
          showToast('Workspace created successfully!', 2000);
        }
      } catch (error: any) {
        showToast(error.message || 'Failed to create workspace', 4000);
      }
    });
  }
  
  if (searchInput) {
    searchInput.focus();
    
    searchInput.addEventListener('input', async (e) => {
      const query = (e.target as HTMLInputElement).value;
      await loadPrompts(query);
      renderResults();
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, prompts.length - 1);
        renderResults();
        scrollToSelected();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderResults();
        scrollToSelected();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (prompts.length > 0) {
          selectPrompt(prompts[selectedIndex].prompt);
        }
      } else if (e.key === 'Escape') {
        window.electronAPI.hideWindow();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        window.electronAPI.openEditor();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (prompts.length > 0) {
          window.electronAPI.openEditor(prompts[selectedIndex].prompt);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        window.electronAPI.openPartialsBrowser();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        if (prompts.length > 0) {
          showDeleteConfirmation(prompts[selectedIndex].prompt);
        }
      }
    });
  }

  const selectFolderBtn = document.getElementById('select-folder-btn');
  if (selectFolderBtn) {
    selectFolderBtn.addEventListener('click', async () => {
      const folder = await window.electronAPI.selectFolder();
      if (folder) {
        hasPromptsFolder = true;
        await loadPrompts();
        render();
      }
    });
  }
}

function scrollToSelected() {
  const selectedElement = document.querySelector('.result-item.selected');
  if (selectedElement) {
    selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

async function selectPrompt(prompt: Prompt) {
  if (prompt.parameters.length > 0) {
    // Show parameter dialog
    showParameterDialog(prompt);
  } else {
    // Copy directly to clipboard (resolve partials first)
    const resolved = await window.electronAPI.resolvePartials(prompt.content);
    await window.electronAPI.copyToClipboard(resolved);
    window.electronAPI.hideWindow();
  }
}

function showParameterDialog(prompt: Prompt) {
  const app = document.getElementById('app');
  if (!app) return;

  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay';

  const dialogContent = document.createElement('div');
  dialogContent.className = 'modal-dialog';

  let html = `
    <h3 class="modal-title">Fill in Parameters</h3>
    <div class="modal-content">
  `;

  prompt.parameters.forEach(param => {
    html += `
      <div class="form-group">
        <label class="form-label">${param}</label>
        <input type="text" id="param-${param}" class="form-input" />
      </div>
    `;
  });

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

  // Copy handler function (Copy with Placeholders behavior)
  const handleCopy = async () => {
    // First resolve partials
    let content = await window.electronAPI.resolvePartials(prompt.content);
    const params: string[] = [];
    
    prompt.parameters.forEach(param => {
      const input = document.getElementById(`param-${param}`) as HTMLInputElement;
      const value = input?.value || '';
      if (value) {
        params.push(`[${param}] = ${value}`);
      } else {
        params.push(`[${param}] = `);
      }
    });

    if (params.length > 0) {
      content += '\n\nReplace the following parameters in the prompt above:\n' + params.join('\n');
    }

    await window.electronAPI.copyToClipboard(content);
    dialog.remove();
    window.electronAPI.hideWindow();
  };

  // Add Enter key support to all input fields
  prompt.parameters.forEach(param => {
    const input = document.getElementById(`param-${param}`) as HTMLInputElement;
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          dialog.remove();
        }
      });
    }
  });

  // Add Escape key to close dialog
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dialog.remove();
      // Return focus to search input for keyboard navigation
      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      searchInput?.focus();
    }
  });

  // Focus first input
  setTimeout(() => {
    const firstInput = document.getElementById(`param-${prompt.parameters[0]}`) as HTMLInputElement;
    firstInput?.focus();
  }, 100);

  // Event listeners
  document.getElementById('param-cancel')?.addEventListener('click', () => {
    dialog.remove();
    // Return focus to search input for keyboard navigation
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.focus();
  });

  document.getElementById('param-copy-raw')?.addEventListener('click', async () => {
    // Resolve partials but keep parameter placeholders
    let content = await window.electronAPI.resolvePartials(prompt.content);
    const params: string[] = [];
    
    prompt.parameters.forEach(param => {
      const input = document.getElementById(`param-${param}`) as HTMLInputElement;
      const value = input?.value || '';
      if (value) {
        params.push(`[${param}] = ${value}`);
      } else {
        params.push(`[${param}] = `);
      }
    });

    if (params.length > 0) {
      content += '\n\nReplace the following parameters in the prompt above:\n' + params.join('\n');
    }

    await window.electronAPI.copyToClipboard(content);
    dialog.remove();
    window.electronAPI.hideWindow();
  });

  document.getElementById('param-copy')?.addEventListener('click', handleCopy);
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (!hasPromptsFolder) {
    app.innerHTML = `
      <div class="no-folder">
        <h3>Welcome to Pelican Prompt</h3>
        <p>Select a folder to store your prompts</p>
        <button id="select-folder-btn">Select Folder</button>
      </div>
    `;
    setupEventListeners();
    return;
  }

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
        ↑↓ Navigate • Enter Select • ${modKey}+N New • ${modKey}+E Edit • ${modKey}+R Delete • ${modKey}+P Partials • Esc Close
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

  setupEventListeners();
  renderResults();
}

function renderResults() {
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

  // Add click listeners to result items
  document.querySelectorAll('.result-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      selectedIndex = index;
      selectPrompt(prompts[index].prompt);
    });
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initialize();
  
  // Add theme toggle listener
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
});

// Re-focus when window becomes visible
window.addEventListener('focus', async () => {
  // Clear any existing toasts
  const toastContainer = document.getElementById('toast-container');
  if (toastContainer) {
    toastContainer.innerHTML = '';
  }
  
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  if (searchInput) {
    searchInput.value = ''; // Clear search
  }
  await loadPrompts(''); // Reload all prompts
  renderResults();
  updateFolderDisplay();
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 50);
  }
});

// Listen for reload requests from main process
window.electronAPI.onReloadPrompts(async () => {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  if (searchInput) {
    searchInput.value = ''; // Clear search input
  }
  await loadPrompts(''); // Load all prompts
  renderResults();
});

