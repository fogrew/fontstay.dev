import type { Category } from '../../src/modules/os-fonts/lib/model.ts';

export interface FamilySpec {
  id: string;
  family: string;
  category: Category;
  windows?: string;
  apple?: string;
  androidFiles?: RegExp;
  linuxPackages?: readonly string[];
  chromeosPackages?: readonly string[];
}

const shared = (id: string, family: string, category: Category): FamilySpec => ({
  id,
  family,
  category,
  windows: family,
  apple: family,
});

export const FAMILIES: readonly FamilySpec[] = [
  shared('arial', 'Arial', 'sans-serif'),
  shared('verdana', 'Verdana', 'sans-serif'),
  shared('tahoma', 'Tahoma', 'sans-serif'),
  shared('trebuchet-ms', 'Trebuchet MS', 'sans-serif'),
  shared('times-new-roman', 'Times New Roman', 'serif'),
  shared('georgia', 'Georgia', 'serif'),
  shared('courier-new', 'Courier New', 'monospace'),
  { id: 'segoe-ui', family: 'Segoe UI', category: 'sans-serif', windows: 'Segoe UI' },
  { id: 'calibri', family: 'Calibri', category: 'sans-serif', windows: 'Calibri' },
  { id: 'candara', family: 'Candara', category: 'sans-serif', windows: 'Candara' },
  { id: 'corbel', family: 'Corbel', category: 'sans-serif', windows: 'Corbel' },
  { id: 'cambria', family: 'Cambria', category: 'serif', windows: 'Cambria' },
  { id: 'constantia', family: 'Constantia', category: 'serif', windows: 'Constantia' },
  {
    id: 'palatino-linotype',
    family: 'Palatino Linotype',
    category: 'serif',
    windows: 'Palatino Linotype',
  },
  { id: 'consolas', family: 'Consolas', category: 'monospace', windows: 'Consolas' },
  {
    id: 'lucida-console',
    family: 'Lucida Console',
    category: 'monospace',
    windows: 'Lucida Console',
  },
  { id: 'helvetica', family: 'Helvetica', category: 'sans-serif', apple: 'Helvetica' },
  {
    id: 'helvetica-neue',
    family: 'Helvetica Neue',
    category: 'sans-serif',
    apple: 'Helvetica Neue',
  },
  { id: 'lucida-grande', family: 'Lucida Grande', category: 'sans-serif', apple: 'Lucida Grande' },
  {
    id: 'roboto',
    family: 'Roboto',
    category: 'sans-serif',
    androidFiles: /^Roboto(Static)?-/,
    chromeosPackages: ['robotofonts'],
  },
  {
    id: 'noto-serif',
    family: 'Noto Serif',
    category: 'serif',
    androidFiles: /^NotoSerif-/,
    linuxPackages: ['fonts-noto-core'],
    chromeosPackages: ['notofonts'],
  },
  {
    id: 'noto-sans',
    family: 'Noto Sans',
    category: 'sans-serif',
    androidFiles: /^NotoSans-/,
    linuxPackages: ['fonts-noto-core'],
    chromeosPackages: ['notofonts'],
  },
  {
    id: 'droid-sans-mono',
    family: 'Droid Sans Mono',
    category: 'monospace',
    androidFiles: /^DroidSansMono\./,
  },
  {
    id: 'dejavu-sans',
    family: 'DejaVu Sans',
    category: 'sans-serif',
    linuxPackages: ['fonts-dejavu-core'],
  },
  {
    id: 'dejavu-serif',
    family: 'DejaVu Serif',
    category: 'serif',
    linuxPackages: ['fonts-dejavu-core'],
  },
  {
    id: 'dejavu-sans-mono',
    family: 'DejaVu Sans Mono',
    category: 'monospace',
    linuxPackages: ['fonts-dejavu-core', 'fonts-dejavu-mono'],
  },
  {
    id: 'liberation-sans',
    family: 'Liberation Sans',
    category: 'sans-serif',
    linuxPackages: ['fonts-liberation', 'fonts-liberation2'],
  },
  {
    id: 'liberation-serif',
    family: 'Liberation Serif',
    category: 'serif',
    linuxPackages: ['fonts-liberation', 'fonts-liberation2'],
  },
  {
    id: 'liberation-mono',
    family: 'Liberation Mono',
    category: 'monospace',
    linuxPackages: ['fonts-liberation', 'fonts-liberation2'],
  },
  { id: 'ubuntu', family: 'Ubuntu', category: 'sans-serif', linuxPackages: ['fonts-ubuntu'] },
  {
    id: 'ubuntu-mono',
    family: 'Ubuntu Mono',
    category: 'monospace',
    linuxPackages: ['fonts-ubuntu'],
  },
  { id: 'lato', family: 'Lato', category: 'sans-serif', linuxPackages: ['fonts-lato'] },
  { id: 'arimo', family: 'Arimo', category: 'sans-serif', chromeosPackages: ['croscorefonts'] },
  { id: 'tinos', family: 'Tinos', category: 'serif', chromeosPackages: ['croscorefonts'] },
  { id: 'cousine', family: 'Cousine', category: 'monospace', chromeosPackages: ['croscorefonts'] },
  {
    id: 'carlito',
    family: 'Carlito',
    category: 'sans-serif',
    chromeosPackages: ['crosextrafonts-carlito'],
  },
  { id: 'caladea', family: 'Caladea', category: 'serif', chromeosPackages: ['crosextrafonts'] },
];

export const CHROMEOS_SOURCE = [
  'current',
  'https://chromium.googlesource.com/chromiumos/overlays/chromiumos-overlay/+/refs/heads/main/chromeos-base/chromeos-fonts/chromeos-fonts-0.0.1.ebuild',
] as const;

export const ANDROID_TAGS = [
  ['10', 'android-10.0.0_r1'],
  ['11', 'android-11.0.0_r1'],
  ['12', 'android-12.0.0_r1'],
  ['13', 'android-13.0.0_r1'],
  ['14', 'android-14.0.0_r1'],
  ['15', 'android-15.0.0_r1'],
  ['16', 'android-16.0.0_r1'],
] as const;

export const UBUNTU_MANIFESTS = [
  ['ubuntu-20.04', 'https://releases.ubuntu.com/20.04/ubuntu-20.04.6-desktop-amd64.manifest'],
  ['ubuntu-22.04', 'https://releases.ubuntu.com/22.04/ubuntu-22.04.5-desktop-amd64.manifest'],
  ['ubuntu-24.04', 'https://releases.ubuntu.com/24.04/ubuntu-24.04.5.1-desktop-amd64.manifest'],
  ['ubuntu-26.04', 'https://releases.ubuntu.com/26.04/ubuntu-26.04.1-desktop-amd64.manifest'],
] as const;

export const DEBIAN_MANIFESTS = [
  [
    'debian-12',
    'https://cdimage.debian.org/cdimage/archive/12.15.0-live/amd64/iso-hybrid/debian-live-12.15.0-amd64-gnome.iso.packages',
  ],
  [
    'debian-13',
    'https://cdimage.debian.org/cdimage/archive/13.6.0-live/amd64/iso-hybrid/debian-live-13.6.0-amd64-gnome.iso.packages',
  ],
] as const;

export const WINDOWS_LISTS = [
  ['10', 'https://learn.microsoft.com/en-us/typography/fonts/windows_10_font_list'],
  ['11', 'https://learn.microsoft.com/en-us/typography/fonts/windows_11_font_list'],
] as const;

export const APPLE_SOURCE = 'https://developer.apple.com/fonts/system-fonts/';

export const OS_FONT_LIST_MACOS = [
  [
    '10.15',
    'https://raw.githubusercontent.com/adrg/os-font-list/master/csv/macOS/macOS-10.15_Catalina.csv',
  ],
] as const;
