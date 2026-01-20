import { Prompt } from '../../types';

let currentPrompt: Prompt | null = null;

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

  if (contentTextarea) {
    contentTextarea.addEventListener('input', () => {
      updateParameterInfo();
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

You can use parameters like [PARAM_NAME] that will be replaced when using the prompt.">${content}</textarea>
      <div class="hint">Use [PARAM_NAME] syntax for dynamic parameters (must be uppercase with underscores)</div>
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
