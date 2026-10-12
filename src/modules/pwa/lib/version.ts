export function parseVersion(text: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export type StartupNotice = { kind: 'none' } | { kind: 'updated'; from: string; to: string };

export function startupNotice(last: string | null, current: string): StartupNotice {
  if (!last || !parseVersion(last) || !parseVersion(current)) return { kind: 'none' };
  return compareVersions(current, last) > 0
    ? { kind: 'updated', from: last, to: current }
    : { kind: 'none' };
}

export function headingVersion(text: string): string | null {
  const match = /\[(\d+\.\d+\.\d+)\]/.exec(text);
  return match?.[1] ?? null;
}

export function hiddenSections(headings: readonly string[], since: string): boolean[] {
  return headings.map((heading) => {
    const version = headingVersion(heading);
    return version !== null && compareVersions(version, since) <= 0;
  });
}
