import type { Download } from './metrics-sources.ts';

export type StyleId = 'bold' | 'italic' | 'bold-italic';
export const STYLE_IDS: readonly StyleId[] = ['bold', 'italic', 'bold-italic'];

export interface VariantSource {
  files?: readonly string[];
  download?: Download;
  variation?: Record<string, number>;
  localNames?: readonly string[];
}

export type VariantSources = Partial<Record<StyleId, VariantSource>>;

const GOOGLE_FONTS = 'bd8f81ddb5c74d5c8897b36ad88b440266245103';
const googleFonts = (path: string) =>
  `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS}/${path}`;
const DEJAVU =
  'https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip';
const LIBERATION =
  'https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz';

const local = (bold?: string, italic?: string, boldItalic?: string): VariantSources => ({
  ...(bold ? { bold: { files: [bold] } } : {}),
  ...(italic ? { italic: { files: [italic] } } : {}),
  ...(boldItalic ? { 'bold-italic': { files: [boldItalic] } } : {}),
});

const google = (directory: string, base: string, license: string): VariantSources => {
  const file = (suffix: string) => ({
    download: { url: googleFonts(`${directory}/${base}-${suffix}.ttf`), license },
  });
  return {
    bold: file('Bold'),
    italic: file('Italic'),
    'bold-italic': file('BoldItalic'),
  };
};

const archive = (
  url: string,
  prefix: string,
  base: string,
  license: string,
  italicName: 'Italic' | 'Oblique',
): VariantSources => {
  const file = (suffix: string) => ({
    download: { url, member: `${prefix}${base}-${suffix}.ttf`, license },
  });
  return {
    bold: file('Bold'),
    italic: file(italicName),
    'bold-italic': file(`Bold${italicName}`),
  };
};

const variable = (
  family: string,
  upright: string,
  italic: string,
  license: string,
): VariantSources => {
  const names = (style: string) => [`${family} ${style}`, `${family}-${style.replace(' ', '')}`];
  return {
    bold: {
      download: { url: googleFonts(upright), license },
      variation: { wght: 700 },
      localNames: names('Bold'),
    },
    italic: {
      download: { url: googleFonts(italic), license },
      variation: { wght: 400 },
      localNames: names('Italic'),
    },
    'bold-italic': {
      download: { url: googleFonts(italic), license },
      variation: { wght: 700 },
      localNames: names('Bold Italic'),
    },
  };
};

const DEJAVU_PREFIX = 'dejavu-fonts-ttf-2.37/ttf/';
const LIBERATION_PREFIX = 'liberation-fonts-ttf-2.1.5/';

export const VARIANT_SOURCES: Readonly<Record<string, VariantSources>> = {
  arial: local('arialbd.ttf', 'ariali.ttf', 'arialbi.ttf'),
  verdana: local('verdanab.ttf', 'verdanai.ttf', 'verdanaz.ttf'),
  tahoma: local('tahomabd.ttf'),
  'trebuchet-ms': local('trebucbd.ttf', 'trebucit.ttf', 'trebucbi.ttf'),
  'times-new-roman': local('timesbd.ttf', 'timesi.ttf', 'timesbi.ttf'),
  georgia: local('georgiab.ttf', 'georgiai.ttf', 'georgiaz.ttf'),
  'courier-new': local('courbd.ttf', 'couri.ttf', 'courbi.ttf'),
  'segoe-ui': local('segoeuib.ttf', 'segoeuii.ttf', 'segoeuiz.ttf'),
  calibri: local('calibrib.ttf', 'calibrii.ttf', 'calibriz.ttf'),
  candara: local('Candarab.ttf', 'Candarai.ttf', 'Candaraz.ttf'),
  corbel: local('corbelb.ttf', 'corbeli.ttf', 'corbelz.ttf'),
  cambria: local('cambriab.ttf', 'cambriai.ttf', 'cambriaz.ttf'),
  constantia: local('constanb.ttf', 'constani.ttf', 'constanz.ttf'),
  'palatino-linotype': local('palab.ttf', 'palai.ttf', 'palabi.ttf'),
  consolas: local('consolab.ttf', 'consolai.ttf', 'consolaz.ttf'),
  roboto: variable(
    'Roboto',
    'ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf',
    'ofl/roboto/Roboto-Italic%5Bwdth%2Cwght%5D.ttf',
    'OFL-1.1',
  ),
  'noto-sans': variable(
    'Noto Sans',
    'ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf',
    'ofl/notosans/NotoSans-Italic%5Bwdth%2Cwght%5D.ttf',
    'OFL-1.1',
  ),
  'noto-serif': variable(
    'Noto Serif',
    'ofl/notoserif/NotoSerif%5Bwdth%2Cwght%5D.ttf',
    'ofl/notoserif/NotoSerif-Italic%5Bwdth%2Cwght%5D.ttf',
    'OFL-1.1',
  ),
  arimo: variable(
    'Arimo',
    'ofl/arimo/Arimo%5Bwght%5D.ttf',
    'ofl/arimo/Arimo-Italic%5Bwght%5D.ttf',
    'OFL-1.1',
  ),
  tinos: google('ofl/tinos', 'Tinos', 'OFL-1.1'),
  cousine: google('ofl/cousine', 'Cousine', 'OFL-1.1'),
  carlito: google('ofl/carlito', 'Carlito', 'OFL-1.1'),
  caladea: google('ofl/caladea', 'Caladea', 'OFL-1.1'),
  ubuntu: google('ufl/ubuntu', 'Ubuntu', 'UFL-1.0'),
  'ubuntu-mono': google('ufl/ubuntumono', 'UbuntuMono', 'UFL-1.0'),
  lato: google('ofl/lato', 'Lato', 'OFL-1.1'),
  'dejavu-sans': archive(DEJAVU, DEJAVU_PREFIX, 'DejaVuSans', 'Bitstream-Vera', 'Oblique'),
  'dejavu-serif': archive(DEJAVU, DEJAVU_PREFIX, 'DejaVuSerif', 'Bitstream-Vera', 'Italic'),
  'dejavu-sans-mono': archive(DEJAVU, DEJAVU_PREFIX, 'DejaVuSansMono', 'Bitstream-Vera', 'Oblique'),
  'liberation-sans': archive(LIBERATION, LIBERATION_PREFIX, 'LiberationSans', 'OFL-1.1', 'Italic'),
  'liberation-serif': archive(
    LIBERATION,
    LIBERATION_PREFIX,
    'LiberationSerif',
    'OFL-1.1',
    'Italic',
  ),
  'liberation-mono': archive(LIBERATION, LIBERATION_PREFIX, 'LiberationMono', 'OFL-1.1', 'Italic'),
};
