export const OS_IDS = ['windows', 'macos', 'linux', 'chromeos', 'android', 'ios', 'other'] as const;
export const DESKTOP_OS_IDS = ['windows', 'macos', 'linux', 'chromeos'] as const;

export type Os = (typeof OS_IDS)[number];
export type DesktopOs = (typeof DESKTOP_OS_IDS)[number];
export type OsShares = Record<Os, number>;
export type DesktopSplit = Record<DesktopOs, number>;

export const DEFAULT_DESKTOP_SPLIT: DesktopSplit = {
  windows: 76.51,
  macos: 17.94,
  linux: 3.8,
  chromeos: 1.75,
};

export const SPLIT_TOLERANCE = 0.05;

const DESKTOP_ALL: readonly Os[] = ['windows', 'macos', 'linux'];

const BROWSER_OS: Record<string, readonly Os[]> = {
  chrome: [...DESKTOP_ALL, 'chromeos'],
  firefox: DESKTOP_ALL,
  opera: DESKTOP_ALL,
  edge: DESKTOP_ALL,
  safari: ['macos'],
  ie: ['windows'],
  baidu: ['windows'],
  ios_saf: ['ios'],
  android: ['android'],
  and_chr: ['android'],
  and_ff: ['android'],
  and_uc: ['android'],
  and_qq: ['android'],
  samsung: ['android'],
  op_mob: ['android'],
};

export interface WeightedEntry {
  entry: string;
  usage: number;
}

export function emptyShares(): OsShares {
  return { windows: 0, macos: 0, linux: 0, chromeos: 0, android: 0, ios: 0, other: 0 };
}

export function splitTotal(split: DesktopSplit): number {
  return DESKTOP_OS_IDS.reduce((sum, id) => sum + split[id], 0);
}

export function isValidSplit(split: DesktopSplit): boolean {
  return (
    DESKTOP_OS_IDS.every((id) => Number.isFinite(split[id]) && split[id] >= 0) &&
    Math.abs(splitTotal(split) - 100) <= SPLIT_TOLERANCE
  );
}

export function osOf(entry: string): readonly Os[] {
  const id = entry.split(' ', 1)[0] ?? '';
  return BROWSER_OS[id] ?? ['other'];
}

export function osWeights(entry: string, split: DesktopSplit): [Os, number][] {
  const systems = osOf(entry);
  const splitWeights = systems.map((os) => (isDesktop(os) ? split[os] : 1));
  const splitSum = splitWeights.reduce((sum, value) => sum + value, 0);
  return systems.map((os, index) => [
    os,
    splitSum > 0 ? (splitWeights[index] ?? 0) / splitSum : 1 / systems.length,
  ]);
}

export function computeOsShares(entries: readonly WeightedEntry[], split: DesktopSplit): OsShares {
  const total = entries.reduce((sum, item) => sum + item.usage, 0);
  const shares = emptyShares();
  for (const { entry, usage } of entries) {
    const weight = total > 0 ? usage : 1;
    for (const [os, fraction] of osWeights(entry, split)) shares[os] += weight * fraction;
  }
  const sum = OS_IDS.reduce((acc, id) => acc + shares[id], 0);
  if (sum > 0) for (const id of OS_IDS) shares[id] = (shares[id] / sum) * 100;
  return shares;
}

function isDesktop(os: Os): os is DesktopOs {
  return (DESKTOP_OS_IDS as readonly string[]).includes(os);
}
