const MAX_GLYPHS = 6000;

export function drawGlyphBoxes(article: HTMLElement, canvas: HTMLCanvasElement): void {
  const origin = article.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(origin.width * ratio);
  canvas.height = Math.ceil(origin.height * ratio);
  canvas.style.width = `${origin.width}px`;
  canvas.style.height = `${origin.height}px`;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(ratio, ratio);
  context.strokeStyle = getComputedStyle(article).getPropertyValue('--ff-layer-color') || 'red';
  context.lineWidth = 1;
  const range = document.createRange();
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('canvas, .ff-article__tip')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  let drawn = 0;
  for (let node = walker.nextNode(); node && drawn < MAX_GLYPHS; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    let index = 0;
    for (const char of text) {
      const end = index + char.length;
      if (drawn < MAX_GLYPHS && char.trim() !== '') {
        range.setStart(node, index);
        range.setEnd(node, end);
        for (const rect of range.getClientRects()) {
          context.strokeRect(
            rect.left - origin.left + 0.5,
            rect.top - origin.top + 0.5,
            Math.max(rect.width - 1, 0),
            Math.max(rect.height - 1, 0),
          );
        }
        drawn++;
      }
      index = end;
    }
  }
}
