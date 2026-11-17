// Restores the saved theme before first paint. External file (not inline) so the strict CSP allows it.
try {
  var t = localStorage.getItem('wf.theme');
  if (t) document.documentElement.dataset.theme = t;
} catch (e) {}
