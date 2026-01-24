import { Partial } from '../../types';

export class PartialsView {
  private selectedIndex = 0;

  constructor() { }

  render(partials: Partial[], selectedIndex: number) {
    this.selectedIndex = selectedIndex;
    const app = document.getElementById('app');
    if (!app) return;

    // Use a layout similar to search
    // We can reuse styles if we import them in the main entry

    app.innerHTML = `
      <div class="search-box">
         <div class="header-title" style="padding: 12px 16px 4px 16px; font-weight: 600; font-size: 14px; color: #333;">Partials Library</div>
         <input 
          type="text" 
          id="searchInput" 
          class="search-input" 
          placeholder="Search partials..."
          autocomplete="off"
        />
        <div style="padding: 0 16px 12px 16px; display: flex; justify-content: space-between; align-items: center;">
             <div id="partialCount" style="font-size: 11px; color: #666;">Loading...</div>
             <button id="newBtn" class="btn btn-primary btn-sm">New Partial</button>
        </div>
      </div>
      <div class="results" id="partialsList"></div>
      <div class="footer">
        <div class="keyboard-hint">
          <span class="kbd">↑↓</span> Navigate • <span class="kbd">Enter</span> Edit • <span class="kbd">Esc</span> Close
        </div>
        <div class="badge-legend">
           <div class="legend-item">
            <span class="badge badge-partial">P</span>
            <span>Partials</span>
          </div>
        </div>
      </div>
    `;

    this.renderList(partials, selectedIndex);

    // Auto-focus search
    setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
  }

  renderList(partials: Partial[], selectedIndex: number) {
    const container = document.getElementById('partialsList');
    const countEl = document.getElementById('partialCount');
    if (!container) return;

    if (countEl) {
      countEl.textContent = `${partials.length} partials`;
    }

    if (partials.length === 0) {
      container.innerHTML = `
          <div class="empty-state">
            <h3>No partials found</h3>
            <p>Create your first partial to get started</p>
          </div>
        `;
      return;
    }

    container.innerHTML = partials.map((partial, index) => {
      const preview = partial.content.substring(0, 100).replace(/\n/g, ' ');
      const selected = index === selectedIndex ? 'selected' : '';
      return `
            <div class="result-item ${selected}" data-index="${index}">
              <div class="result-title">
                 <span class="badge badge-partial">P</span>
                 ${partial.path}
              </div>
              <div class="result-preview">${preview}...</div>
            </div>
          `;
    }).join('');
  }

  addSearchInputListener(handler: (e: Event) => void) {
    document.getElementById('searchInput')?.addEventListener('input', handler);
  }

  addSearchKeyDownListener(handler: (e: KeyboardEvent) => void) {
    document.getElementById('searchInput')?.addEventListener('keydown', handler);
  }

  addNewBtnListener(handler: () => void) {
    document.getElementById('newBtn')?.addEventListener('click', handler);
  }

  bindClickListeners(onSelect: (index: number) => void) {
    document.querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset.index || '0');
        onSelect(index);
      });
    });
  }

  scrollToSelected() {
    const selected = document.querySelector('.result-item.selected');
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
