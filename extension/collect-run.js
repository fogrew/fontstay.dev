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
  const heading = doc.querySelector('h1') || doc.querySelector('h2');
  if (heading?.innerText) samples.push({ role: 'heading', text: heading.innerText.slice(0, 1200) });
  const paragraphs = Array.from(doc.querySelectorAll('main p, article p, p')).slice(0, 12);
  const longest = paragraphs
    .map((element) => element.innerText || '')
    .sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length >= 40) samples.push({ role: 'body', text: longest.slice(0, 1200) });

  const families = new Set(
    used.flatMap((item) => item.family.split(',').map((name) => unquote(name).toLowerCase())),
  );
  const ordered = [...faces].sort(
    (a, b) =>
      Number(families.has(b.family.toLowerCase())) - Number(families.has(a.family.toLowerCase())),
  );
  const files = [];
  const fetched = new Set();
  let total = 0;
  for (const face of ordered) {
    if (files.length >= MAX_FILES) break;
    if (!face.url || fetched.has(face.url)) continue;
    fetched.add(face.url);
    try {
      const response = await win.fetch(face.url, {
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      if (
        bytes.byteLength === 0 ||
        bytes.byteLength > MAX_FILE ||
        total + bytes.byteLength > MAX_TOTAL
      ) {
        continue;
      }
      total += bytes.byteLength;
      const name = face.url.split('?')[0].split('/').pop() || 'font';
      files.push(options.base64 ? { name, base64: toBase64(bytes) } : { name, bytes });
    } catch {}
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
