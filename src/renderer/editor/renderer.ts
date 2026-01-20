import { Prompt, Partial } from '../../types';

let currentPrompt: Prompt | null = null;
let autocompleteDiv: HTMLDivElement | null = null;
let autocompleteSelectedIndex = 0;
let autocompletePartials: Partial[] = [];

function initialize() {
  render();
  setupEventListeners();

  // Listen for prompt loading from main process
  window.electronAPI.onLoadPrompt((prompt) => {
    currentPrompt = prompt;
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
      window.electronAPI.closeWindow();
    });
  }

  // Add ESC key handler to close window
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !autocompleteDiv?.style.display) {
      window.electronAPI.closeWindow();
    }
  });

  if (contentTextarea) {
    contentTextarea.addEventListener('input', (e) => {
      updateParameterInfo();
      handleAutocomplete(e);
    });

    contentTextarea.addEventListener('keydown', (e) => {
      if (autocompleteDiv && autocompleteDiv.style.display !== 'none') {
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
    autocompleteDiv.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
    `;
    document.body.appendChild(autocompleteDiv);
  }
  
  // Position below cursor
  const rect = textarea.getBoundingClientRect();
  const textareaStyles = window.getComputedStyle(textarea);
  const lineHeight = parseInt(textareaStyles.lineHeight || '20');
  
  // Rough estimate of cursor position (this is approximate)
  const lines = textarea.value.substring(0, cursorPos).split('\n').length;
  const top = rect.top + (lines * lineHeight);
  
  autocompleteDiv.style.left = `${rect.left + 20}px`;
  autocompleteDiv.style.top = `${top}px`;
  autocompleteDiv.style.display = 'block';
  
  renderAutocomplete();
}

function renderAutocomplete() {
  if (!autocompleteDiv) return;
  
  const items = autocompletePartials.map((partial, index) => {
    const preview = partial.content.substring(0, 60).replace(/\n/g, ' ');
    const selected = index === autocompleteSelectedIndex ? 'background: #E3F2FD;' : '';
    return `
      <div style="padding: 6px 10px; cursor: pointer; ${selected}" data-index="${index}">
        <div style="font-weight: 500; color: #333;">${partial.path}</div>
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
    autocompleteDiv.style.display = 'none';
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
    paramInfo.style.display = 'block';
  } else {
    paramInfo.style.display = 'none';
  }
}

async function savePrompt() {
  const tagInput = document.getElementById('tag-input') as HTMLInputElement;
  const titleInput = document.getElementById('title-input') as HTMLInputElement;
  const contentTextarea = document.getElementById('content-textarea') as HTMLTextAreaElement;

  if (!tagInput || !titleInput || !contentTextarea) return;

  const tag = tagInput.value.trim();
  const title = titleInput.value.trim();
  const content = contentTextarea.value.trim();

  if (!tag || !title || !content) {
    alert('Please fill in all fields');
    return;
  }

  // Validate tag (letters, numbers, underscores, hyphens)
  if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
    alert('Tag can only contain letters, numbers, underscores, and hyphens.');
    return;
  }

  // Validate tag depth (max 5 levels)
  const tagSegments = tag.split('-');
  if (tagSegments.length > 5) {
    alert('Tag hierarchy cannot exceed 5 levels (e.g., com-mail-formal-de-business).');
    return;
  }

  // Validate title (no special characters except spaces, hyphens, underscores)
  if (!/^[a-zA-Z0-9_\s-]+$/.test(title)) {
    alert('Title can contain letters, numbers, spaces, hyphens, and underscores.');
    return;
  }

  try {
    const existingPath = currentPrompt?.filePath;
    await window.electronAPI.savePrompt(tag, title, content, existingPath);
    window.electronAPI.closeWindow();
  } catch (error) {
    alert('Error saving prompt: ' + error);
  }
}

function render() {
  const editor = document.getElementById('editor');
  if (!editor) return;

  const tag = currentPrompt?.tag || '';
  const title = currentPrompt?.title || '';
  const content = currentPrompt?.content || '';

  editor.innerHTML = `
    <div class="two-column">
      <div class="form-group">
        <label for="tag-input">Tag</label>
        <input type="text" id="tag-input" value="${tag}" placeholder="com-mail" />
        <div class="hint">Hierarchical tag using hyphens (e.g., com-mail-formal, code-python-async). Max 5 levels.</div>
      </div>
      <div class="form-group">
        <label for="title-input">Title</label>
        <input type="text" id="title-input" value="${title}" placeholder="My Prompt Title" />
        <div class="hint">Descriptive name for your prompt</div>
      </div>
    </div>
    
    <div id="param-info" class="param-info" style="display: none;"></div>
    
    <div class="form-group">
      <label for="content-textarea">Content</label>
      <textarea id="content-textarea" placeholder="Enter your prompt here...

You can use parameters like [PARAM_NAME] that will be replaced when using the prompt.
You can also reference partials like {{> formats.email}} to reuse common content.">${content}</textarea>
      <div class="hint">Use [PARAM_NAME] for dynamic parameters (uppercase with underscores) • Use {{> partial.path}} to include partials</div>
    </div>
  `;

  setupEventListeners();
  updateParameterInfo();

  // Focus on appropriate field
  if (!currentPrompt) {
    const tagInput = document.getElementById('tag-input') as HTMLInputElement;
    tagInput?.focus();
  } else {
    const contentTextarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
    contentTextarea?.focus();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);
