import { osFontMetrics, osFontsDataset } from '@/modules/os-fonts';

export function GET() {
  const metrics = osFontMetrics();
  const rules = osFontsDataset.fonts.map((font) => {
    const names = [...(metrics.find((item) => item.id === font.id)?.localNames ?? []), font.family];
    const stack = [...new Set(names)].map((name) => JSON.stringify(name)).join(', ');
    return `.ff-specimen[data-font="${font.id}"] { font-family: ${stack}, ${font.category}; }`;
  });
  return new Response(`${rules.join('\n')}\n`, {
    headers: { 'content-type': 'text/css; charset=utf-8' },
  });
}
