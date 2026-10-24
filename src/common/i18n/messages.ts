import type * as generated from './paraglide/messages.js';
import { type Locale, locales } from './paraglide/runtime.js';

type Generated = Omit<typeof generated, 'm'>;
type Catalog = Record<string, string>;
type InputsOf<Fn> = Fn extends (...args: infer Args) => unknown
  ? Args extends [infer Inputs, ...unknown[]]
    ? [inputs: Inputs]
    : [inputs?: Args[0]]
  : never;

export type Messages = {
  [Key in keyof Generated]: (...args: InputsOf<Generated[Key]>) => string;
};

const catalogs = new Map<Locale, Catalog>();
const PLACEHOLDER = /\{([A-Za-z_]\w*)\}/g;
const localeOf = (path: string) => locales.find((locale) => path.endsWith(`/${locale}.json`));

if (import.meta.env.SSR) {
  const files = import.meta.glob<Catalog>('../../../messages/*.json', { import: 'default' });
  for (const [path, load] of Object.entries(files)) {
    const locale = localeOf(path);
    if (locale) catalogs.set(locale, await load());
  }
} else {
  const files = import.meta.glob<string>('../../../messages/*.json', {
    query: '?url',
    import: 'default',
  });
  const entry = Object.entries(files).find(
    ([path]) => localeOf(path) === document.documentElement.lang,
  );
  if (entry) {
    const response = await fetch(await entry[1]());
    catalogs.set(document.documentElement.lang as Locale, (await response.json()) as Catalog);
  }
}

function format(template: string, inputs: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    Object.hasOwn(inputs, name) ? String(inputs[name]) : whole,
  );
}

export function messagesFor(locale: Locale): Messages {
  return new Proxy({} as Messages, {
    get: (_, key) => {
      if (typeof key !== 'string' || key === 'then') {
        return undefined;
      }
      const catalog = catalogs.get(locale);
      if (!catalog) {
        throw new Error(`Messages of ${locale} are not loaded`);
      }
      const template = catalog[key];
      if (template === undefined) {
        throw new Error(`Unknown message key: ${key}`);
      }
      return (inputs?: object) => format(template, (inputs ?? {}) as Record<string, unknown>);
    },
  });
}
