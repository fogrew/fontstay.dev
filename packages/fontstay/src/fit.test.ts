import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFontBuffer } from '@/modules/font-metrics/lib/parse';
import { fitFonts } from '@/modules/generator/lib/fit-fonts';
import { FitRunError, fit } from './index';

const fixture = (path: string) =>
  readFileSync(new URL(`../../../tests/fixtures/${path}`, import.meta.url));

const load = (fileName: string) => ({ fileName, data: fixture(`fonts/${fileName}`) });

const sourceSans = () => load('SourceSansPro-Regular.woff2');
const fira = () => load('FiraSans-Regular.ttf');

describe('fit', () => {
  it('matches the CSS the web app generates for Source Sans Pro and the defaults audience', async () => {
    const result = await fit({ fonts: [sourceSans()], audience: 'defaults' });
    expect(`${result.css}\n`).toBe(fixture('parity/source-sans-pro.defaults.expected').toString());
  });

  it('matches the CSS the web app generates for Fira Sans on Windows and macOS only', async () => {
    const result = await fit({
      fonts: [fira()],
      audience: 'defaults',
      systems: ['windows', 'macos'],
    });
    expect(`${result.css}\n`).toBe(fixture('parity/fira-sans.windows-macos.expected').toString());
    expect(result.systems.sort()).toEqual(['macos', 'windows']);
  });

  it('treats the systems option like os parts of the audience query', async () => {
    const byOption = await fit({
      fonts: [fira()],
      audience: 'defaults',
      systems: ['windows', 'macos'],
    });
    const byQuery = await fit({ fonts: [fira()], audience: 'defaults, os windows, os macos' });
    expect(byQuery.css).toBe(byOption.css);
  });

  it('reports the fitted fallbacks per system with their audience share', async () => {
    const { fonts, shares } = await fit({
      fonts: [sourceSans()],
      audience: 'defaults',
      systems: ['windows'],
    });
    expect(fonts).toHaveLength(1);
    expect(fonts[0]?.family).toBe('Source Sans Pro');
    expect(fonts[0]?.picks.map((pick) => pick.system)).toEqual(['windows']);
    expect(Object.keys(shares)).toEqual(['windows']);
    expect(shares.windows).toBeGreaterThan(1);
    expect(shares.windows).toBeLessThan(100);
  });

  it('adds unicode-range of the covered glyphs on request and omits per-script faces on request', async () => {
    const plain = await fit({ fonts: [sourceSans()], systems: ['windows'], scripts: false });
    expect(plain.css.match(/@font-face/g)).toHaveLength(1);
    expect(plain.css).not.toContain('unicode-range');
    const ranged = await fit({
      fonts: [sourceSans()],
      systems: ['windows'],
      unicodeRange: true,
    });
    expect(ranged.css).toContain('unicode-range: U+');
  });

  it('merges several fonts into one stylesheet', async () => {
    const result = await fit({
      fonts: [sourceSans(), fira()],
      audience: 'defaults',
      systems: ['windows'],
    });
    expect(result.fonts.map((font) => font.family)).toEqual(['Source Sans Pro', 'Fira Sans']);
    expect(result.css).toContain('.source-sans-pro {');
    expect(result.css).toContain('.fira-sans {');
  });

  it('rejects an invalid audience query', async () => {
    await expect(fit({ fonts: [fira()], audience: 'not a query' })).rejects.toMatchObject({
      name: 'FitRunError',
      code: 'invalid-audience',
    });
  });

  it('fails when the audience has no system with fallback fonts', async () => {
    await expect(
      fit({ fonts: [fira()], audience: 'defaults, os ios, not os ios' }),
    ).rejects.toBeInstanceOf(FitRunError);
  });
});

describe('font-face descriptors of bold and italic fonts', () => {
  it('are added to every face of a bold font with bold fallback faces', async () => {
    const parsed = parseFontBuffer(Uint8Array.from(fixture('fonts/FiraSans-Regular.ttf')).buffer);
    const bold = { ...parsed, style: { ...parsed.style, weight: 700 } };
    const result = await fitFonts({
      fonts: [{ fileName: 'FiraSans-Bold.ttf', metrics: bold }],
      audience: 'defaults',
      scripts: false,
    });
    const faces = result.input.fontFaces.split('\n\n');
    const weighted = faces.filter((face) => face.includes('font-weight: 700'));
    expect(weighted.length).toBeGreaterThan(0);
    expect(weighted).toHaveLength(faces.length);
  });
});
