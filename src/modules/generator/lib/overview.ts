import type { OsId } from '@/modules/os-fonts';
import { RULE_SELECTOR } from './css';
import type { Candidate, Plan } from './per-os';

export interface FontOutput {
  targetFamily: string;
  generic: string;
  fontFaces: string;
  families: readonly string[];
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

export function mergeOutputs(
  outputs: readonly FontOutput[],
  strategy: string,
  extra: string,
): string {
  const blocks = new Set<string>();
  for (const output of outputs) {
    for (const block of output.fontFaces.split('\n\n')) if (block) blocks.add(block);
  }
  const groups = new Map<string, { families: string[]; generic: string }>();
  for (const output of outputs) {
    const group = groups.get(output.targetFamily) ?? { families: [], generic: output.generic };
    for (const family of output.families) {
      if (!group.families.includes(family)) group.families.push(family);
    }
    groups.set(output.targetFamily, group);
  }
  const single = groups.size === 1;
  const used = new Set<string>();
  const rules = [...groups.entries()].map(([family, group]) => {
    let slug = slugOf(family);
    for (let count = 2; used.has(slug); count++) slug = `${slugOf(family)}-${count}`;
    used.add(slug);
    const lines = [
      `font-family: ${group.families.join(', ')}, ${group.generic};`,
      ...(single ? strategy.split('\n').filter(Boolean) : []),
    ];
    return [
      `${single ? RULE_SELECTOR : `.${slug}`} {`,
      ...lines.map((line) => `  ${line}`),
      '}',
    ].join('\n');
  });
  return [[...blocks].join('\n\n'), ...rules, extra].filter(Boolean).join('\n\n');
}
