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
  const MAX_SHEETS = 6;
  const MAX_CSS = 500000;
  const readBounded = async (response, limit, budget) => {
    if (!response.ok || Number(response.headers.get('content-length')) > limit) {
      throw new Error('skipped');
    }
    if (!response.body) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > limit) throw new Error('skipped');
      return buffer;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (budget) budget.left -= value.byteLength;
      if (size > limit || (budget && budget.left < 0)) {
        await reader.cancel();
        throw new Error('skipped');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
  };
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
      const rank = Object.hasOwn(RANK, kind) ? RANK[kind] : 50;
      if (href && rank < bestRank) {
        best = href;
        bestRank = rank;
      }
    }
    return best;
  };

  const coversLatin = (range) => {
    if (!range) return true;
    return range.split(',').some((part) => {
      const match = /^u\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i.exec(part.trim());
      if (!match) return false;
      const wild = match[1].includes('?');
      const low = Number.parseInt(match[1].replace(/\?/g, '0'), 16);
      const high = wild
        ? Number.parseInt(match[1].replace(/\?/g, 'f'), 16)
        : match[2]
          ? Number.parseInt(match[2], 16)
          : low;
      return [0x41, 0x61].some((point) => point >= low && point <= high);
    });
  };

  const faces = [];
  const slots = new Map();
  const latin = new Map();
  const pending = [];
  const queued = new Set();
  const defer = (href, base) => {
    const url = secure(href, base);
    if (!url || queued.has(url) || queued.size >= MAX_SHEETS) return;
    queued.add(url);
    pending.push(url);
  };
  const addFace = (face, covers) => {
    const key = `${face.family.toLowerCase()}|${face.weight}|${face.style}`;
    const slot = slots.get(key);
    if (slot === undefined) {
      if (faces.length >= MAX_FACES) return;
      slots.set(key, faces.length);
      faces.push(face);
      latin.set(face, covers);
    } else if (covers && !latin.get(faces[slot])) {
      latin.delete(faces[slot]);
      faces[slot] = face;
      latin.set(face, covers);
    }
  };
  const walk = (rules, base) => {
    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      if (rule.type === 5) {
        const family = unquote(rule.style.getPropertyValue('font-family'));
        if (!family) continue;
        const url = bestUrl(rule.style.getPropertyValue('src'), base);
        addFace(
          {
            family,
            weight: weightOf(rule.style.getPropertyValue('font-weight')),
            style: /italic|oblique/i.test(rule.style.getPropertyValue('font-style'))
              ? 'italic'
              : 'normal',
            ...(url ? { url } : {}),
          },
          coversLatin(rule.style.getPropertyValue('unicode-range')),
        );
      } else if (rule.type === 3) {
        let inner;
        try {
          inner = rule.styleSheet?.cssRules;
        } catch {}
        if (inner) walk(inner, rule.styleSheet.href || base);
        else defer(rule.href, base);
      } else if (rule.cssRules) {
        walk(rule.cssRules, base);
      }
    }
  };
  const textRules = (text) => {
    const css = text.slice(0, MAX_CSS).replace(/\/\*[\s\S]*?\*\//g, '');
    const imports = [];
    for (const match of css.matchAll(
      /@import\s+(?:url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])/gi,
    )) {
      imports.push(match[1] || match[2]);
    }
    const rules = [];
    for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
      const props = new Map();
      for (const declaration of block[1].split(/;(?![^(]*\))/)) {
        const colon = declaration.indexOf(':');
        if (colon > 0) {
          props.set(
            declaration.slice(0, colon).trim().toLowerCase(),
            declaration.slice(colon + 1).trim(),
          );
        }
      }
      rules.push({ type: 5, style: { getPropertyValue: (name) => props.get(name) ?? '' } });
    }
    return { rules, imports };
  };
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      walk(sheet.cssRules, sheet.href || doc.baseURI);
    } catch {
      defer(sheet.href, doc.baseURI);
    }
  }
  for (let depth = 0; depth < 2 && pending.length > 0; depth++) {
    const batch = pending.splice(0);
    const texts = await Promise.allSettled(
      batch.map(async (url) => {
        const response = await win.fetch(url, {
          credentials: 'omit',
          signal: AbortSignal.timeout(8000),
        });
        return new TextDecoder().decode(await readBounded(response, MAX_CSS));
      }),
    );
    texts.forEach((result, position) => {
      if (result.status !== 'fulfilled') return;
      const { rules, imports } = textRules(result.value);
      walk(rules, batch[position]);
      for (const href of imports) defer(href, batch[position]);
    });
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
  const budget = { left: MAX_TOTAL };
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await win.fetch(url, {
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
      });
      return { url, bytes: await readBounded(response, MAX_FILE, budget) };
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
