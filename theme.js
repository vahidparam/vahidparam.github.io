// Apply the saved palette before styles paint, then wire up the header control.
(() => {
  const key = 'vkp.theme';
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let theme = 'light';
  try { if (window.localStorage.getItem(key) === 'dark') theme = 'dark'; } catch { /* The toggle also works without storage. */ }

  function apply(value) {
    theme = value === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    themeColor?.setAttribute('content', theme === 'dark' ? '#161b18' : '#ffffff');
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
    });
  }
  apply(theme);

  function connect() {
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', () => {
        apply(theme === 'dark' ? 'light' : 'dark');
        try { window.localStorage.setItem(key, theme); } catch { /* Session-only fallback. */ }
      });
    });
    apply(theme);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect, { once: true });
  else connect();
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
})();
