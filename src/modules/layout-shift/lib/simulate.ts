import { blockCss, sampleBlocks } from './document';
import type { SampleLanguage } from './samples';
import {
  type Box,
  layoutShiftScore,
  MAX_ELEMENTS,
  type Viewport,
  type ViewportResult,
} from './score';

export type { ViewportResult };

export const WEB_FAMILY = 'ff-sim-web';
const MISSING_FAMILY = 'ff-sim-missing';
const MEASURED = 'h1,h2,h3,p,li,button,blockquote';
const MAX_FRAME_PX = 4096;

export const DEFAULT_VIEWPORTS: readonly Viewport[] = [
  { width: 412, height: 823 },
  { width: 1350, height: 940 },
];

export interface SimulationInput {
  webBytes: ArrayBuffer;
  fallbackFontFaces: string;
  fallbackFamilies: readonly string[];
  generic: string;
  language: SampleLanguage;
  viewports: readonly Viewport[];
  spacing?: Spacing | undefined;
  signal?: AbortSignal | undefined;
}

export interface Spacing {
  letterEm: number;
  wordEm: number;
}

export interface Measurement {
  results: ViewportResult[];
  missingFallbacks: string[];
}

export interface Simulation {
  measure(fontFaces: string, spacing?: Spacing): Promise<Measurement>;
  close(): void;
}

interface Snapshot {
  boxes: Box[];
  lines: number[];
  height: number;
}

interface Session {
  viewport: Viewport;
  frame: HTMLIFrameElement;
  doc: Document;
  view: Window;
  sheet: CSSStyleSheet;
  web: Snapshot;
}

const quote = (name: string) => `"${name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const finite = (value: number) => (Number.isFinite(value) ? value : 0);

export function buildStylesheet(
  input: Pick<SimulationInput, 'fallbackFamilies' | 'generic'> & { fallbackFontFaces: string },
  spacing: Spacing = { letterEm: 0, wordEm: 0 },
): string {
  const tail = [...input.fallbackFamilies.map(quote), input.generic].join(', ');
  return `${input.fallbackFontFaces}
html, body { margin: 0; padding: 0; }
body { padding: 16px; font-size: 16px; line-height: normal; }
${blockCss()}
body.sim-a, body.sim-a * { font-family: ${quote(MISSING_FAMILY)}, ${tail}; letter-spacing: ${finite(spacing.letterEm)}em; word-spacing: ${finite(spacing.wordEm)}em; }
body.sim-b, body.sim-b * { font-family: ${quote(WEB_FAMILY)}, ${tail}; }`;
}

function lineCount(element: Element): number {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const tops = new Set<number>();
  for (const rect of range.getClientRects()) {
    if (rect.width > 0) tops.add(Math.round(rect.top / 4));
  }
  return tops.size;
}

function snapshot(root: Element): Snapshot {
  const elements = [...root.querySelectorAll(MEASURED)].slice(0, MAX_ELEMENTS);
  return {
    boxes: elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
    lines: elements.map(lineCount),
    height: (root as HTMLElement).offsetHeight,
  };
}

function buildSample(doc: Document, language: SampleLanguage) {
  for (const block of sampleBlocks(language)) {
    const element = doc.createElement(block.tag);
    element.textContent = block.text;
    doc.body.append(element);
  }
}

function waitForFrame(frame: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    const ready = () => {
      const doc = frame.contentDocument;
      return Boolean(
        doc && doc.URL === 'about:srcdoc' && doc.readyState === 'complete' && doc.body,
      );
    };
    if (ready()) return resolve();
    frame.addEventListener('load', () => resolve(), { once: true });
  });
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

async function nextFrame(window: Window): Promise<void> {
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function validate(viewport: Viewport) {
  if (
    !(viewport.width >= 200) ||
    !(viewport.height >= 200) ||
    viewport.width > MAX_FRAME_PX ||
    viewport.height > MAX_FRAME_PX
  ) {
    throw new RangeError('Invalid viewport');
  }
}

async function openSession(input: SimulationInput, viewport: Viewport): Promise<Session> {
  validate(viewport);
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.srcdoc = '<!doctype html><html><head><title></title></head><body></body></html>';
  frame.style.position = 'fixed';
  frame.style.left = '-10000px';
  frame.style.top = '0';
  frame.style.border = '0';
  frame.style.visibility = 'hidden';
  frame.style.width = `${viewport.width}px`;
  frame.style.height = `${viewport.height}px`;
  document.body.append(frame);
  try {
    await waitForFrame(frame);
    throwIfAborted(input.signal);
    const view = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!view || !doc) throw new Error('Simulation frame is unavailable');
    const sheet = new (view as unknown as { CSSStyleSheet: typeof CSSStyleSheet }).CSSStyleSheet();
    sheet.replaceSync(buildStylesheet(input));
    doc.adoptedStyleSheets = [sheet];
    buildSample(doc, input.language);
    const web = new (view as unknown as { FontFace: typeof FontFace }).FontFace(
      WEB_FAMILY,
      input.webBytes.slice(0),
    );
    await web.load();
    throwIfAborted(input.signal);
    doc.fonts.add(web);
    doc.body.className = 'sim-b';
    await doc.fonts.load(`16px ${quote(WEB_FAMILY)}`);
    await doc.fonts.ready;
    await nextFrame(view);
    throwIfAborted(input.signal);
    return { viewport, frame, doc, view, sheet, web: snapshot(doc.body) };
  } catch (failure) {
    frame.remove();
    throw failure;
  }
}

export async function createSimulation(input: SimulationInput): Promise<Simulation> {
  const sessions: Session[] = [];
  const close = () => {
    for (const session of sessions) session.frame.remove();
    sessions.length = 0;
  };
  try {
    for (const viewport of input.viewports) {
      throwIfAborted(input.signal);
      sessions.push(await openSession(input, viewport));
    }
  } catch (failure) {
    close();
    throw failure;
  }

  return {
    close,
    async measure(fontFaces, spacing) {
      const results: ViewportResult[] = [];
      const missing = new Set<string>();
      for (const session of sessions) {
        throwIfAborted(input.signal);
        const { doc, view, sheet, viewport } = session;
        sheet.replaceSync(
          buildStylesheet({ ...input, fallbackFontFaces: fontFaces }, spacing ?? input.spacing),
        );
        doc.body.className = 'sim-a';
        const loaded = await Promise.all(
          input.fallbackFamilies.map(async (name) => {
            const faces = await doc.fonts.load(`16px ${quote(name)}`).catch(() => []);
            return [name, faces.length > 0] as const;
          }),
        );
        for (const [name, ok] of loaded) if (!ok) missing.add(name);
        await doc.fonts.ready;
        await nextFrame(view);
        throwIfAborted(input.signal);
        const before = snapshot(doc.body);
        const after = session.web;
        const count = Math.min(before.boxes.length, after.boxes.length);
        const items = Array.from({ length: count }, (_, index) => ({
          before: before.boxes[index] as Box,
          after: after.boxes[index] as Box,
        }));
        const shift = layoutShiftScore(items, viewport);
        const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
        results.push({
          viewport,
          score: shift.score,
          impactFraction: shift.impactFraction,
          distanceFraction: shift.distanceFraction,
          shiftedElements: shift.shifted,
          linesBefore: sum(before.lines),
          linesAfter: sum(after.lines),
          heightBefore: before.height,
          heightAfter: after.height,
          lineBreakMismatches: before.lines.filter(
            (lines, index) => lines !== (after.lines[index] ?? lines),
          ).length,
        });
      }
      return { results, missingFallbacks: [...missing] };
    },
  };
}

export async function simulateLayoutShift(input: SimulationInput): Promise<ViewportResult[]> {
  const simulation = await createSimulation(input);
  try {
    return (await simulation.measure(input.fallbackFontFaces, input.spacing)).results;
  } finally {
    simulation.close();
  }
}

export type Rating = 'good' | 'needs-improvement' | 'poor';

export function ratingOf(score: number): Rating {
  if (score <= 0.1) return 'good';
  return score <= 0.25 ? 'needs-improvement' : 'poor';
}
