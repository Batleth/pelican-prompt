import { Prompt, Partial } from '../../types';
import '../styles/design-system.css';
import '../styles/editor.css';

// Platform-aware modifier key
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? 'Cmd' : 'Ctrl';

let currentPrompt: Prompt | null = null;
let autocompleteDiv: HTMLDivElement | null = null;
let autocompleteSelectedIndex = 0;
let autocompletePartials: Partial[] = [];
let isSaving = false;
let isPartial = false; // Track if editing a partial vs a prompt

type ToastType = 'error' | 'success' | 'warning';

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

function showToast(type: ToastType, title: string, message: string, duration: number = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    error: '❌',
    success: '✅',
    warning: '⚠️'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close">×</button>
  `;

  container.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn?.addEventListener('click', () => {
    toast.classList.add('slide-out');
    setTimeout(() => toast.remove(), 300);
  });

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('slide-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
}

function initialize() {
  render();
  setupEventListeners();

  // Listen for prompt loading from main process
  window.electronAPI.onLoadPrompt((prompt) => {
    currentPrompt = prompt;
    // Check if this is a partial (no tag and either has /partials/ in path or is new-partial)
    isPartial = !prompt.tag && (prompt.filePath.includes('/partials/') || prompt.id === 'new-partial');
    render();
  });
}

function setupEventListeners() {
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const contentTextarea = document.getElementById('content-textarea') as HTMLTextAreaElement;

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await savePrompt();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (isPartial) {
        window.electronAPI.closeAndOpenPartials();
      } else {
        window.electronAPI.closeAndOpenSearch();
      }
    });
  }

  // Add ESC key handler to close window and Cmd+S to save
  document.addEventListener('keydown', (e) => {
    // Cmd+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      savePrompt();
      return;
    }
    
    // ESC to close
    if (e.key === 'Escape' && (!autocompleteDiv || autocompleteDiv.classList.contains('is-hidden'))) {
      e.preventDefault();
      if (isPartial) {
        window.electronAPI.closeAndOpenPartials();
      } else {
        window.electronAPI.closeAndOpenSearch();
      }
    }
  });

  if (contentTextarea) {
    contentTextarea.addEventListener('input', (e) => {
      updateParameterInfo();
      renderFooter();
      handleAutocomplete(e);
    });

    contentTextarea.addEventListener('keydown', (e) => {
      if (autocompleteDiv && !autocompleteDiv.classList.contains('is-hidden')) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          autocompleteSelectedIndex = Math.min(autocompleteSelectedIndex + 1, autocompletePartials.length - 1);
          renderAutocomplete();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          autocompleteSelectedIndex = Math.max(autocompleteSelectedIndex - 1, 0);
          renderAutocomplete();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertAutocomplete();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hideAutocomplete();
        }
      }
    });
  }
}

function extractParameters(content: string): string[] {
  const paramRegex = /\[([A-Z_]+)\]/g;
  const parameters: string[] = [];
  let match;
  
  while ((match = paramRegex.exec(content)) !== null) {
    if (!parameters.includes(match[1])) {
      parameters.push(match[1]);
    }
  }
  
  return parameters;
}

function extractPartials(content: string): string[] {
  const partialRegex = /\{\{>\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  const partials: string[] = [];
  let match;
  
  while ((match = partialRegex.exec(content)) !== null) {
    if (!partials.includes(match[1])) {
      partials.push(match[1]);
    }
  }
  
  return partials;
}

async function handleAutocomplete(e: Event) {
  const textarea = e.target as HTMLTextAreaElement;
  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = textarea.value.substring(0, cursorPos);
  
  // Check if we're typing {{>
  const match = textBeforeCursor.match(/\{\{>\s*([a-zA-Z0-9_.-]*)$/);
  
  if (match) {
    const prefix = match[1];
    const allPartials = await window.electronAPI.getAllPartials();
    
    // Filter partials by prefix
    autocompletePartials = allPartials.filter(p => 
      p.path.toLowerCase().startsWith(prefix.toLowerCase())
    ).slice(0, 20); // Max 20 suggestions
    
    if (autocompletePartials.length > 0) {
      autocompleteSelectedIndex = 0;
      showAutocomplete(textarea, cursorPos);
    } else {
      hideAutocomplete();
    }
  } else {
    hideAutocomplete();
  }
}

function showAutocomplete(textarea: HTMLTextAreaElement, cursorPos: number) {
  if (!autocompleteDiv) {
    autocompleteDiv = document.createElement('div');
    autocompleteDiv.className = 'autocomplete-dropdown positioned-dynamic is-hidden';
    document.body.appendChild(autocompleteDiv);
  }
  
  // Position below cursor
  const rect = textarea.getBoundingClientRect();
  const textareaStyles = window.getComputedStyle(textarea);
  const lineHeight = parseInt(textareaStyles.lineHeight || '20');
  
  // Rough estimate of cursor position (this is approximate)
  const lines = textarea.value.substring(0, cursorPos).split('\n').length;
  const top = rect.top + (lines * lineHeight);
  
  document.documentElement.style.setProperty('--dynamic-left', `${rect.left + 20}px`);
  document.documentElement.style.setProperty('--dynamic-top', `${top}px`);
  autocompleteDiv.classList.remove('is-hidden');
  
  renderAutocomplete();
}

function renderAutocomplete() {
  if (!autocompleteDiv) return;
  
  const items = autocompletePartials.map((partial, index) => {
    const preview = partial.content.substring(0, 60).replace(/\n/g, ' ');
    const selectedClass = index === autocompleteSelectedIndex ? 'is-active' : '';
    return `
      <div class="autocomplete-item ${selectedClass}" data-index="${index}">
        <div>${partial.path}</div>
        <div style="font-size: 10px; color: #666; margin-top: 2px;">${preview}...</div>
      </div>
    `;
  }).join('');
  
  const total = autocompletePartials.length;
  const more = total > 20 ? `<div style="padding: 6px 10px; color: #999; font-size: 11px;">... and more</div>` : '';
  
  autocompleteDiv.innerHTML = items + more;
  
  // Add click handlers
  autocompleteDiv.querySelectorAll('[data-index]').forEach(el => {
    el.addEventListener('click', () => {
      const index = parseInt((el as HTMLElement).dataset.index || '0');
      autocompleteSelectedIndex = index;
      insertAutocomplete();
    });
  });
}

function insertAutocomplete() {
  const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
  if (!textarea || autocompletePartials.length === 0) return;
  
  const partial = autocompletePartials[autocompleteSelectedIndex];
  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = textarea.value.substring(0, cursorPos);
  const textAfterCursor = textarea.value.substring(cursorPos);
  
  // Find the {{> and replace up to cursor
  const match = textBeforeCursor.match(/\{\{>\s*([a-zA-Z0-9_.-]*)$/);
  if (match) {
    const startPos = cursorPos - match[0].length;
    const newText = textBeforeCursor.substring(0, startPos) + `{{> ${partial.path}}}` + textAfterCursor;
    textarea.value = newText;
    textarea.selectionStart = textarea.selectionEnd = startPos + `{{> ${partial.path}}}`.length;
    
    // Trigger input event to update parameter info
    textarea.dispatchEvent(new Event('input'));
  }
  
  hideAutocomplete();
}

function hideAutocomplete() {
  if (autocompleteDiv) {
    autocompleteDiv.classList.add('is-hidden');
  }
}

function updateParameterInfo() {
  const contentTextarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
  const paramInfo = document.getElementById('param-info');
  
  if (!contentTextarea || !paramInfo) return;

  const content = contentTextarea.value;
  const parameters = extractParameters(content);

  if (parameters.length > 0) {
    paramInfo.innerHTML = `
      <strong>Parameters detected:</strong>
      <ul class="param-list">
        ${parameters.map(p => `<li>${p}</li>`).join('')}
      </ul>
    `;
    paramInfo.classList.remove('is-hidden');
  } else {
    paramInfo.classList.add('is-hidden');
  }
}

async function savePrompt() {
  // Prevent multiple simultaneous saves
  if (isSaving) {
    console.log('Save already in progress, ignoring duplicate request');
    return;
  }

  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  const tagInput = document.getElementById('tag-input') as HTMLInputElement;
  const titleInput = document.getElementById('title-input') as HTMLInputElement;
  const contentTextarea = document.getElementById('content-textarea') as HTMLTextAreaElement;

  if (!tagInput || !titleInput || !contentTextarea || !saveBtn) return;

  const tag = tagInput.value.trim();
  const title = titleInput.value.trim();
  const content = contentTextarea.value.trim();

  // For partials, tag is optional (can be empty)
  if (!title || !content) {
    showToast('error', 'Missing Fields', 'Please fill in all required fields (title and content).');
    return;
  }

  // For prompts (not partials), validate tag
  if (!isPartial) {
    if (!tag) {
      showToast('error', 'Missing Tag', 'Please enter a tag for this prompt.');
      return;
    }

    // Validate tag (letters, numbers, underscores, hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      showToast('error', 'Invalid Tag', 'Tag can only contain letters, numbers, underscores, and hyphens.');
      return;
    }

    // Validate tag depth (max 5 levels)
    const tagSegments = tag.split('-');
    if (tagSegments.length > 5) {
      showToast('error', 'Tag Too Deep', 'Tag hierarchy cannot exceed 5 levels (e.g., com-mail-formal-de-business).');
      return;
    }

    // Validate title for prompts (no special characters except spaces, hyphens, underscores)
    if (!/^[a-zA-Z0-9_\s-]+$/.test(title)) {
      showToast('error', 'Invalid Title', 'Title can contain letters, numbers, spaces, hyphens, and underscores.');
      return;
    }
  } else {
    // Validate partial path (dots, letters, numbers, hyphens, underscores)
    if (!/^[a-zA-Z0-9_.-]+$/.test(title)) {
      showToast('error', 'Invalid Partial Path', 'Partial path can contain letters, numbers, dots, hyphens, and underscores.');
      return;
    }
  }

  // Set saving flag and disable button
  isSaving = true;
  saveBtn.disabled = true;
  saveBtn.textContent = isPartial ? 'Saving...' : 'Saving...';

  try {
    const existingPath = currentPrompt?.filePath;
    let newPath: string;
    
    if (isPartial) {
      // Save as partial
      newPath = await window.electronAPI.savePartial(title, content, existingPath);
    } else {
      // Save as prompt
      newPath = await window.electronAPI.savePrompt(tag, title, content, existingPath);
    }
    
    const successMsg = isPartial ? 'Partial saved successfully.' : 'Prompt saved successfully.';
    showToast('success', 'Saved!', successMsg, 1500);
    
    // Wait a bit before closing to ensure user sees success message
    setTimeout(() => {
      isSaving = false;
      window.electronAPI.closeWindow();
    }, 1500);
  } catch (error: any) {
    // Re-enable save button and reset flag
    isSaving = false;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Prompt';
    
    const errorMsg = error?.message || String(error);
    showToast('error', 'Save Failed', errorMsg, 7000);
    console.error('Error saving prompt:', error);
  }
}

function renderFooter() {
  const footer = document.getElementById('editor-footer');
  if (!footer) return;

  const contentTextarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
  const content = contentTextarea?.value || currentPrompt?.content || '';

  // Extract parameters and partials from current content
  const parameters = extractParameters(content);
  const partials = extractPartials(content);

  const paramCount = parameters.length;
  const partialCount = partials.length;

  footer.innerHTML = `
    <div class="footer-left">
      <div class="keyboard-hint">
        <span class="kbd">${modKey}+S</span> Save • <span class="kbd">Esc</span> Cancel
      </div>
      <div class="footer-hint">
        Use <span class="hint-param">[PARAM_NAME]</span> for dynamic parameters • Use <span class="hint-partial">{{> partial.path}}</span> to include partials
      </div>
    </div>
    <div class="footer-right">
      ${paramCount > 0 ? `
        <div class="footer-badge-item">
          <span class="badge badge-param">${paramCount}</span>
          <span>Parameter${paramCount !== 1 ? 's' : ''}</span>
        </div>
      ` : ''}
      ${partialCount > 0 ? `
        <div class="footer-badge-item">
          <span class="badge badge-partial">${partialCount}</span>
          <span>Partial${partialCount !== 1 ? 's' : ''}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function render() {
  const editor = document.getElementById('editor');
  const editorTitle = document.getElementById('editor-title');
  const saveBtn = document.getElementById('save-btn');
  
  if (!editor) return;

  // Update header and button text based on whether editing partial or prompt
  if (editorTitle) {
    editorTitle.textContent = isPartial ? 'Partial Editor' : 'Prompt Editor';
  }
  if (saveBtn) {
    saveBtn.textContent = isPartial ? 'Save Partial' : 'Save Prompt';
  }

  const tag = currentPrompt?.tag || '';
  const title = currentPrompt?.title || '';
  const content = currentPrompt?.content || '';

  // Different layout for partials vs prompts
  if (isPartial) {
    // For existing partials, make path readonly; for new partials, allow editing
    const isExistingPartial = currentPrompt?.filePath ? true : false;
    const readonlyAttr = isExistingPartial ? 'readonly style="background: #f5f5f5;"' : '';
    const pathHint = isExistingPartial 
      ? 'Dot notation path for the partial (read-only)' 
      : 'Enter dot notation path (e.g., tones.urgent, formats.email)';
    
    editor.innerHTML = `
      <div class="form-group">
        <label for="title-input">Partial Path</label>
        <input type="text" id="title-input" class="form-input" value="${title}" placeholder="tones.urgent" ${readonlyAttr} />
        <div class="form-hint">${pathHint}</div>
      </div>
      
      <!-- Hidden tag input for partials -->
      <input type="hidden" id="tag-input" value="" />
      
      <div class="section-divider"></div>
      
      <div id="param-info" class="param-info" style="display: none;"></div>
      
      <div class="form-group content-group">
        <label for="content-textarea">Content</label>
        <textarea id="content-textarea" class="form-textarea" placeholder="Enter the partial content here...

Note: Partials cannot contain other partials (no {{> }} syntax allowed).">${content}</textarea>
      </div>
    `;
  } else {
    editor.innerHTML = `
      <!-- Metadata Row: Two-column grid -->
      <div class="metadata-grid">
        <div class="form-group">
          <label for="tag-input">Tag</label>
          <input type="text" id="tag-input" class="form-input" value="${tag}" placeholder="com-mail" />
          <div class="form-hint">Hierarchical tag using hyphens (e.g., com-mail-formal, code-python-async). Max 5 levels.</div>
        </div>
        <div class="form-group">
          <label for="title-input">Title</label>
          <input type="text" id="title-input" class="form-input" value="${title}" placeholder="My Prompt Title" />
          <div class="form-hint">Descriptive name for your prompt</div>
        </div>
      </div>
      
      <!-- Visual separator -->
      <div class="section-divider"></div>
      
      <div id="param-info" class="param-info" style="display: none;"></div>
      
      <!-- Content Area -->
      <div class="form-group content-group">
        <label for="content-textarea">Content</label>
        <textarea id="content-textarea" class="form-textarea" placeholder="Enter your prompt here...

You can use parameters like [PARAM_NAME] that will be replaced when using the prompt.
You can also reference partials like {{> formats.email}} to reuse common content.">${content}</textarea>
      </div>
    `;
  }

  setupEventListeners();
  renderFooter();
  updateParameterInfo();

  // Focus on appropriate field
  if (!currentPrompt) {
    if (isPartial) {
      // For new partials, focus on title (path) input first
      const titleInput = document.getElementById('title-input') as HTMLInputElement;
      titleInput?.focus();
    } else {
      const tagInput = document.getElementById('tag-input') as HTMLInputElement;
      tagInput?.focus();
    }
  } else {
    const contentTextarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
    contentTextarea?.focus();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initialize();
});
