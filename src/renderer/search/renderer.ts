import { Prompt, SearchResult } from '../../types';

let prompts: SearchResult[] = [];
let selectedIndex = 0;
let hasPromptsFolder = false;

async function initialize() {
  const folder = await window.electronAPI.getPromptsFolder();
  hasPromptsFolder = !!folder;

  if (hasPromptsFolder) {
    await loadPrompts();
  }

  render();
  updateFolderDisplay();
  setupVisibilityReload();
}

// Setup visibility change listeners to reload prompts when window becomes visible
function setupVisibilityReload() {
  // This function is called during initialization
  // The actual reload is triggered by the 'reload-prompts' IPC event
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
  const folderPathElement = document.getElementById('folder-path');
  
  if (folderPathElement) {
    if (folderPath) {
      folderPathElement.textContent = folderPath;
      folderPathElement.title = folderPath;
    } else {
      folderPathElement.textContent = 'No folder selected - Click "Change Folder" to get started';
      folderPathElement.title = '';
    }
  }
}

function setupEventListeners() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const changeFolderBtn = document.getElementById('change-folder-btn') as HTMLButtonElement;
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
      await window.electronAPI.openFolderInFilesystem();
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
          window.electronAPI.openEditor(prompts[selectedIndex].prompt.filePath);
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
    // Copy directly to clipboard
    await window.electronAPI.copyToClipboard(prompt.content);
    window.electronAPI.hideWindow();
  }
}

function showParameterDialog(prompt: Prompt) {
  const app = document.getElementById('app');
  if (!app) return;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  const dialogContent = document.createElement('div');
  dialogContent.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 12px;
    width: 500px;
    max-width: 90%;
  `;

  let html = `
    <h3 style="margin-bottom: 16px; font-size: 18px;">Fill in Parameters</h3>
    <div style="margin-bottom: 16px;">
  `;

  prompt.parameters.forEach(param => {
    html += `
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">${param}</label>
        <input type="text" id="param-${param}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" />
      </div>
    `;
  });

  html += `
    </div>
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="param-cancel" style="padding: 8px 16px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
      <button id="param-copy-raw" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer;">Copy with Placeholders</button>
      <button id="param-copy" style="padding: 8px 16px; background: #007AFF; color: white; border: none; border-radius: 6px; cursor: pointer;">Copy</button>
    </div>
  `;

  dialogContent.innerHTML = html;
  dialog.appendChild(dialogContent);
  app.appendChild(dialog);

  // Copy handler function (Copy with Placeholders behavior)
  const handleCopy = async () => {
    let content = prompt.content;
    const params: string[] = [];
    
    prompt.parameters.forEach(param => {
      const input = document.getElementById(`param-${param}`) as HTMLInputElement;
      const value = input?.value || '';
      if (value) {
        params.push(`${param}=${value}`);
      } else {
        params.push(`${param}=`);
      }
    });

    if (params.length > 0) {
      content += '\n\n' + params.join('\n');
    }

    await window.electronAPI.copyToClipboard(content);
    dialog.remove();
    window.electronAPI.hideWindow();
  };

  // Add Enter key support to all input fields
  prompt.parameters.forEach(param => {
    const input = document.getElementById(`param-${param}`) as HTMLInputElement;
    if (input) {
      console.log('Adding keydown listener to:', param);
      input.addEventListener('keydown', (e) => {
        console.log('Key pressed in input:', e.key);
        if (e.key === 'Enter') {
          e.preventDefault();
          console.log('Enter pressed, copying...');
          handleCopy();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          dialog.remove();
        }
      });
    } else {
      console.warn('Could not find input for param:', param);
    }
  });

  // Add Escape key to close dialog
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dialog.remove();
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
  });

  document.getElementById('param-copy-raw')?.addEventListener('click', async () => {
    let content = prompt.content;
    const params: string[] = [];
    
    prompt.parameters.forEach(param => {
      const input = document.getElementById(`param-${param}`) as HTMLInputElement;
      const value = input?.value || '';
      if (value) {
        params.push(`${param}=${value}`);
      } else {
        params.push(`${param}=`);
      }
    });

    if (params.length > 0) {
      content += '\n\n' + params.join('\n');
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
        <span class="folder-path" id="folder-path">Loading...</span>
        <div style="display: flex; gap: 8px;">
          <button class="change-folder-btn" id="open-folder-btn">Open in Filesystem</button>
          <button class="change-folder-btn" id="change-folder-btn">Change Folder</button>
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
    <div id="results-container"></div>
    <div class="footer">
      <div class="keyboard-hint">
        ↑↓ Navigate • Enter Select • Cmd+N New • Cmd+E Edit • Esc Close
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
        <p>Press Cmd+N to create your first prompt</p>
      </div>
    `;
  } else {
    html = '<div class="results">';
    prompts.forEach((result, index) => {
      const prompt = result.prompt;
      const preview = prompt.content.substring(0, 100).replace(/\n/g, ' ');
      const selected = index === selectedIndex ? 'selected' : '';
      const paramBadge = prompt.parameters.length > 0 ? 
        `<span class="param-badge">${prompt.parameters.length} param${prompt.parameters.length > 1 ? 's' : ''}</span>` : '';
      
      html += `
        <div class="result-item ${selected}" data-index="${index}">
          <div class="result-title">
            ${prompt.tag ? `<span class="result-tag">${prompt.tag}</span>` : ''}
            ${prompt.title}
            ${paramBadge}
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
document.addEventListener('DOMContentLoaded', initialize);

// Re-focus when window becomes visible
window.addEventListener('focus', async () => {
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

