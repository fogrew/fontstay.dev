import type { FontDetailsGroupsProps } from './FontDetailsGroups';
import { lazyPanel } from './lazy';

export const LazyFontDetails = lazyPanel<FontDetailsGroupsProps>(() =>
  import('./FontDetailsGroups').then((module) => module.FontDetailsGroups),
);
