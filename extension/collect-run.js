async function fontstayCollect(win, doc, options = {}) {
  const toBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    return btoa(binary);
  };
  const MAX_FILES = 8;
  const MAX_FILE = 10485760;
  const MAX_TOTAL = 31457280;
  const MAX_FACES = 64;
  const RANK = { woff2: 0, woff: 1, truetype: 2, opentype: 3, ttf: 2, otf: 3 };
  const unquote = (text) =>
    String(text)
      .trim()
      .replace(/^["']|["']$/g, '');
  const weightOf = (value) => {
    const number = Number.parseInt(String(value), 10);
    if (number >= 1 && number <= 1000) return number;
    return /bold/i.test(String(value)) ? 700 : 400;
  };
  const secure = (url, base) => {
    try {
      const parsed = new URL(url, base);
      return parsed.protocol === 'https:' ? parsed.href : '';
    } catch {
      return '';
    }
  };
  const bestUrl = (src, base) => {
    const pattern = /url\(\s*["']?([^"')]+)["']?\s*\)(?:\s*format\(\s*["']?([^"')]+)["']?\s*\))?/gi;
    let best = '';
    let bestRank = 99;
    for (const match of src.matchAll(pattern)) {
      const href = secure(match[1], base);
      const kind = (match[2] || match[1].split('?')[0].split('.').pop() || '').toLowerCase();
      const rank = RANK[kind] ?? 50;
      if (href && rank < bestRank) {
        best = href;
        bestRank = rank;
      }
    }
    return best;
  };

  const faces = [];
  const walk = (rules, base) => {
    for (let index = 0; index < rules.length && faces.length < MAX_FACES; index++) {
      const rule = rules[index];
      if (rule.type === 5) {
        const family = unquote(rule.style.getPropertyValue('font-family'));
        if (!family) continue;
        const url = bestUrl(rule.style.getPropertyValue('src'), base);
        faces.push({
          family,
          weight: weightOf(rule.style.getPropertyValue('font-weight')),
          style: /italic|oblique/i.test(rule.style.getPropertyValue('font-style'))
            ? 'italic'
            : 'normal',
          ...(url ? { url } : {}),
        });
      } else if (rule.cssRules) {
        walk(rule.cssRules, base);
      }
    }
  };
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      walk(sheet.cssRules, sheet.href || doc.baseURI);
    } catch {}
  }

  const used = [];
  const roles = [
    ['body', 'body'],
    ['h1', 'h1'],
    ['h2', 'h2'],
    ['h3', 'h3'],
    ['button', 'button'],
  ];
  for (const [role, selector] of roles) {
    const element = doc.querySelector(selector);
    if (!element) continue;
    const style = win.getComputedStyle(element);
    const size = Number.parseFloat(style.fontSize);
    const line = Number.parseFloat(style.lineHeight);
    used.push({
      role,
      family: style.fontFamily,
      size,
      weight: weightOf(style.fontWeight),
      ...(Number.isFinite(line) && size > 0 ? { lineHeight: line / size } : {}),
    });
  }

  const samples = [];
  const SAMPLE_ROLES = {
    h1: 'heading',
    h2: 'subheading',
    h3: 'subheading',
    p: 'body',
    li: 'item',
    blockquote: 'quote',
  };
  const root = doc.querySelector('main, article, [role="main"]') || doc.body;
  let chars = 0;
  for (const element of root.querySelectorAll('h1,h2,h3,p,li,blockquote')) {
    if (samples.length >= 40 || chars >= 9000) break;
    const tag = element.tagName.toLowerCase();
    if (element.closest('nav,header,footer,aside,form,[hidden],[aria-hidden="true"]')) continue;
    if (tag === 'p' && element.closest('blockquote')) continue;
    if (element.getClientRects().length === 0) continue;
    const text = (element.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (text.length < (tag === 'li' || tag[0] === 'h' ? 3 : 25)) continue;
    samples.push({ role: SAMPLE_ROLES[tag], text });
    chars += text.length;
  }

  const families = new Set(
    used.flatMap((item) => item.family.split(',').map((name) => unquote(name).toLowerCase())),
  );
  const ordered = [...faces].sort(
    (a, b) =>
      Number(families.has(b.family.toLowerCase())) - Number(families.has(a.family.toLowerCase())),
  );
  const urls = [...new Set(ordered.map((face) => face.url).filter(Boolean))].slice(0, MAX_FILES);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await win.fetch(url, {
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok || Number(response.headers.get('content-length')) > MAX_FILE) {
        throw new Error('skipped');
      }
      return { url, bytes: await response.arrayBuffer() };
    }),
  );
  const files = [];
  let total = 0;
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { url, bytes } = result.value;
    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > MAX_FILE ||
      total + bytes.byteLength > MAX_TOTAL
    ) {
      continue;
    }
    total += bytes.byteLength;
    const name = url.split('?')[0].split('/').pop() || 'font';
    files.push(options.base64 ? { name, base64: toBase64(bytes) } : { name, bytes });
  }

  return {
    v: 1,
    origin: win.location.origin,
    title: doc.title,
    faces,
    used,
    samples,
    files,
  };
}

fontstayCollect(window, document, { base64: true });
