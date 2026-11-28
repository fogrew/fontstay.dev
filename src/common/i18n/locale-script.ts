export interface LocaleScript {
  subset: string;
  code: string;
  kind: 'script' | 'language';
  probe: string;
  sample: string;
}

const script = (
  subset: string,
  code: string,
  probe: string,
  sample: string,
  kind: LocaleScript['kind'] = 'script',
): LocaleScript => ({ subset, code, kind, probe, sample });

// es and pt need nothing beyond the basic latin subset
const SCRIPTS: Record<string, LocaleScript> = {
  ar: script('arabic', 'Arab', 'ابتجحدرسعم', 'عر'),
  el: script('greek', 'Grek', 'αβγδεζηθικλμ', 'Ωω'),
  ja: script('japanese', 'Jpan', 'あいうえおアイウ', 'あ'),
  ru: script('cyrillic', 'Cyrl', 'абвгдежзиклмн', 'Яя'),
  th: script('thai', 'Thai', 'กขคงจชดตนบ', 'กข'),
  vi: script('vietnamese', 'vi', 'ạảấầẩậắằ', 'Ệệ', 'language'),
  zh: script('chinese-simplified', 'Hans', '的一是在不了有和人这', '汉'),
};

export const localeScript = (locale: string): LocaleScript | undefined => SCRIPTS[locale];

// CJK web fonts come in numbered slices, so one rule cannot stand for the script
export const localeScriptPoint = (locale: string): number | undefined =>
  locale === 'ja' || locale === 'zh' ? undefined : SCRIPTS[locale]?.probe.codePointAt(0);

export function localeScriptName(locale: string): string {
  const entry = SCRIPTS[locale];
  if (!entry) return '';
  return new Intl.DisplayNames([locale], { type: entry.kind }).of(entry.code) ?? entry.subset;
}
