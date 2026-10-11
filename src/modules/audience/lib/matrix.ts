import { browserName } from './names';
import { type DesktopSplit, type Os, osWeights, type WeightedEntry } from './os';
import { versionRanges } from './resolve';
import { verdictsOf } from './support';

export type CellState = 'full' | 'partial' | 'none' | 'unknown';
export type Variant = 'full' | 'partial' | 'none';

export interface MatrixCell {
  label: string;
  state: CellState;
  shift: number | null;
  baseline: number | null;
}

export interface MatrixColumn {
  browser: string;
  name: string;
  share: number;
  cells: MatrixCell[];
}

export interface MatrixGroup {
  os: Os;
  share: number;
  enabled: boolean;
  available: boolean;
  fonts: string;
  columns: MatrixColumn[];
  hiddenShare: number;
}

export interface SystemInfo {
  enabled: boolean;
  available: boolean;
  fonts: string;
  shift: (variant: Variant) => number | null;
}

export interface MatrixOptions {
  released: Record<string, readonly string[]>;
  minColumnShare?: number;
}

export function stateOf(entry: string): CellState {
  const verdicts = verdictsOf(entry);
  const adjust = verdicts['size-adjust'];
  if (adjust === 'unknown') return 'unknown';
  if (adjust === 'no') return 'none';
  const vertical = [
    verdicts['ascent-override'],
    verdicts['descent-override'],
    verdicts['line-gap-override'],
  ];
  if (vertical.every((verdict) => verdict === 'yes')) return 'full';
  return vertical.includes('no') ? 'partial' : 'unknown';
}

interface Weighted {
  version: string;
  weight: number;
}

export function buildMatrix(
  entries: readonly WeightedEntry[],
  split: DesktopSplit,
  systems: Partial<Record<Os, SystemInfo>>,
  options: MatrixOptions,
): MatrixGroup[] {
  const total = entries.reduce((sum, item) => sum + item.usage, 0);
  const columns = new Map<string, { os: Os; browser: string; items: Weighted[] }>();
  for (const { entry, usage } of entries) {
    const space = entry.indexOf(' ');
    const browser = entry.slice(0, space);
    const version = entry.slice(space + 1);
    const weight = total > 0 ? usage : 1;
    for (const [os, fraction] of osWeights(entry, split)) {
      if (fraction <= 0) continue;
      const key = `${os}|${browser}`;
      let column = columns.get(key);
      if (!column) {
        column = { os, browser, items: [] };
        columns.set(key, column);
      }
      column.items.push({ version, weight: weight * fraction });
    }
  }
  const sum = [...columns.values()].reduce(
    (acc, column) => acc + column.items.reduce((inner, item) => inner + item.weight, 0),
    0,
  );
  const percent = (value: number) => (sum > 0 ? (value / sum) * 100 : 0);
  const minShare = options.minColumnShare ?? 0.3;

  const groups = new Map<Os, MatrixGroup>();
  for (const column of columns.values()) {
    const system = systems[column.os];
    const released = options.released[column.browser] ?? [];
    const rank = (version: string) => {
      const at = released.indexOf(version);
      return at < 0 ? Number.MAX_SAFE_INTEGER : at;
    };
    const items = [...column.items].sort((a, b) => rank(a.version) - rank(b.version));
    const cells: MatrixCell[] = [];
    let run: string[] = [];
    let runState: CellState | undefined;
    let runRank = -1;
    const flush = () => {
      if (run.length === 0 || runState === undefined) return;
      const shift =
        system?.enabled && runState !== 'unknown' ? (system.shift(runState) ?? null) : null;
      const baseline =
        system?.enabled && (runState === 'full' || runState === 'partial')
          ? (system.shift('none') ?? null)
          : null;
      cells.push({
        label: versionRanges(run, released).join(', '),
        state: runState,
        shift,
        baseline,
      });
      run = [];
    };
    for (const item of items) {
      const detected = stateOf(`${column.browser} ${item.version}`);
      const state: CellState = system?.enabled
        ? detected
        : detected === 'unknown'
          ? 'unknown'
          : 'none';
      const adjacent = runRank >= 0 && rank(item.version) === runRank + 1;
      if (runState !== undefined && (state !== runState || !adjacent)) flush();
      runState = state;
      runRank = rank(item.version);
      run.push(item.version);
    }
    flush();
    const share = percent(column.items.reduce((acc, item) => acc + item.weight, 0));
    let group = groups.get(column.os);
    if (!group) {
      group = {
        os: column.os,
        share: 0,
        enabled: system?.enabled ?? false,
        available: system?.available ?? false,
        fonts: system?.fonts ?? '',
        columns: [],
        hiddenShare: 0,
      };
      groups.set(column.os, group);
    }
    group.share += share;
    if (share >= minShare) {
      group.columns.push({
        browser: column.browser,
        name: browserName(column.browser),
        share,
        cells,
      });
    } else {
      group.hiddenShare += share;
    }
  }
  const result = [...groups.values()];
  for (const group of result) group.columns.sort((a, b) => b.share - a.share);
  return result.sort((a, b) => b.share - a.share);
}
