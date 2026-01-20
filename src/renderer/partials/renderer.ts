import { Partial } from '../../types';

let partials: Partial[] = [];
let filteredPartials: Partial[] = [];
let selectedIndex = 0;

const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const partialsList = document.getElementById('partialsList') as HTMLDivElement;
const newPartialBtn = document.getElementById('newPartialBtn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
const partialCount = document.getElementById('partialCount') as HTMLDivElement;

// Initialize theme
async function initTheme() {
  const theme = await window.electronAPI.getTheme();
  applyTheme(theme);
  
  // Listen for theme changes
  window.electronAPI.onThemeChanged((theme) => {
    applyTheme(theme);
  });
}

function applyTheme(theme: string) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

// Load all partials on startup
async function loadPartials(): Promise<void> {
  partials = await window.electronAPI.getAllPartials();
  filteredPartials = [...partials];
  selectedIndex = 0;
  renderPartials();
}

// Filter partials based on search query
function filterPartials(query: string): void {
  if (!query.trim()) {
    filteredPartials = [...partials];
  } else {
    const lowerQuery = query.toLowerCase();
    filteredPartials = partials.filter(p => 
      p.path.toLowerCase().includes(lowerQuery) ||
      p.content.toLowerCase().includes(lowerQuery)
    );
  }
  selectedIndex = 0;
  renderPartials();
}

// Render the partials list
function renderPartials(): void {
  if (filteredPartials.length === 0) {
    partialsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <div>No partials found</div>
        <div style="margin-top: 8px; font-size: 11px;">Create your first partial to get started</div>
      </div>
    `;
    partialCount.textContent = '0 partials';
    return;
  }

  partialsList.innerHTML = filteredPartials
    .map((partial, index) => {
      const preview = partial.content.length > 100 
        ? partial.content.substring(0, 100) + '...'
        : partial.content;
      
      return `
        <div class="partial-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
          <div class="partial-info">
            <div class="partial-path">{{&gt; ${partial.path}}}</div>
            <div class="partial-preview">${escapeHtml(preview)}</div>
          </div>
          <div class="partial-actions">
            <button class="btn-secondary btn-small edit-btn" data-index="${index}">Edit</button>
          </div>
        </div>
      `;
    })
    .join('');

  // Update count
  const total = partials.length;
  const showing = filteredPartials.length;
  partialCount.textContent = showing === total 
    ? `${total} partial${total === 1 ? '' : 's'}`
    : `${showing} of ${total} partials`;

  // Add click listeners
  document.querySelectorAll('.partial-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('edit-btn')) {
        return; // Let the edit button handle this
      }
      const index = parseInt((el as HTMLElement).dataset.index || '0');
      selectPartial(index);
    });
  });

  document.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt((btn as HTMLElement).dataset.index || '0');
      editPartial(index);
    });
  });
}

// Select a partial by index
function selectPartial(index: number): void {
  selectedIndex = index;
  renderPartials();
}

// Edit a partial
function editPartial(index: number): void {
  const partial = filteredPartials[index];
  if (partial) {
    // Convert partial to a Prompt-like object for the editor
    // Partials don't have tags, so we'll use an empty string
    window.electronAPI.openEditor({
      id: partial.filePath,
      tag: '', // Partials don't use tags
      title: partial.path,
      content: partial.content,
      parameters: [],
      partials: [],
      filePath: partial.filePath
    });
  }
}

// Show input dialog for new partial
function showInputDialog(): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.getElementById('input-dialog') as HTMLDivElement;
    const input = document.getElementById('dialog-input') as HTMLInputElement;
    const confirmBtn = document.getElementById('dialog-confirm') as HTMLButtonElement;
    const cancelBtn = document.getElementById('dialog-cancel') as HTMLButtonElement;
    
    // Show dialog
    dialog.style.display = 'flex';
    input.value = '';
    input.focus();
    
    // Handle confirm
    const handleConfirm = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };
    
    // Handle cancel
    const handleCancel = () => {
      cleanup();
      resolve(null);
    };
    
    // Handle Enter key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    
    // Cleanup function
    const cleanup = () => {
      dialog.style.display = 'none';
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      input.removeEventListener('keydown', handleKeyDown);
    };
    
    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    input.addEventListener('keydown', handleKeyDown);
  });
}

// Create a new partial
async function createNewPartial(): Promise<void> {
  const promptsFolder = await window.electronAPI.getPromptsFolder();
  if (!promptsFolder) {
    alert('Please select a prompts folder first');
    return;
  }

  // Open editor with empty partial
  window.electronAPI.openEditor({
    id: 'new-partial', // Signal that this is a new partial
    tag: '', // Partials don't use tags
    title: '', // User will define the path in the editor
    content: '',
    parameters: [],
    partials: [],
    filePath: '' // Empty means new file, will be saved to partials folder
  });
}

// Escape HTML for safe rendering
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle keyboard navigation
searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (selectedIndex < filteredPartials.length - 1) {
      selectedIndex++;
      renderPartials();
      scrollToSelected();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndex > 0) {
      selectedIndex--;
      renderPartials();
      scrollToSelected();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filteredPartials.length > 0) {
      editPartial(selectedIndex);
    }
  } else if (e.key === 'Escape') {
    window.close();
  }
});

// Handle search input
searchInput.addEventListener('input', (e: Event) => {
  const query = (e.target as HTMLInputElement).value;
  filterPartials(query);
});

// Scroll to selected item
function scrollToSelected(): void {
  const selected = partialsList.querySelector('.partial-item.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Button handlers
newPartialBtn.addEventListener('click', createNewPartial);
refreshBtn.addEventListener('click', loadPartials);

// Handle window focus to ensure ESC works after editor closes and refresh partials list
window.addEventListener('focus', () => {
  loadPartials(); // Refresh partials list in case new partial was created
  searchInput.focus();
});

// Add global ESC handler as backup
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    window.close();
  }
});

// Load partials on startup
initTheme();
loadPartials();
