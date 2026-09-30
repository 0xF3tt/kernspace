// The theme the viewer picked, applied before the first paint (a module would run after it).
// Without a choice the page follows the system through CSS alone.
try {
  const t = localStorage.getItem('ks-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch {}
