import { SearchView } from './SearchView';
import { SearchController } from './SearchController';
import '../styles/design-system.css';
import '../styles/search.css';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const view = new SearchView();
  new SearchController(view);
});
