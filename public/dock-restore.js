// Mirrors the storage key and breakpoint of the Dock component.
try {
  const opened = JSON.parse(localStorage.getItem('fontstay:layout:dock')).opened[0];
  if (/^[a-z-]+$/.test(opened) && !matchMedia('(min-width: 64rem)').matches) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      `.ff-dock:not([data-ready]) .ff-dock__column[data-id="${opened}"]:not([data-client-only]) > .ff-dock__panel[hidden] { display: block; }`,
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
} catch {}
