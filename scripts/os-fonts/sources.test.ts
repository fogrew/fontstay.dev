import { describe, expect, it } from 'vitest';
import {
  appleStatus,
  parseAndroidFontFiles,
  parseAppleSystemFonts,
  parseChromeosFontPackages,
  parseOsFontListCsv,
  parseUbuntuManifest,
  parseWindowsFontList,
} from './sources';

describe('parseWindowsFontList', () => {
  const html = `
    <table><tbody>
      <tr><th>Family</th><th>Font Name</th></tr>
      <tr><td><a href="x">Arial</a></td><td>Arial</td></tr>
      <tr><td></td><td>Arial Bold</td></tr>
      <tr><td><a>Segoe UI</a></td><td>Segoe UI</td></tr>
    </tbody></table>
    <h2 id="fonts-included-in-feature-on-demand-fod-packages">Fonts included in Feature On Demand</h2>
    <table><tbody>
      <tr><td><a>Noto Sans Arabic</a></td><td>x</td></tr>
    </tbody></table>`;

  it('treats the first table as preinstalled and later tables as on demand', () => {
    const result = parseWindowsFontList(html);
    expect([...result.preinstalled]).toEqual(['Arial', 'Segoe UI']);
    expect([...result.onDemand]).toEqual(['Noto Sans Arabic']);
  });
});

describe('Apple system fonts', () => {
  const item = (name: string, kinds: [string, string][]) =>
    `<li class="font-item"><span class="filter-font-name">${name}</span>${kinds
      .map(
        ([kind, platform]) =>
          `<span class="filter-type">${platform} <span class="hidden">${kind} ${platform}</span></span>`,
      )
      .join('')}</li>`;
  const html = [
    item('Helvetica', [
      ['system font', 'iOS'],
      ['system font', 'macOS'],
    ]),
    item('Helvetica Neue Bold', [['system font', 'macOS']]),
    item('Tahoma', [
      ['downloadable', 'iOS'],
      ['system font', 'macOS'],
    ]),
    item('Arial Black', [['system font', 'macOS']]),
    item('Academy Engraved LET Plain:1.0', [['document support', 'iOS']]),
  ].join('');

  it('parses names and the kind per platform', () => {
    const faces = parseAppleSystemFonts(html);
    expect(faces.map((face) => face.name)).toEqual([
      'Helvetica',
      'Helvetica Neue Bold',
      'Tahoma',
      'Arial Black',
      'Academy Engraved LET Plain',
    ]);
    expect(faces[2]?.platforms).toEqual({ iOS: 'downloadable', macOS: 'system' });
  });

  it('reports preinstalled, on-demand and missing families', () => {
    const faces = parseAppleSystemFonts(html);
    expect(appleStatus(faces, 'Helvetica', 'iOS')).toBe('preinstalled');
    expect(appleStatus(faces, 'Tahoma', 'iOS')).toBe('on-demand');
    expect(appleStatus(faces, 'Tahoma', 'macOS')).toBe('preinstalled');
    expect(appleStatus(faces, 'Helvetica Neue', 'macOS')).toBe('preinstalled');
    expect(appleStatus(faces, 'Helvetica Neue', 'iOS')).toBeNull();
    expect(appleStatus(faces, 'Arial', 'macOS')).toBeNull();
    expect(appleStatus(faces, 'Academy Engraved LET', 'iOS')).toBeNull();
    expect(appleStatus(faces, 'Helvet', 'macOS')).toBeNull();
  });
});

describe('Windows family names', () => {
  it('strips nested tags and decodes entities exactly once', () => {
    const html =
      '<h2 id="fonts-included-in-feature-on-demand-fod-packages">x</h2><table><tr><td><a>Ar<b>ial</b></a></td></tr><tr><td>&lt;scr<script>ipt</td></tr><tr><td>A &amp;quot; B</td></tr></table>';
    const { preinstalled, onDemand } = parseWindowsFontList(html);
    expect([...preinstalled]).toEqual([]);
    expect([...onDemand]).toEqual(['Arial', '&lt;script', 'A &quot; B']);
  });
});

describe('other sources', () => {
  it('rejects a Windows page without the Feature On Demand heading', () => {
    expect(() => parseWindowsFontList('<table></table>')).toThrow();
  });

  it('reads quoted families in an os-font-list CSV', () => {
    expect([...parseOsFontListCsv('Family,Name,Filename\n"A, B","A, B",x.ttf\n')]).toEqual([
      'A, B',
    ]);
  });

  it('reads the family column of an os-font-list CSV', () => {
    expect([
      ...parseOsFontListCsv(
        'Family,Name,Filename\nArial,Arial,Arial.ttf\nArial,Arial Bold,x.ttf\n',
      ),
    ]).toEqual(['Arial']);
  });

  it('collects Android font file names', () => {
    const xml =
      '<family name="serif"><font weight="400" style="normal">NotoSerif-Regular.ttf</font></family>';
    expect([...parseAndroidFontFiles(xml)]).toEqual(['NotoSerif-Regular.ttf']);
  });

  it('collects font package names from the ChromeOS ebuild', () => {
    const ebuild = 'DEPEND=" media-fonts/croscorefonts:= media-fonts/crosextrafonts-carlito:= "';
    expect([...parseChromeosFontPackages(ebuild)]).toEqual([
      'croscorefonts',
      'crosextrafonts-carlito',
    ]);
  });

  it('collects package names from an Ubuntu manifest', () => {
    expect([...parseUbuntuManifest('fonts-ubuntu\t0.83-6\nxfonts-base 1:1.0\n')]).toEqual([
      'fonts-ubuntu',
      'xfonts-base',
    ]);
  });
});
