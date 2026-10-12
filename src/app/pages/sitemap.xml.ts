import { locales, localizeHref } from '@/common/i18n';
import { osFontsDataset } from '@/modules/os-fonts';

export function GET({ site }: { site: URL | undefined }) {
  const origin = site ?? new URL('https://fontstay.dev');
  const paths = [
    '/',
    '/fonts/',
    '/presets/',
    ...osFontsDataset.fonts.map((font) => `/fonts/${font.id}/`),
  ];
  const url = (path: string, locale: (typeof locales)[number]) =>
    new URL(localizeHref(path, { locale }), origin).toString();
  const entries = paths.flatMap((path) =>
    locales.map((locale) => {
      const alternates = locales
        .map(
          (code) =>
            `    <xhtml:link rel="alternate" hreflang="${code}" href="${url(path, code)}"/>`,
        )
        .join('\n');
      return `  <url>\n    <loc>${url(path, locale)}</loc>\n${alternates}\n  </url>`;
    }),
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
