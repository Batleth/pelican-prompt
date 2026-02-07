
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../App';
import '../global.css';


import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import '@ui5/webcomponents-react/dist/Assets';

// Initialize theme from stored value
async function initTheme() {
  const theme = await window.electronAPI.getTheme();
  applyTheme(theme);
}

function applyTheme(themeName: string) {
  let theme = themeName;
  if (themeName === 'dark') theme = 'sap_horizon_dark';
  if (themeName === 'light') theme = 'sap_horizon';

  if (theme.includes('dark') || theme.includes('hcb')) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  setTheme(theme);
}



document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  }

  // Initialize theme
  initTheme();



  // Listen for theme changes from main process
  window.electronAPI.onThemeChanged((theme) => {
    applyTheme(theme);
  });
});
