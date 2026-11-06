import type { FontFeatureControlsProps } from './FontFeatureControls';
import { lazyPanel } from './lazy';

export const LazyFontFeatures = lazyPanel<FontFeatureControlsProps>(() =>
  import('./FontFeatureControls').then((module) => module.FontFeatureControls),
);
