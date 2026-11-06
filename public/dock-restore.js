// Mirrors the storage key and breakpoint of the Dock component.
try {
  const opened = JSON.parse(localStorage.getItem('fontstay:layout:dock')).opened[0];
  if (
    ['inputs', 'audience', 'tuning', 'export'].includes(opened) &&
    !matchMedia('(min-width: 64rem)').matches
  ) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      `.ff-dock:not([data-ready]) .ff-dock__column[data-id="${opened}"]:not([data-client-only]) > .ff-dock__panel[hidden] { display: block; }` +
        (opened === 'inputs'
          ? ''
          : '.ff-dock:not([data-ready]) .ff-dock__column[data-id="inputs"] > .ff-dock__panel:not([hidden]) { display: none; }'),
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
} catch {}
