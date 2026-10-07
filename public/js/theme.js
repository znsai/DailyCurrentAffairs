/**
 * Daily Current Affairs — Dark Mode Controller
 * Handles system preference detection, theme toggling, and local storage persistence.
 */
(function () {
  const THEME_KEY = 'dca-theme';

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
  }

  function toggleTheme() {
    const currentAttr = document.documentElement.getAttribute('data-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = currentAttr === 'dark' || (!currentAttr && prefersDark);
    const newTheme = isDark ? 'light' : 'dark';
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
})();
