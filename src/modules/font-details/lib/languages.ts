interface LanguageData {
  languages: [code: string, characters: string][];
}

export interface LanguageRequirement {
  code: string;
  codePoints: number[];
}

function upperCase(char: string, code: string): string {
  try {
    return char.toLocaleUpperCase(code);
  } catch {
    return char.toUpperCase();
  }
}

function requirementOf(code: string, characters: string): LanguageRequirement {
  const points = new Set<number>();
  for (const char of characters) {
    points.add(char.codePointAt(0) as number);
    const upper = upperCase(char, code);
    if ([...upper].length === 1) points.add(upper.codePointAt(0) as number);
  }
  return { code, codePoints: [...points] };
}

export function languageRequirements(data: LanguageData): LanguageRequirement[] {
  return data.languages.map(([code, characters]) => requirementOf(code, characters));
}

export function supportedLanguages(
  codePoints: ArrayLike<number>,
  requirements: readonly LanguageRequirement[],
): string[] {
  const covered = new Set<number>(Array.from(codePoints));
  return requirements
    .filter(({ codePoints: needed }) => needed.every((point) => covered.has(point)))
    .map(({ code }) => code);
}

let cached: Promise<LanguageRequirement[]> | undefined;

export function loadLanguageRequirements(): Promise<LanguageRequirement[]> {
  cached ??= import('../data/languages.json')
    .then((module) => languageRequirements(module.default as unknown as LanguageData))
    .catch((error: unknown) => {
      cached = undefined;
      throw error;
    });
  return cached;
}
