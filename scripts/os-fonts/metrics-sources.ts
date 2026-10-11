const GOOGLE_FONTS = 'bd8f81ddb5c74d5c8897b36ad88b440266245103';
const googleFonts = (path: string) =>
  `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS}/${path}`;
const DEJAVU =
  'https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip';
const LIBERATION =
  'https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz';
const AOSP_DROID_MONO =
  'https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-10.0.0_r1/data/fonts/DroidSansMono.ttf?format=TEXT';

export interface Download {
  url: string;
  member?: string;
  base64?: boolean;
  license: string;
}

export interface MetricsSource {
  id: string;
  family: string;
  files: readonly string[];
  download?: Download;
}

export const METRICS_SOURCES: readonly MetricsSource[] = [
  { id: 'arial', family: 'Arial', files: ['arial.ttf'] },
  { id: 'verdana', family: 'Verdana', files: ['verdana.ttf'] },
  { id: 'tahoma', family: 'Tahoma', files: ['tahoma.ttf'] },
  { id: 'trebuchet-ms', family: 'Trebuchet MS', files: ['trebuc.ttf'] },
  { id: 'times-new-roman', family: 'Times New Roman', files: ['times.ttf'] },
  { id: 'georgia', family: 'Georgia', files: ['georgia.ttf'] },
  { id: 'courier-new', family: 'Courier New', files: ['cour.ttf'] },
  { id: 'segoe-ui', family: 'Segoe UI', files: ['segoeui.ttf'] },
  { id: 'calibri', family: 'Calibri', files: ['calibri.ttf'] },
  { id: 'candara', family: 'Candara', files: ['Candara.ttf'] },
  { id: 'corbel', family: 'Corbel', files: ['corbel.ttf'] },
  { id: 'cambria', family: 'Cambria', files: ['cambria.ttc'] },
  { id: 'constantia', family: 'Constantia', files: ['constan.ttf'] },
  { id: 'palatino-linotype', family: 'Palatino Linotype', files: ['pala.ttf'] },
  { id: 'consolas', family: 'Consolas', files: ['consola.ttf'] },
  { id: 'lucida-console', family: 'Lucida Console', files: ['lucon.ttf'] },
  { id: 'helvetica', family: 'Helvetica', files: ['Helvetica.ttc'] },
  { id: 'helvetica-neue', family: 'Helvetica Neue', files: ['HelveticaNeue.ttc'] },
  { id: 'lucida-grande', family: 'Lucida Grande', files: ['LucidaGrande.ttc'] },
  {
    id: 'roboto',
    family: 'Roboto',
    files: [],
    download: { url: googleFonts('ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf'), license: 'OFL-1.1' },
  },
  {
    id: 'noto-sans',
    family: 'Noto Sans',
    files: [],
    download: {
      url: googleFonts('ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf'),
      license: 'OFL-1.1',
    },
  },
  {
    id: 'noto-serif',
    family: 'Noto Serif',
    files: [],
    download: {
      url: googleFonts('ofl/notoserif/NotoSerif%5Bwdth%2Cwght%5D.ttf'),
      license: 'OFL-1.1',
    },
  },
  {
    id: 'arimo',
    family: 'Arimo',
    files: [],
    download: { url: googleFonts('ofl/arimo/Arimo%5Bwght%5D.ttf'), license: 'OFL-1.1' },
  },
  {
    id: 'tinos',
    family: 'Tinos',
    files: [],
    download: { url: googleFonts('ofl/tinos/Tinos-Regular.ttf'), license: 'OFL-1.1' },
  },
  {
    id: 'cousine',
    family: 'Cousine',
    files: [],
    download: { url: googleFonts('ofl/cousine/Cousine-Regular.ttf'), license: 'OFL-1.1' },
  },
  {
    id: 'carlito',
    family: 'Carlito',
    files: [],
    download: { url: googleFonts('ofl/carlito/Carlito-Regular.ttf'), license: 'OFL-1.1' },
  },
  {
    id: 'caladea',
    family: 'Caladea',
    files: [],
    download: { url: googleFonts('ofl/caladea/Caladea-Regular.ttf'), license: 'OFL-1.1' },
  },
  {
    id: 'ubuntu',
    family: 'Ubuntu',
    files: [],
    download: { url: googleFonts('ufl/ubuntu/Ubuntu-Regular.ttf'), license: 'UFL-1.0' },
  },
  {
    id: 'ubuntu-mono',
    family: 'Ubuntu Mono',
    files: [],
    download: { url: googleFonts('ufl/ubuntumono/UbuntuMono-Regular.ttf'), license: 'UFL-1.0' },
  },
  {
    id: 'lato',
    family: 'Lato',
    files: [],
    download: { url: googleFonts('ofl/lato/Lato-Regular.ttf'), license: 'OFL-1.1' },
  },
  {
    id: 'dejavu-sans',
    family: 'DejaVu Sans',
    files: [],
    download: {
      url: DEJAVU,
      member: 'dejavu-fonts-ttf-2.37/ttf/DejaVuSans.ttf',
      license: 'Bitstream-Vera',
    },
  },
  {
    id: 'dejavu-serif',
    family: 'DejaVu Serif',
    files: [],
    download: {
      url: DEJAVU,
      member: 'dejavu-fonts-ttf-2.37/ttf/DejaVuSerif.ttf',
      license: 'Bitstream-Vera',
    },
  },
  {
    id: 'dejavu-sans-mono',
    family: 'DejaVu Sans Mono',
    files: [],
    download: {
      url: DEJAVU,
      member: 'dejavu-fonts-ttf-2.37/ttf/DejaVuSansMono.ttf',
      license: 'Bitstream-Vera',
    },
  },
  {
    id: 'liberation-sans',
    family: 'Liberation Sans',
    files: [],
    download: {
      url: LIBERATION,
      member: 'liberation-fonts-ttf-2.1.5/LiberationSans-Regular.ttf',
      license: 'OFL-1.1',
    },
  },
  {
    id: 'liberation-serif',
    family: 'Liberation Serif',
    files: [],
    download: {
      url: LIBERATION,
      member: 'liberation-fonts-ttf-2.1.5/LiberationSerif-Regular.ttf',
      license: 'OFL-1.1',
    },
  },
  {
    id: 'liberation-mono',
    family: 'Liberation Mono',
    files: [],
    download: {
      url: LIBERATION,
      member: 'liberation-fonts-ttf-2.1.5/LiberationMono-Regular.ttf',
      license: 'OFL-1.1',
    },
  },
  {
    id: 'droid-sans-mono',
    family: 'Droid Sans Mono',
    files: [],
    download: { url: AOSP_DROID_MONO, base64: true, license: 'Apache-2.0' },
  },
];

export const SCRIPT_RANGES: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa0, 0x24f],
  [0x370, 0x3ff],
  [0x400, 0x4ff],
  [0x2010, 0x2027],
  [0x2030, 0x203a],
  [0x20ac, 0x20ac],
  [0x2116, 0x2116],
  [0x2122, 0x2122],
];
