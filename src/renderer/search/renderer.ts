import { AppController } from '../AppController';
import '../styles/design-system.css';
import '../styles/search.css';
import '../styles/editor.css';
import '../styles/partials.css';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // We default to AppController which will load SearchController initially
  new AppController();
});
