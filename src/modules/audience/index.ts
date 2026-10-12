export { buildMatrix, type CellState, type MatrixGroup, type SystemInfo } from './lib/matrix';
export { browserName } from './lib/names';
export type { WeightedEntry } from './lib/os';
export { DEFAULT_DESKTOP_SPLIT, type OsShares } from './lib/os';
export { PRESETS } from './lib/presets';
export { type BrowserGroup, type Resolution, resolveQuery } from './lib/resolve';
export { importStats, parseStats, type UsageStats } from './lib/stats';
export {
  descriptorSupport,
  FEATURES,
  type FeatureSupport,
  lacksVerticalOverrides,
  supportData,
} from './lib/support';
export { type AudienceData, AudienceEditor } from './ui/AudienceEditor';
export { SupportMatrix } from './ui/SupportMatrix';
