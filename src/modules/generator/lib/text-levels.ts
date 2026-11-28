import {
  type LevelStyle,
  type LevelStyles,
  TEXT_LEVELS,
  type TextLevel,
  type Wrap,
} from './view-state';

const PAGE = '.ff-article-view .ff-article';

export function setLevelStyle(
  levels: LevelStyles,
  level: TextLevel,
  change: LevelStyle | undefined,
): LevelStyles {
  const style = Object.fromEntries(
    Object.entries(change ? { ...levels[level], ...change } : {}).filter(
      ([, value]) => value !== undefined,
    ),
  );
  const next: LevelStyles = {};
  for (const id of TEXT_LEVELS) {
    const value = id === level ? style : levels[id];
    if (value && Object.keys(value).length > 0) next[id] = value;
  }
  return next;
}

function wrapRules(wrap: Wrap): string {
  const clip = wrap === 'nowrap' ? ' overflow: hidden; text-overflow: ellipsis;' : '';
  return `text-wrap: ${wrap};${clip}`;
}

export function levelsCss(levels: LevelStyles, active?: TextLevel): string {
  const rules: string[] = [];
  for (const level of TEXT_LEVELS) {
    const style = levels[level];
    if (!style) continue;
    const selector = `${PAGE} [data-level="${level}"]`;
    const declarations = [
      style.size === undefined ? '' : `font-size: ${style.size}px;`,
      style.lineHeight === undefined ? '' : `line-height: ${style.lineHeight};`,
      style.wrap === undefined ? '' : wrapRules(style.wrap),
    ].filter(Boolean);
    rules.push(`${selector} { ${declarations.join(' ')} }`);
    if (level === 'code' && style.size !== undefined) {
      rules.push(`${selector} .ff-article__mono { font-size: 1em; }`);
    }
  }
  if (active) {
    rules.push(
      `${PAGE}:not(.ff-article--ghost) [data-level="${active}"] { outline: 2px dashed var(--ff-focus); outline-offset: 2px; }`,
    );
  }
  return rules.join('\n');
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const GAP = 8;

export function placeBar(anchor: Box, bar: { width: number; height: number }, viewport: Box) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const minTop = viewport.top + GAP;
  const maxTop = viewport.top + viewport.height - bar.height - GAP;
  const above = anchor.top - bar.height - GAP;
  const below = anchor.top + anchor.height + GAP;
  const top = above >= minTop || below > maxTop ? above : below;
  return {
    left: clamp(
      anchor.left + (anchor.width - bar.width) / 2,
      viewport.left + GAP,
      viewport.left + viewport.width - bar.width - GAP,
    ),
    top: clamp(top, minTop, maxTop),
  };
}
