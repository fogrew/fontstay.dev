import type { IconName } from '@/common/ui';
import type { Block } from '@/modules/layout-shift';
import type { SiteBlock } from './preview-item';

export type Run =
  | string
  | { bold: string }
  | { italic: string }
  | { sup: string }
  | { sub: string }
  | { code: string };

export interface Factor {
  icon: IconName;
  title: string;
  text: string;
}

export interface Article {
  id: ArticleKey;
  label: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  kicker: string;
  title: string;
  lead: string;
  meta: string;
  factors: Factor[];
  columnsHeading: string;
  columns: Run[][];
  quote: { text: string; cite: string };
  listHeading: string;
  list: Run[][];
  tableHeading: string;
  tableHead: [string, string];
  tableRows: [string, string][];
  glyphsHeading: string;
  glyphs: string;
  footer: string;
}

export const ARTICLE_LANGUAGES = [
  ['en', 'English'],
  ['ru', 'Русский'],
  ['ar', 'العربية'],
  ['ja', '日本語'],
  ['he', 'עברית'],
  ['hi', 'हिन्दी'],
  ['bn', 'বাংলা'],
  ['ta', 'தமிழ்'],
  ['th', 'ไทย'],
  ['ko', '한국어'],
  ['zh-Hans', '简体中文'],
  ['zh-Hant', '繁體中文'],
  ['km', 'ខ្មែរ'],
  ['te', 'తెలుగు'],
  ['gu', 'ગુજરાતી'],
  ['pa', 'ਪੰਜਾਬੀ'],
  ['kn', 'ಕನ್ನಡ'],
  ['ml', 'മലയാളം'],
  ['si', 'සිංහල'],
  ['am', 'አማርኛ'],
  ['hy', 'Հայերեն'],
  ['el', 'Ελληνικά'],
  ['lo', 'ລາວ'],
] as const;
export const ARTICLE_IDS = ARTICLE_LANGUAGES.map(([id]) => id);
export type ArticleId = (typeof ARTICLE_LANGUAGES)[number][0];
export type ArticleKey = ArticleId | 'site';

const en: Article = {
  id: 'en',
  label: 'English',
  lang: 'en',
  dir: 'ltr',
  kicker: 'Field notes · №7 · Typography & performance',
  title: 'Why the page jumps when a font loads',
  lead: 'A web font arrives a moment after the text is first painted. Until then the browser shows a fallback, and when the real font takes over, every line can change its width and every block its height.',
  meta: 'By the fontstay team · 12 min read · © 2026 · ½ of the story is in the metrics',
  factors: [
    {
      icon: 'text-width',
      title: 'Glyph width',
      text: 'Every typeface sets its letters at a different width, so the same sentence wraps at a different word.',
    },
    {
      icon: 'text-height',
      title: 'Line height',
      text: 'The font’s own ascent and descent and the line-height rule decide how much room a line takes.',
    },
    {
      icon: 'arrows-up-down',
      title: 'Vertical metrics',
      text: 'Ascent, descent and line gap live in the font file; a substitute with other numbers shifts the baseline.',
    },
    {
      icon: 'language',
      title: 'Scripts and fallbacks',
      text: 'Characters missing from the web font come from another family, which can make one line taller than its neighbours.',
    },
  ],
  columnsHeading: 'What moves, and why',
  columns: [
    [
      'Take a plain paragraph. In the ',
      { italic: 'fallback' },
      ' font it fills four lines; in the ',
      { bold: 'web font' },
      ' the same words need five. Everything below slides down by one line: that is a ',
      { bold: 'layout shift' },
      '.',
    ],
    [
      'Width is only half of the story. Each font carries its own ',
      { italic: 'ascent' },
      ', ',
      { italic: 'descent' },
      ' and ',
      { italic: 'line gap' },
      '. With ',
      { code: 'line-height: normal' },
      ' the browser builds the line box from them, so another font means another height even at the same size.',
    ],
    [
      'Inline elements add their own pressure: a ',
      { bold: 'bold' },
      ' run, an ',
      { italic: 'italic' },
      ' phrase, a superscript',
      { sup: '2' },
      ' or a symbol such as ™ may come from another face and stretch the line it sits on.',
    ],
    [
      'Headings are the most visible victims. A large title that jumps by a few pixels drags the whole article with it, which is why headings and body text deserve separate fallbacks.',
    ],
    [
      'Text can also be ',
      { italic: 're-balanced' },
      '. Modern ',
      { code: 'text-wrap: balance' },
      ' and ',
      { code: 'text-wrap: pretty' },
      ' change where lines break, so test with and without them.',
    ],
    [
      'The cure is boring and effective: scale the fallback with ',
      { code: 'size-adjust' },
      ' and give it the web font’s vertical metrics with ',
      { code: 'ascent-override' },
      ', ',
      { code: 'descent-override' },
      ' and ',
      { code: 'line-gap-override' },
      '.',
    ],
  ],
  quote: {
    text: 'The best layout shift is the one nobody notices.',
    cite: '— a rule of thumb',
  },
  listHeading: 'A checklist for the next release',
  list: [
    ['Pick the ', { bold: 'fallback' }, ' per system, not one for everybody.'],
    [
      'Compare ',
      { italic: 'regular' },
      ', ',
      { bold: 'bold' },
      ' and ',
      { italic: 'italic' },
      ' faces separately.',
    ],
    ['Test long and short lines, and with ', { code: 'text-wrap' }, ' on.'],
    ['Check scripts you do not read: Arabic, Japanese, Cyrillic.'],
  ],
  tableHeading: 'Where a line gets its height',
  tableHead: ['Cause', 'Effect'],
  tableRows: [
    ['Font size', 'Scales every metric'],
    ['line-height', 'Overrides the font’s own metrics'],
    ['Ascent and descent', 'Set the content area of the line'],
    ['Fallback glyphs', 'Can raise a single line'],
    ['Superscript and subscript', 'Push the line box up or down'],
  ],
  glyphsHeading: 'Special characters',
  glyphs:
    '& © ® ™ § ¶ † ‡ • … – — « » “ ” ‘ ’ № € £ ¥ ¢ % ‰ ° ± × ÷ ≈ ≠ ≤ ≥ ∞ √ π → ← ↑ ↓ ½ ¼ ¾ ¹ ² ³ ℃ ﬁ ﬂ',
  footer:
    'Set in two typefaces: the headings and the text come from different families. Switch the view above to compare the web font with its adjusted fallback.',
};

const ru: Article = {
  id: 'ru',
  label: 'Русский',
  lang: 'ru',
  dir: 'ltr',
  kicker: 'Заметки · №7 · Типографика и скорость',
  title: 'Почему страница прыгает при загрузке шрифта',
  lead: 'Веб-шрифт приходит чуть позже, чем текст впервые рисуется. До этого браузер показывает запасной шрифт, а когда настоящий вступает в силу, каждая строка может поменять ширину, а каждый блок — высоту.',
  meta: 'Команда fontstay · 12 минут · © 2026 · ½ истории спрятана в метриках',
  factors: [
    {
      icon: 'text-width',
      title: 'Ширина символов',
      text: 'У каждой гарнитуры буквы шире или уже, поэтому одно и то же предложение переносится на другом слове.',
    },
    {
      icon: 'text-height',
      title: 'Высота строки',
      text: 'Подъём и спуск самого шрифта и правило line-height решают, сколько места занимает строка.',
    },
    {
      icon: 'arrows-up-down',
      title: 'Вертикальные метрики',
      text: 'Подъём, спуск и межстрочный зазор записаны в файле шрифта; замена с другими числами сдвигает базовую линию.',
    },
    {
      icon: 'language',
      title: 'Письменности и замены',
      text: 'Символы, которых нет в веб-шрифте, берутся из другой семьи, и одна строка может стать выше соседних.',
    },
  ],
  columnsHeading: 'Что сдвигается и почему',
  columns: [
    [
      'Возьмём обычный абзац. В ',
      { italic: 'запасном' },
      ' шрифте он занимает четыре строки, в ',
      { bold: 'веб-шрифте' },
      ' те же слова требуют пяти. Всё ниже сползает на строку — это ',
      { bold: 'сдвиг вёрстки' },
      '.',
    ],
    [
      'Ширина — лишь половина дела. У каждого шрифта свои ',
      { italic: 'ascent' },
      ', ',
      { italic: 'descent' },
      ' и ',
      { italic: 'line gap' },
      '. При ',
      { code: 'line-height: normal' },
      ' браузер строит из них строку, поэтому другой шрифт даёт другую высоту при том же размере.',
    ],
    [
      'Встроенные элементы добавляют своё: ',
      { bold: 'жирный' },
      ' фрагмент, ',
      { italic: 'курсивная' },
      ' фраза, верхний индекс',
      { sup: '2' },
      ' или символ вроде ™ могут прийти из другой гарнитуры и растянуть строку.',
    ],
    [
      'Заголовки страдают заметнее всего. Крупный заголовок, прыгнувший на пару пикселей, тянет за собой всю статью, поэтому для заголовков и основного текста нужны отдельные запасные шрифты.',
    ],
    [
      'Текст ещё и ',
      { italic: 'перебалансируется' },
      '. Современные ',
      { code: 'text-wrap: balance' },
      ' и ',
      { code: 'text-wrap: pretty' },
      ' меняют места переносов — проверяйте с ними и без них.',
    ],
    [
      'Лекарство скучное, но работает: масштабируйте запасной шрифт через ',
      { code: 'size-adjust' },
      ' и задайте ему метрики веб-шрифта через ',
      { code: 'ascent-override' },
      ', ',
      { code: 'descent-override' },
      ' и ',
      { code: 'line-gap-override' },
      '.',
    ],
  ],
  quote: {
    text: 'Лучший сдвиг вёрстки — тот, которого никто не заметил.',
    cite: '— практическое правило',
  },
  listHeading: 'Чек-лист перед релизом',
  list: [
    ['Подбирайте ', { bold: 'запасной шрифт' }, ' под каждую систему, а не один на всех.'],
    [
      'Сравнивайте ',
      { italic: 'обычное' },
      ', ',
      { bold: 'жирное' },
      ' и ',
      { italic: 'курсивное' },
      ' начертания отдельно.',
    ],
    ['Проверяйте длинные и короткие строки, а также с включённым ', { code: 'text-wrap' }, '.'],
    ['Смотрите письменности, которых вы не читаете: арабскую, японскую, кириллицу.'],
  ],
  tableHeading: 'Откуда у строки берётся высота',
  tableHead: ['Причина', 'Следствие'],
  tableRows: [
    ['Размер шрифта', 'Масштабирует все метрики'],
    ['line-height', 'Перекрывает метрики самого шрифта'],
    ['Подъём и спуск', 'Задают область содержимого строки'],
    ['Символы из запасного шрифта', 'Могут поднять одну строку'],
    ['Верхний и нижний индексы', 'Сдвигают строку вверх или вниз'],
  ],
  glyphsHeading: 'Специальные символы',
  glyphs:
    '& © ® ™ § ¶ † ‡ • … – — « » „ “ ‘ ’ № € £ ¥ ¢ % ‰ ° ± × ÷ ≈ ≠ ≤ ≥ ∞ √ π → ← ↑ ↓ ½ ¼ ¾ ¹ ² ³ ℃ ё Ё',
  footer:
    'Набрано двумя гарнитурами: заголовки и текст из разных семей. Переключайте вид выше, чтобы сравнить веб-шрифт с подогнанным запасным.',
};

export const BUILT_IN: Record<'en' | 'ru', Article> = { en, ru };

export const isBuiltIn = (id: ArticleKey): id is 'en' | 'ru' => id === 'en' || id === 'ru';

export async function loadArticle(id: ArticleId): Promise<Article | undefined> {
  if (isBuiltIn(id)) return BUILT_IN[id];
  return (await import('./articles-more')).MORE[id];
}

const plain = (runs: readonly Run[]) =>
  runs.map((run) => (typeof run === 'string' ? run : Object.values(run)[0])).join('');

export function articleBlocks(article: Article): Block[] {
  const blocks: Block[] = [
    { tag: 'h1', text: article.title },
    { tag: 'p', text: article.lead },
    ...article.factors.flatMap((factor): Block[] => [
      { tag: 'h3', text: factor.title },
      { tag: 'p', text: factor.text },
    ]),
    { tag: 'h2', text: article.columnsHeading },
    ...article.columns.map((runs): Block => ({ tag: 'p', text: plain(runs) })),
    { tag: 'blockquote', text: article.quote.text },
    { tag: 'h2', text: article.listHeading },
    ...article.list.map((runs): Block => ({ tag: 'li', text: plain(runs) })),
  ];
  return blocks.filter((block) => block.text);
}

export const SITE_MIN_CHARS = 600;
export const SITE_MIN_BLOCKS = 3;

export function siteIsMeaningful(blocks: readonly SiteBlock[]): boolean {
  const total = blocks.reduce((sum, block) => sum + block.text.length, 0);
  return blocks.length >= SITE_MIN_BLOCKS && total >= SITE_MIN_CHARS;
}

const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/gu;
const LETTER = /\p{L}/gu;

export function isMostlyRtl(text: string): boolean {
  const letters = text.match(LETTER)?.length ?? 0;
  const rtl = text.match(RTL_LETTER)?.length ?? 0;
  return rtl * 2 > letters;
}

export function siteArticle(blocks: readonly SiteBlock[], label: string): Article {
  const texts = (role: SiteBlock['role']) =>
    blocks.filter((block) => block.role === role).map((block) => block.text);
  const [title = ''] = texts('heading');
  const [columnsHeading = ''] = texts('subheading');
  const [lead = '', ...rest] = texts('body');
  const [quote = ''] = texts('quote');
  return {
    id: 'site',
    label,
    lang: '',
    dir: isMostlyRtl(blocks.map((block) => block.text).join('')) ? 'rtl' : 'ltr',
    kicker: '',
    title,
    lead,
    meta: '',
    factors: [],
    columnsHeading,
    columns: rest.map((text): Run[] => [text]),
    quote: { text: quote, cite: '' },
    listHeading: '',
    list: texts('item').map((text): Run[] => [text]),
    tableHeading: '',
    tableHead: ['', ''],
    tableRows: [],
    glyphsHeading: '',
    glyphs: '',
    footer: '',
  };
}
