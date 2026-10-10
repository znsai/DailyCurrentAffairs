/**
 * Daily Current Affairs — Dark Mode Controller
 * Handles system preference detection, theme toggling, and local storage persistence.
 */
(function () {
  const THEME_KEY = 'dca-theme';
  const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

  function isDarkTheme() {
    const theme = document.documentElement.getAttribute('data-theme');
    return theme === 'dark' || (!theme && systemTheme && systemTheme.matches);
  }

  function updateToggleLabels() {
    const label = isDarkTheme() ? 'Switch to light theme' : 'Switch to dark theme';
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
  }

  function getSavedTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateToggleLabels();
  }

  function toggleTheme() {
    const newTheme = isDarkTheme() ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch {
      // Ignore localStorage errors
    }
    applyTheme(newTheme);
  }

  // Wire all theme toggle buttons on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggleButtons);
  } else {
    initToggleButtons();
  }

  function initToggleButtons() {
    updateToggleLabels();
    const buttons = document.querySelectorAll('.theme-toggle');
    buttons.forEach((button) => {
      button.addEventListener('click', toggleTheme);
    });
  }

  // Apply saved theme immediately
  const saved = getSavedTheme();
  if (saved) {
    applyTheme(saved);
  }

  if (systemTheme && systemTheme.addEventListener) {
    systemTheme.addEventListener('change', updateToggleLabels);
  }
})();
