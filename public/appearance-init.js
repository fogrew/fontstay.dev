try {
  const value = JSON.parse(localStorage.getItem('fontstay:appearance') || '{}');
  const root = document.documentElement;
  if (value.theme === 'light' || value.theme === 'dark') root.dataset.theme = value.theme;
  if (['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia', 'blur'].includes(value.vision))
    root.dataset.vision = value.vision;
  for (const aid of ['contrast', 'motion', 'spacing', 'largeText']) {
    if (value[aid] === true) root.dataset[aid] = '';
  }
} catch {
  // Storage may be unavailable; system preferences remain active.
}
