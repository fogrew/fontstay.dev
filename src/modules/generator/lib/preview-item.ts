import type { FontMetrics } from '@/modules/font-metrics';
import type { Category } from '@/modules/os-fonts';
import type { Overrides } from './css';

export interface PreviewItem {
  id: number;
  name: string;
  family: string;
  bytes: ArrayBuffer;
  codePoints: Uint32Array;
  metrics: FontMetrics;
  fallback: { family: string; localNames: readonly string[]; category: Category };
  adjustment: Overrides;
  unicodeRange?: string | undefined;
  fontWeight?: number | undefined;
  fontStyle?: 'italic' | undefined;
}
