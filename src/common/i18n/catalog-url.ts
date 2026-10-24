import { type Locale, locales } from './paraglide/runtime.js';

const urls = import.meta.glob<string>('../../../messages/*.json', {
  query: '?url',
  import: 'default',
  eager: true,
});

export function catalogUrl(locale: Locale): string | undefined {
  return Object.entries(urls).find(
    ([path]) => locales.includes(locale) && path.endsWith(`/${locale}.json`),
  )?.[1];
}
