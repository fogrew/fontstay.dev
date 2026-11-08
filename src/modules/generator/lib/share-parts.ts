import type { FontState, ShareState } from './share';
import type { ViewDiff } from './view-state';

export const SHARE_PARTS = [
  'fonts',
  'style',
  'systems',
  'tuning',
  'panel',
  'preview',
  'siteFonts',
] as const;
export type SharePart = (typeof SHARE_PARTS)[number];

const hasKeys = (value: object | undefined) => value !== undefined && Object.keys(value).length > 0;

function previewOf(view: ViewDiff | undefined): ViewDiff | undefined {
  if (!view) return undefined;
  const { headingFont: _heading, bodyFont: _body, ...rest } = view;
  return hasKeys(rest) ? rest : undefined;
}

export function sharePartsIn(state: ShareState): SharePart[] {
  const others = Object.values(state.others ?? {});
  const anyFont = (test: (font: FontState) => boolean) => test(state) || others.some(test);
  const present: Record<SharePart, boolean> = {
    fonts:
      state.query !== undefined ||
      state.fontName !== undefined ||
      state.all === true ||
      (state.sources?.length ?? 0) > 0 ||
      others.length > 0,
    style: anyFont((font) => font.kind !== undefined || font.style !== undefined),
    systems:
      state.preset !== undefined ||
      anyFont((font) => font.picks !== undefined) ||
      (state.disabled?.length ?? 0) > 0,
    tuning:
      anyFont((font) => font.manual !== undefined) ||
      state.spacing !== undefined ||
      state.range === true ||
      state.scripts === false,
    panel: state.panel !== undefined || state.os !== undefined || state.face !== undefined,
    preview: previewOf(state.view) !== undefined,
    siteFonts: state.view?.headingFont !== undefined || state.view?.bodyFont !== undefined,
  };
  return SHARE_PARTS.filter((part) => present[part]);
}

function withoutFontParts(font: FontState, off: ReadonlySet<SharePart>): FontState {
  const { kind, style, picks, manual } = font;
  return {
    ...(kind !== undefined && !off.has('style') ? { kind } : {}),
    ...(style !== undefined && !off.has('style') ? { style } : {}),
    ...(picks !== undefined && !off.has('systems') ? { picks } : {}),
    ...(manual !== undefined && !off.has('tuning') ? { manual } : {}),
  };
}

export function withoutShareParts(state: ShareState, excluded: Iterable<SharePart>): ShareState {
  const off = new Set(excluded);
  if (off.size === 0) return state;
  const { v, data, query, fontName, all, sources, preset, disabled, others } = state;
  const { range, scripts, spacing, panel, os, face, view } = state;
  const keepFonts = !off.has('fonts');
  const keepTuning = !off.has('tuning');
  const keepPanel = !off.has('panel');
  const viewParts: ViewDiff = {};
  if (view) {
    const { headingFont, bodyFont, ...rest } = view;
    if (!off.has('preview')) Object.assign(viewParts, rest);
    if (!off.has('siteFonts')) {
      if (headingFont !== undefined) viewParts.headingFont = headingFont;
      if (bodyFont !== undefined) viewParts.bodyFont = bodyFont;
    }
  }
  const keptOthers = keepFonts
    ? Object.fromEntries(
        Object.entries(others ?? {})
          .map(([name, font]): [string, FontState] => [name, withoutFontParts(font, off)])
          .filter(([, font]) => hasKeys(font)),
      )
    : {};
  return {
    v,
    ...(data !== undefined ? { data } : {}),
    ...(keepFonts && query !== undefined ? { query } : {}),
    ...(keepFonts && fontName !== undefined ? { fontName } : {}),
    ...(keepFonts && all ? { all } : {}),
    ...(keepFonts && sources ? { sources } : {}),
    ...(!off.has('systems') && preset !== undefined ? { preset } : {}),
    ...(!off.has('systems') && disabled ? { disabled } : {}),
    ...withoutFontParts(state, off),
    ...(hasKeys(keptOthers) ? { others: keptOthers } : {}),
    ...(keepTuning && range ? { range } : {}),
    ...(keepTuning && scripts !== undefined ? { scripts } : {}),
    ...(keepTuning && spacing ? { spacing } : {}),
    ...(keepPanel && panel !== undefined ? { panel } : {}),
    ...(keepPanel && os !== undefined ? { os } : {}),
    ...(keepPanel && face !== undefined ? { face } : {}),
    ...(hasKeys(viewParts) ? { view: viewParts } : {}),
  };
}
