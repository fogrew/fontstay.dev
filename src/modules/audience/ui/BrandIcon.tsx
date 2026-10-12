import { Icon, type IconName } from '@/common/ui';
import type { Os } from '../lib/os';

const OS_ICONS: Partial<Record<Os, IconName>> = {
  windows: 'windows',
  macos: 'macos',
  linux: 'linux',
  android: 'android',
  ios: 'ios',
};

const BROWSER_ICONS: Record<string, IconName> = {
  chrome: 'chrome',
  and_chr: 'chrome',
  firefox: 'firefox',
  and_ff: 'firefox',
  safari: 'safari',
  ios_saf: 'safari',
  edge: 'edge',
  opera: 'opera',
  op_mob: 'opera',
  op_mini: 'opera',
  samsung: 'samsung',
  kaios: 'kaios',
  and_qq: 'qq',
  android: 'android',
};

export function OsIcon({ os }: { os: string }) {
  const name = OS_ICONS[os as Os];
  return name ? <Icon name={name} /> : null;
}

export function BrowserIcon({ id }: { id: string }) {
  const name = BROWSER_ICONS[id];
  return name ? <Icon name={name} /> : null;
}
