const PREFIX = 'fontstay:layout:';

export function loadLayout<T>(
  key: string,
  parse: (value: unknown) => T | undefined,
): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function saveLayout(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage may be unavailable
  }
}

export function clearLayouts(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // storage may be unavailable
  }
}

export function parseSizes(
  value: unknown,
  ids: readonly string[],
): Record<string, number> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const sizes: Record<string, number> = {};
  for (const id of ids) {
    const entry = (value as Record<string, unknown>)[id];
    if (typeof entry === 'number' && Number.isFinite(entry) && entry > 0 && entry <= 1) {
      sizes[id] = entry;
    }
  }
  return Object.keys(sizes).length > 0 ? sizes : undefined;
}

export function parseIds(value: unknown, ids: readonly string[]): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && ids.includes(id))
    : [];
}
