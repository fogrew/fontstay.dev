import { quoteName } from '@/modules/export';
import type { OsId } from '@/modules/os-fonts';

export const STACK_SCRIPTS = ['arabic', 'hebrew', 'devanagari', 'thai'] as const;
export type StackScript = (typeof STACK_SCRIPTS)[number];

type Span = readonly [number, number];

interface ScriptStack {
  langs: readonly string[];
  spans: readonly Span[];
  fonts: Partial<Record<OsId, readonly string[]>>;
}

const NOTO = (name: string) => [`Noto Sans ${name}`];

const STACKS: Record<StackScript, ScriptStack> = {
  arabic: {
    langs: ['ar', 'fa', 'ur', 'ps', 'ckb', 'sd'],
    spans: [
      [0x600, 0x6ff],
      [0x750, 0x77f],
      [0x8a0, 0x8ff],
      [0xfb50, 0xfdff],
      [0xfe70, 0xfeff],
    ],
    fonts: {
      windows: ['Segoe UI', 'Tahoma'],
      macos: ['Geeza Pro'],
      ios: ['Geeza Pro'],
      android: ['Noto Naskh Arabic', ...NOTO('Arabic')],
      linux: NOTO('Arabic'),
      chromeos: NOTO('Arabic'),
    },
  },
  hebrew: {
    langs: ['he', 'iw', 'yi'],
    spans: [
      [0x590, 0x5ff],
      [0xfb1d, 0xfb4f],
    ],
    fonts: {
      windows: ['Segoe UI', 'Arial'],
      macos: ['Arial Hebrew'],
      ios: ['Arial Hebrew'],
      android: NOTO('Hebrew'),
      linux: NOTO('Hebrew'),
      chromeos: NOTO('Hebrew'),
    },
  },
  devanagari: {
    langs: ['hi', 'mr', 'ne', 'sa'],
    spans: [
      [0x900, 0x97f],
      [0xa8e0, 0xa8ff],
    ],
    fonts: {
      windows: ['Nirmala UI'],
      macos: ['Devanagari Sangam MN'],
      ios: ['Devanagari Sangam MN'],
      android: NOTO('Devanagari'),
      linux: NOTO('Devanagari'),
      chromeos: NOTO('Devanagari'),
    },
  },
  thai: {
    langs: ['th'],
    spans: [[0xe00, 0xe7f]],
    fonts: {
      windows: ['Leelawadee UI', 'Tahoma'],
      macos: ['Thonburi'],
      ios: ['Thonburi'],
      android: NOTO('Thai'),
      linux: NOTO('Thai'),
      chromeos: NOTO('Thai'),
    },
  },
};

const MIN_LETTERS = 20;

export function uncoveredScripts(codePoints: ArrayLike<number>): StackScript[] {
  const counts: Record<StackScript, number> = { arabic: 0, hebrew: 0, devanagari: 0, thai: 0 };
  for (let index = 0; index < codePoints.length; index++) {
    const codePoint = codePoints[index] as number;
    for (const script of STACK_SCRIPTS) {
      if (
        STACKS[script].spans.some(([from, to]) => codePoint >= from && codePoint <= to) &&
        /\p{L}/u.test(String.fromCodePoint(codePoint))
      ) {
        counts[script]++;
      }
    }
  }
  return STACK_SCRIPTS.filter((script) => counts[script] < MIN_LETTERS);
}

export function scriptStackRules(
  scripts: readonly StackScript[],
  systems: readonly OsId[],
  generic: string,
): string {
  const rules: string[] = [];
  for (const script of STACK_SCRIPTS) {
    if (!scripts.includes(script)) continue;
    const stack = STACKS[script];
    const fonts = [...new Set(systems.flatMap((os) => stack.fonts[os] ?? []))];
    if (fonts.length === 0) continue;
    rules.push(
      [
        `${stack.langs.map((lang) => `:lang(${lang})`).join(', ')} {`,
        `  font-family: ${[...fonts.map(quoteName), generic].join(', ')};`,
        '}',
      ].join('\n'),
    );
  }
  return rules.join('\n\n');
}

const EMOJI_FONTS: Partial<Record<OsId, readonly string[]>> = {
  windows: ['Segoe UI Emoji'],
  macos: ['Apple Color Emoji'],
  ios: ['Apple Color Emoji'],
  android: ['Noto Color Emoji'],
  linux: ['Noto Color Emoji'],
  chromeos: ['Noto Color Emoji'],
};

const MIN_EMOJI = 20;

export function lacksEmoji(codePoints: ArrayLike<number>): boolean {
  let count = 0;
  for (let index = 0; index < codePoints.length; index++) {
    const codePoint = codePoints[index] as number;
    if (codePoint >= 0x1f300 && codePoint <= 0x1faff) count++;
  }
  return count < MIN_EMOJI;
}

export function emojiFonts(systems: readonly OsId[]): string[] {
  return [...new Set(systems.flatMap((os) => EMOJI_FONTS[os] ?? []))];
}
