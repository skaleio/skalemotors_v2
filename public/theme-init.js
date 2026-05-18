(function () {
  try {
    var raw = window.localStorage.getItem('skale-theme');
    var mode = raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
    var resolved =
      mode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode;
    var root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark');
    root.style.colorScheme = resolved;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#ffffff');
  } catch (e) {
    /* localStorage bloqueado: ThemeProvider corrige al hidratar */
  }
})();
