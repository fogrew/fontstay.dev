import { generateFallbackCss } from '@/modules/export';
import type { FitAdjustment } from '@/modules/fallback-fit';
import type { Category } from '@/modules/os-fonts';

export interface Overrides {
  sizeAdjust: number;
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
}

export interface CssFace {
  family: string;
  localNames: readonly string[];
  adjustment: Overrides;
  unicodeRange?: string | undefined;
}

export function adjustmentOf(adjustment: FitAdjustment, overrides: Partial<Overrides>): Overrides {
  return {
    sizeAdjust: overrides.sizeAdjust ?? adjustment.sizeAdjust,
    ascentOverride: overrides.ascentOverride ?? adjustment.ascentOverride,
    descentOverride: overrides.descentOverride ?? adjustment.descentOverride,
    lineGapOverride: overrides.lineGapOverride ?? adjustment.lineGapOverride,
  };
}

export function fallbackFamilyName(
  targetFamily: string,
  family: string,
  faceCount: number,
): string {
  return faceCount === 1 ? `${targetFamily} Fallback` : `${targetFamily} Fallback ${family}`;
}

export const RULE_SELECTOR = 'body';

export function fallbackRule(fontFamily: string, strategy: string): string {
  const lines = [fontFamily, strategy].filter(Boolean).flatMap((block) => block.split('\n'));
  return [`${RULE_SELECTOR} {`, ...lines.map((line) => `  ${line}`), '}'].join('\n');
}

export function buildCss(targetFamily: string, faces: readonly CssFace[], generic: Category) {
  return generateFallbackCss({
    targetFamily,
    fallbacks: faces.map((face) => ({
      family: fallbackFamilyName(targetFamily, face.family, faces.length),
      localNames: face.localNames,
      adjustment: face.adjustment,
      unicodeRange: face.unicodeRange,
    })),
    genericFamily: generic,
  });
}
