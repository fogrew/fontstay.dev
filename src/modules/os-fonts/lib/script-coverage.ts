import raw from '../data/script-coverage.json';
import type { MetricsSource } from './metrics';

export interface ScriptCoverageEntry {
  id: string;
  family: string;
  aliases: string[];
  source: MetricsSource;
  scripts: Record<string, number>;
}

const data = raw as { totals: Record<string, number>; fonts: ScriptCoverageEntry[] };

export const scriptCoverageEntries = data.fonts;

export function scriptShare(entry: ScriptCoverageEntry, script: string): number {
  const total = data.totals[script];
  return total ? (entry.scripts[script] ?? 0) / total : 0;
}

let byName: Map<string, ScriptCoverageEntry> | undefined;

export function scriptCoverage(font: string): ScriptCoverageEntry | undefined {
  if (!byName) {
    byName = new Map();
    for (const entry of scriptCoverageEntries) {
      for (const name of [entry.family, ...entry.aliases]) byName.set(name, entry);
    }
  }
  return byName.get(font);
}
