export const MAX_STATS_BYTES = 1_000_000;
export const MAX_STATS_ENTRIES = 20_000;

export type UsageStats = Record<string, Record<string, number>>;

export type StatsErrorCode =
  | 'too-large'
  | 'not-json'
  | 'wrong-shape'
  | 'bad-value'
  | 'too-many'
  | 'empty';

export interface ImportedStats {
  stats: UsageStats;
  entries: number;
  unknownBrowsers: string[];
  unknownVersions: string[];
}

export type StatsResult =
  | ({ ok: true } & ImportedStats)
  | { ok: false; code: StatsErrorCode; detail: string };

type KnownData = Record<string, { versions: (string | null)[] } | undefined>;

const BROWSER_ID = /^[a-z_]{1,32}$/;
const STATS_FILE = /^browserslist[-_]stats.*\.json$/i;

export const isStatsFile = (name: string) => STATS_FILE.test(name);

export function parseStats(text: string, known: KnownData): StatsResult {
  if (text.length > MAX_STATS_BYTES) return { ok: false, code: 'too-large', detail: '' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: 'not-json', detail: '' };
  }
  if (!isRecord(parsed) || Object.keys(parsed).length === 0) {
    return { ok: false, code: 'wrong-shape', detail: '' };
  }

  const stats: UsageStats = Object.create(null);
  const unknownBrowsers: string[] = [];
  const unknownVersions: string[] = [];
  let seen = 0;
  let entries = 0;
  for (const [browser, versions] of Object.entries(parsed)) {
    const knownVersions = BROWSER_ID.test(browser) ? known[browser]?.versions : undefined;
    if (!knownVersions) {
      unknownBrowsers.push(label(browser));
      seen += 1;
      if (seen > MAX_STATS_ENTRIES) return { ok: false, code: 'too-many', detail: '' };
      continue;
    }
    if (!isRecord(versions)) {
      return { ok: false, code: 'wrong-shape', detail: label(browser) };
    }
    const kept: Record<string, number> = Object.create(null);
    for (const [version, share] of Object.entries(versions)) {
      seen += 1;
      if (seen > MAX_STATS_ENTRIES) return { ok: false, code: 'too-many', detail: '' };
      if (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 100) {
        return { ok: false, code: 'bad-value', detail: `${label(browser)} ${label(version)}` };
      }
      if (knownVersions.includes(version)) {
        kept[version] = share;
        entries += 1;
      } else unknownVersions.push(`${browser} ${label(version)}`);
    }
    stats[browser] = kept;
  }
  if (entries === 0) return { ok: false, code: 'empty', detail: '' };
  return { ok: true, stats, entries, unknownBrowsers, unknownVersions };
}

export async function importStats(text: string): Promise<StatsResult> {
  const { default: browserslist } = await import('browserslist');
  return parseStats(text, browserslist.data);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function label(text: string): string {
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
