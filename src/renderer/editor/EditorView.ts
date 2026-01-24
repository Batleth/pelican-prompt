import { Prompt, Partial } from '../../types';

export class EditorView {
  private autocompleteDiv: HTMLDivElement | null = null;

  constructor() { }

  render(isPartial: boolean, currentPrompt: Prompt | null) {
    const app = document.getElementById('app');
    if (!app) return;

    const tag = currentPrompt?.tag || '';
    const title = currentPrompt?.title || '';
    const content = currentPrompt?.content || '';
    const isExistingPartial = currentPrompt?.filePath && isPartial;

    // Different layout for partials vs prompts
    let formHtml = '';

    if (isPartial) {
      const readonlyAttr = isExistingPartial ? 'readonly style="background: #f5f5f5;"' : '';
      const pathHint = isExistingPartial
        ? 'Dot notation path for the partial (read-only)'
        : 'Enter dot notation path (e.g., tones.urgent, formats.email)';

      formHtml = `
        <div class="form-group">
          <label for="title-input">Partial Path</label>
          <input type="text" id="title-input" class="form-input" value="${title}" placeholder="tones.urgent" ${readonlyAttr} />
          <div class="form-hint">${pathHint}</div>
        </div>
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
      formHtml = `
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
        <div class="section-divider"></div>
        <div id="param-info" class="param-info" style="display: none;"></div>
        <div class="form-group content-group">
          <label for="content-textarea">Content</label>
          <textarea id="content-textarea" class="form-textarea" placeholder="Enter your prompt here...

You can use parameters like [PARAM_NAME] that will be replaced when using the prompt.
You can also reference partials like {{> formats.email}} to reuse common content.">${content}</textarea>
        </div>
      `;
    }

    const headerTitle = isPartial ? 'Partial Editor' : 'Prompt Editor';
    const saveBtnText = isPartial ? 'Save Partial' : 'Save Prompt';

    app.innerHTML = `
      <div class="editor-layout" id="editor">
        <div class="editor-scroll-area">
            <div class="editor-header">
               <h2 id="editor-title">${headerTitle}</h2>
               <div class="header-actions">
                  <button id="save-btn" class="btn btn-primary">${saveBtnText}</button>
                  <button id="cancel-btn" class="btn btn-secondary">Cancel</button>
               </div>
            </div>
            ${formHtml}
        </div>
        <div class="footer" id="editor-footer"></div>
      </div>
    `;

    // Initial focus
    if (!currentPrompt) {
      if (isPartial) {
        document.getElementById('title-input')?.focus();
      } else {
        document.getElementById('tag-input')?.focus();
      }
    } else {
      document.getElementById('content-textarea')?.focus();
    }
  }

  renderFooter(modKey: string, params: string[], partials: string[]) {
    const footer = document.getElementById('editor-footer');
    if (!footer) return;

    const paramCount = params.length;
    const partialCount = partials.length;

    footer.innerHTML = `
      <div class="keyboard-hint">
          <span class="kbd">${modKey}+S</span> Save • <span class="kbd">Esc</span> Cancel
      </div>
      <div class="badge-legend">
        ${paramCount > 0 ? `
           <div class="legend-item">
            <span class="badge badge-param">${paramCount}</span>
            <span>Parameter${paramCount !== 1 ? 's' : ''}</span>
          </div>
        ` : ''}
        ${partialCount > 0 ? `
           <div class="legend-item">
            <span class="badge badge-partial">${partialCount}</span>
            <span>Partial${partialCount !== 1 ? 's' : ''}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  updateParameterInfo(parameters: string[]) {
    const paramInfo = document.getElementById('param-info');
    if (!paramInfo) return;

    if (parameters.length > 0) {
      paramInfo.innerHTML = `
        <strong>Parameters detected:</strong>
        <ul class="param-list">
          ${parameters.map(p => `<li>${p}</li>`).join('')}
        </ul>
      `;
      paramInfo.classList.remove('is-hidden'); // Assuming css handles style="display:none" or class
      paramInfo.style.display = 'block';
    } else {
      paramInfo.style.display = 'none';
    }
  }

  getFormData() {
    return {
      tag: (document.getElementById('tag-input') as HTMLInputElement)?.value.trim() || '',
      title: (document.getElementById('title-input') as HTMLInputElement)?.value.trim() || '',
      content: (document.getElementById('content-textarea') as HTMLTextAreaElement)?.value.trim() || ''
    };
  }

  getContent() {
    return (document.getElementById('content-textarea') as HTMLTextAreaElement)?.value || '';
  }

  getTextArea() {
    return document.getElementById('content-textarea') as HTMLTextAreaElement;
  }

  setSaveButtonState(isSaving: boolean, text: string) {
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = isSaving;
      saveBtn.textContent = text;
    }
  }

  showToast(type: 'error' | 'success' | 'warning', title: string, message: string, duration: number = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return; // Should be in index.html, but if we replace #app, need to ensure toast container is outside or re-added.
    // NOTE: In single window, toast-container might be outside #app or shared.
    // If it's missing, we create it.

    // Actually, let's create it if missing to be safe
    // But typically it's better to have it in the persistent layout


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

  // Autocomplete UI
  showAutocomplete(textarea: HTMLTextAreaElement, partials: Partial[], selectedIndex: number, rectLeft: number, top: number) {
    if (!this.autocompleteDiv) {
      this.autocompleteDiv = document.createElement('div');
      this.autocompleteDiv.className = 'autocomplete-dropdown positioned-dynamic is-hidden';
      document.body.appendChild(this.autocompleteDiv);
    }

    this.autocompleteDiv.classList.remove('is-hidden');
    document.documentElement.style.setProperty('--dynamic-left', `${rectLeft}px`);
    document.documentElement.style.setProperty('--dynamic-top', `${top}px`);

    this.renderAutocompleteItems(partials, selectedIndex);
  }

  renderAutocompleteItems(partials: Partial[], selectedIndex: number) {
    if (!this.autocompleteDiv) return;

    const items = partials.map((partial, index) => {
      const preview = partial.content.substring(0, 60).replace(/\n/g, ' ');
      const selectedClass = index === selectedIndex ? 'is-active' : '';
      return `
          <div class="autocomplete-item ${selectedClass}" data-index="${index}">
            <div>${partial.path}</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">${preview}...</div>
          </div>
        `;
    }).join('');

    const total = partials.length;
    // We assume partials passed here are already sliced/filtered
    // But typically we show "and more" if we sliced it in controller
    // Let's rely on controller to pass just the items to render or we handle slice here?
    // Controller usually does filtering. Controller passes what to render.
    // If controller slices, we might not know if there are more.
    // Let's assume passed partials are all we render.

    this.autocompleteDiv.innerHTML = items;
  }

  hideAutocomplete() {
    if (this.autocompleteDiv) {
      this.autocompleteDiv.classList.add('is-hidden');
    }
  }

  bindAutocompleteClicks(onSelect: (index: number) => void) {
    if (!this.autocompleteDiv) return;
    this.autocompleteDiv.querySelectorAll('[data-index]').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset.index || '0');
        onSelect(index);
      });
    });
  }

  addSaveListener(handler: () => void) {
    document.getElementById('save-btn')?.addEventListener('click', handler);
  }

  addCancelListener(handler: () => void) {
    document.getElementById('cancel-btn')?.addEventListener('click', handler);
  }

  addContentInputListener(handler: (e: Event) => void) {
    document.getElementById('content-textarea')?.addEventListener('input', handler);
  }

  addContentKeyDownListener(handler: (e: KeyboardEvent) => void) {
    document.getElementById('content-textarea')?.addEventListener('keydown', handler);
  }

  addGlobalKeyDownListener(handler: (e: KeyboardEvent) => void) {
    document.addEventListener('keydown', handler);
  }
}
