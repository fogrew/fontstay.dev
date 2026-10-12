import { createCssVariablesTheme, createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

export type CodeLanguage = 'css' | 'html' | 'js' | 'ts' | 'markdown';

export interface Token {
  text: string;
  kind: string | undefined;
  italic: boolean;
  bold: boolean;
}

const MAX_CHARS = 60_000;
const PREFIX = '--ff-tok-';

const loaders: Record<CodeLanguage, () => Promise<unknown>> = {
  css: () => import('shiki/langs/css.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  js: () => import('shiki/langs/javascript.mjs'),
  ts: () => import('shiki/langs/typescript.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
};

const THEME = createCssVariablesTheme({
  name: 'fontstay',
  variablePrefix: PREFIX,
  variableDefaults: {},
  fontStyle: true,
});

let highlighter: Promise<HighlighterCore> | undefined;
const loaded = new Set<CodeLanguage>();

function engine(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [THEME],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

const KIND = new RegExp(`${PREFIX}token-([a-z-]+)\\)`);

export async function tokenize(code: string, language: CodeLanguage): Promise<Token[][] | null> {
  if (code.length > MAX_CHARS) return null;
  const core = await engine();
  if (!loaded.has(language)) {
    await core.loadLanguage((await loaders[language]()) as never);
    loaded.add(language);
  }
  return core.codeToTokensBase(code, { lang: language, theme: 'fontstay' }).map((line) =>
    line.map((token) => ({
      text: token.content,
      kind: token.color ? KIND.exec(token.color)?.[1] : undefined,
      italic: Boolean((token.fontStyle ?? 0) & 1),
      bold: Boolean((token.fontStyle ?? 0) & 2),
    })),
  );
}
