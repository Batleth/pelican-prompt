import { Partial } from '../../types';
import { PartialsView } from './PartialsView';

export class PartialsController {
    private view: PartialsView;
    private partials: Partial[] = [];
    private filteredPartials: Partial[] = [];
    private selectedIndex = 0;
    private onEdit: (partial: Partial | null) => void;
    private onClose: () => void;

    constructor(view: PartialsView, onEdit: (partial: Partial | null) => void, onClose: () => void) {
        this.view = view;
        this.onEdit = onEdit;
        this.onClose = onClose;
    }

    async load() {
        this.partials = await window.electronAPI.getAllPartials();
        this.filteredPartials = [...this.partials];
        this.selectedIndex = 0;
        this.view.render(this.filteredPartials, this.selectedIndex);
        this.bindEvents();
    }

    bindEvents() {
        this.view.addSearchInputListener((e) => {
            const query = (e.target as HTMLInputElement).value;
            this.filter(query);
        });

        this.view.addNewBtnListener(() => {
            this.onEdit(null); // New partial
        });

        this.view.addSearchKeyDownListener((e) => this.handleKeyDown(e));

        // Re-bind clicks after initial render
        this.view.bindClickListeners((index) => {
            this.selectedIndex = index;
            this.updateSelection();
            this.onEdit(this.filteredPartials[index]);
        });
    }

    filter(query: string) {
        if (!query.trim()) {
            this.filteredPartials = [...this.partials];
        } else {
            const lower = query.toLowerCase();
            this.filteredPartials = this.partials.filter(p =>
                p.path.toLowerCase().includes(lower) || p.content.toLowerCase().includes(lower)
            );
        }
        this.selectedIndex = 0;
        this.view.renderList(this.filteredPartials, this.selectedIndex);
        this.rebindClicks();
    }

    handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredPartials.length - 1);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.filteredPartials.length > 0) {
                this.onEdit(this.filteredPartials[this.selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.onClose();
        }
    }

    updateSelection() {
        this.view.renderList(this.filteredPartials, this.selectedIndex);
        this.rebindClicks();
        this.view.scrollToSelected();
    }

    rebindClicks() {
        this.view.bindClickListeners((index) => {
            this.selectedIndex = index;
            this.updateSelection();
            // We don't auto-edit on click, or do we?
            // Usually click selects, double click edits? Or click edits immediately?
            // In the original, it seems single click was selection, edit button was edit.
            // But here let's make single click edit for simplicity or keep consistent with search.
            this.onEdit(this.filteredPartials[index]);
        });
    }
}
