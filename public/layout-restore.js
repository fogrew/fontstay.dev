// Mirrors useSidebar in @/common/ui: storage keys, CSS variable and attribute names, breakpoint.
try {
  const desktop = matchMedia('(min-width: 64rem)').matches;
  for (const name of ['left', 'right']) {
    const saved = JSON.parse(localStorage.getItem(`fontstay:layout:sidebar-${name}`));
    if (typeof saved.open !== 'boolean' && !Number.isFinite(saved.width)) continue;
    const root = document.documentElement;
    if (Number.isFinite(saved.width) && saved.width > 0 && saved.width < 4000) {
      root.style.setProperty(`--ff-${name}-width`, `${saved.open && desktop ? saved.width : 0}px`);
    }
    if (typeof saved.open === 'boolean') {
      root.dataset[name === 'left' ? 'sidebarLeft' : 'sidebarRight'] =
        saved.open && (desktop || name === 'left') ? 'open' : 'closed';
    }
  }
} catch {}
