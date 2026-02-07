
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../App';
import '../styles/design-system.css';
import '../styles/search.css';
import '../styles/editor.css';
import '../styles/partials.css';

import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';

// Initialize theme from stored value
async function initTheme() {
  const theme = await window.electronAPI.getTheme();
  applyTheme(theme);
  updateThemeIcon(theme);
}

function applyTheme(theme: string) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    setTheme('sap_horizon_dark');
  } else {
    document.body.classList.remove('dark');
    setTheme('sap_horizon');
  }
}

function updateThemeIcon(theme: string) {
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

async function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  await window.electronAPI.setTheme(newTheme);
  applyTheme(newTheme);
  updateThemeIcon(newTheme);
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  }

  // Initialize theme
  initTheme();

  // Theme toggle button
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Close button
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.electronAPI.hideWindow();
    });
  }

  // Listen for theme changes from main process
  window.electronAPI.onThemeChanged((theme) => {
    applyTheme(theme);
    updateThemeIcon(theme);
  });
});
