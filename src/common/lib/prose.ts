const TAG_CLASSES: Record<string, string> = {
  h1: 'ff-heading ff-page__heading',
  h2: 'ff-heading ff-page__heading ff-prose__heading',
  h3: 'ff-heading ff-page__heading',
  p: 'ff-page__text',
  ul: 'ff-page__list',
  li: 'ff-page__item',
  table: 'ff-prose__table',
};
const VOID = new Set(['br', 'hr', 'img']);

export function addProseClasses(html: string): string {
  const open: string[] = [];
  return html.replace(
    /<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi,
    (tag, closing: string, name: string, rest: string) => {
      const lower = name.toLowerCase();
      if (closing) {
        const index = open.lastIndexOf(lower);
        if (index >= 0) open.length = index;
        return tag;
      }
      const classes = [TAG_CLASSES[lower]];
      if (lower === 'a') {
        classes.push('ff-link');
        if (open.includes('li') || open.includes('td')) classes.push('ff-link--tap');
      }
      if (!VOID.has(lower) && !rest.endsWith('/')) open.push(lower);
      const added = classes.filter(Boolean).join(' ');
      return added ? `<${name} class="${added}"${rest}>` : tag;
    },
  );
}
