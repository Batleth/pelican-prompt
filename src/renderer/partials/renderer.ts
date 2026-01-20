import { Partial } from '../../types';

let partials: Partial[] = [];
let filteredPartials: Partial[] = [];
let selectedIndex = 0;

const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const partialsList = document.getElementById('partialsList') as HTMLDivElement;
const newPartialBtn = document.getElementById('newPartialBtn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
const partialCount = document.getElementById('partialCount') as HTMLDivElement;

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
    window.electronAPI.openEditor({
      title: partial.path,
      content: partial.content,
      tags: [],
      parameters: [],
      partials: [],
      filePath: partial.filePath
    });
  }
}

// Create a new partial
async function createNewPartial(): Promise<void> {
  const promptsFolder = await window.electronAPI.getPromptsFolder();
  if (!promptsFolder) {
    alert('Please select a prompts folder first');
    return;
  }

  // Prompt for partial path (dot notation)
  const pathInput = prompt('Enter partial path (e.g., tones.friendly or formats.email):');
  if (!pathInput) return;

  // Validate path
  const validation = await window.electronAPI.validatePartialPath(pathInput);
  if (!validation.valid) {
    alert(`Invalid partial path: ${validation.error}`);
    return;
  }

  // Open editor with new partial
  window.electronAPI.openEditor({
    title: pathInput,
    content: '',
    tags: [],
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

// Load partials on startup
loadPartials();
