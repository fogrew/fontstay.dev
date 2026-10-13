import type { ExportFamily, ExportFont } from '@/modules/export';
import type { OsId } from '@/modules/os-fonts';
import { RULE_SELECTOR } from './css';
import type { Candidate, Plan } from './per-os';

export interface FontOutput {
  targetFamily: string;
  generic: string;
  fontFaces: string;
  families: readonly string[];
  strategy: string;
  fileName: string;
  weight: number;
  style: 'normal' | 'italic';
}

export function slugOf(family: string): string {
  const slug = family
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
  return /^\p{L}/u.test(slug) ? slug : `font-${slug}`.replace(/-$/, '');
}

export function currentFallback(
  plan: Plan | undefined,
  chosen: readonly { os: OsId; faceId: string; candidate: Candidate }[],
  os: OsId | undefined,
): Candidate | undefined {
  if (!plan) return undefined;
  const winner = os
    ? plan.resolution.platforms.find((item) => item.platform === os)?.winner
    : undefined;
  return (
    chosen.find((item) => item.os === os && item.faceId === winner)?.candidate ??
    chosen.find((item) => item.os === os)?.candidate ??
    chosen[0]?.candidate
  );
}

export function groupFonts(outputs: readonly FontOutput[]): ExportFamily[] {
  const groups = new Map<string, { generic: string; families: string[]; fonts: ExportFont[] }>();
  for (const output of outputs) {
    const group = groups.get(output.targetFamily) ?? {
      generic: output.generic,
      families: [],
      fonts: [],
    };
    for (const family of output.families) {
      if (!group.families.includes(family)) group.families.push(family);
    }
    group.fonts.push({ fileName: output.fileName, weight: output.weight, style: output.style });
    groups.set(output.targetFamily, group);
  }
  return [...groups.entries()].map(([targetFamily, group]) => ({ targetFamily, ...group }));
}

export function mergeOutputs(outputs: readonly FontOutput[], extra: string): string {
  const blocks = new Set<string>();
  for (const output of outputs) {
    for (const block of output.fontFaces.split('\n\n')) if (block) blocks.add(block);
  }
  const families = groupFonts(outputs);
  const single = families.length === 1;
  const used = new Set<string>();
  const rules = families.map((family) => {
    let slug = slugOf(family.targetFamily);
    for (let count = 2; used.has(slug); count++) slug = `${slugOf(family.targetFamily)}-${count}`;
    used.add(slug);
    const strategy = outputs.find(
      (output) => output.targetFamily === family.targetFamily,
    )?.strategy;
    const lines = [
      `font-family: ${family.families.join(', ')}, ${family.generic};`,
      ...(strategy ?? '').split('\n').filter(Boolean),
    ];
    return [
      `${single ? RULE_SELECTOR : `.${slug}`} {`,
      ...lines.map((line) => `  ${line}`),
      '}',
    ].join('\n');
  });
  return [[...blocks].join('\n\n'), ...rules, extra].filter(Boolean).join('\n\n');
}
