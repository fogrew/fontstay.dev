import { quoteName } from '@/modules/export';
import { type OsId, scriptCoverage, scriptShare } from '@/modules/os-fonts';

export const STACK_SCRIPTS = [
  'arabic',
  'hebrew',
  'devanagari',
  'bengali',
  'tamil',
  'thai',
  'japanese',
  'korean',
  'chinese_hans',
  'chinese_hant',
] as const;
export type StackScript = (typeof STACK_SCRIPTS)[number];

type Span = readonly [number, number];

interface ScriptStack {
  langs: readonly string[];
  spans: readonly Span[];
  core: readonly Span[];
  minShare: number;
  fonts: Partial<Record<OsId, readonly string[]>>;
}

const NOTO = (name: string) => [`Noto Sans ${name}`];
const CJK = (region: string) => [`Noto Sans CJK ${region}`];

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
    core: [[0x600, 0x6ff]],
    minShare: 0.8,
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
    core: [[0x590, 0x5ff]],
    minShare: 0.8,
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
    core: [[0x900, 0x97f]],
    minShare: 0.8,
    fonts: {
      windows: ['Nirmala UI'],
      macos: ['Devanagari Sangam MN'],
      ios: ['Devanagari Sangam MN'],
      android: NOTO('Devanagari'),
      linux: NOTO('Devanagari'),
      chromeos: NOTO('Devanagari'),
    },
  },
  bengali: {
    langs: ['bn', 'as'],
    spans: [[0x980, 0x9ff]],
    core: [[0x980, 0x9ff]],
    minShare: 0.8,
    fonts: {
      windows: ['Nirmala UI'],
      macos: ['Bangla Sangam MN'],
      ios: ['Bangla Sangam MN'],
      android: NOTO('Bengali'),
      linux: NOTO('Bengali'),
      chromeos: NOTO('Bengali'),
    },
  },
  tamil: {
    langs: ['ta'],
    spans: [[0xb80, 0xbff]],
    core: [[0xb80, 0xbff]],
    minShare: 0.8,
    fonts: {
      windows: ['Nirmala UI'],
      macos: ['Tamil Sangam MN'],
      ios: ['Tamil Sangam MN'],
      android: NOTO('Tamil'),
      linux: NOTO('Tamil'),
      chromeos: NOTO('Tamil'),
    },
  },
  thai: {
    langs: ['th'],
    spans: [[0xe00, 0xe7f]],
    core: [[0xe00, 0xe7f]],
    minShare: 0.8,
    fonts: {
      windows: ['Leelawadee UI', 'Tahoma'],
      macos: ['Thonburi'],
      ios: ['Thonburi'],
      android: NOTO('Thai'),
      linux: NOTO('Thai'),
      chromeos: NOTO('Thai'),
    },
  },
  japanese: {
    langs: ['ja'],
    spans: [[0x3040, 0x30ff]],
    core: [[0x3040, 0x30ff]],
    minShare: 0.9,
    fonts: {
      windows: ['Yu Gothic', 'MS Gothic'],
      macos: ['Hiragino Sans'],
      ios: ['Hiragino Sans'],
      android: CJK('JP'),
      linux: CJK('JP'),
      chromeos: CJK('JP'),
    },
  },
  korean: {
    langs: ['ko'],
    spans: [
      [0x1100, 0x11ff],
      [0xac00, 0xd7af],
    ],
    core: [[0xac00, 0xd7a3]],
    minShare: 0.9,
    fonts: {
      windows: ['Malgun Gothic'],
      macos: ['Apple SD Gothic Neo'],
      ios: ['Apple SD Gothic Neo'],
      android: CJK('KR'),
      linux: CJK('KR'),
      chromeos: CJK('KR'),
    },
  },
  chinese_hans: {
    langs: ['zh-Hans', 'zh-CN', 'zh-SG'],
    spans: [[0x4e00, 0x9fff]],
    core: [[0x4e00, 0x9fff]],
    minShare: 0.5,
    fonts: {
      windows: ['Microsoft YaHei', 'SimSun'],
      macos: ['PingFang SC'],
      ios: ['PingFang SC'],
      android: CJK('SC'),
      linux: CJK('SC'),
      chromeos: CJK('SC'),
    },
  },
  chinese_hant: {
    langs: ['zh-Hant', 'zh-TW', 'zh-HK', 'zh-MO'],
    spans: [[0x4e00, 0x9fff]],
    core: [[0x4e00, 0x9fff]],
    minShare: 0.5,
    fonts: {
      windows: ['Microsoft JhengHei'],
      macos: ['PingFang TC'],
      ios: ['PingFang TC'],
      android: CJK('TC'),
      linux: CJK('TC'),
      chromeos: CJK('TC'),
    },
  },
};

export const SCRIPT_CORE_SPANS: Record<StackScript, readonly Span[]> = Object.fromEntries(
  STACK_SCRIPTS.map((script) => [script, STACKS[script].core]),
) as Record<StackScript, readonly Span[]>;

const MIN_LETTERS = 20;

export function uncoveredScripts(codePoints: ArrayLike<number>): StackScript[] {
  const counts = Object.fromEntries(STACK_SCRIPTS.map((script) => [script, 0])) as Record<
    StackScript,
    number
  >;
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

export function fontCoversScript(font: string, script: StackScript): boolean | undefined {
  const entry = scriptCoverage(font);
  if (!entry) return undefined;
  return scriptShare(entry, script) >= STACKS[script].minShare;
}

export function scriptStackFonts(script: StackScript, systems: readonly OsId[]): string[] {
  const stack = STACKS[script];
  const fonts = systems.flatMap((os) => stack.fonts[os] ?? []);
  return [...new Set(fonts)].filter((font) => fontCoversScript(font, script) !== false);
}

export function scriptStackCandidates(script: StackScript): string[] {
  return [...new Set(Object.values(STACKS[script].fonts).flat())];
}

export function scriptStackRules(
  scripts: readonly StackScript[],
  systems: readonly OsId[],
  generic: string,
): string {
  const rules: string[] = [];
  for (const script of STACK_SCRIPTS) {
    if (!scripts.includes(script)) continue;
    const fonts = scriptStackFonts(script, systems);
    if (fonts.length === 0) continue;
    rules.push(
      [
        `${STACKS[script].langs.map((lang) => `:lang(${lang})`).join(', ')} {`,
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
    if (
      (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
      (codePoint >= 0x2600 && codePoint <= 0x27bf)
    )
      count++;
  }
  return count < MIN_EMOJI;
}

export function emojiFonts(systems: readonly OsId[]): string[] {
  return [...new Set(systems.flatMap((os) => EMOJI_FONTS[os] ?? []))];
}
