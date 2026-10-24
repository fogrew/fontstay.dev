export type InputKind = 'empty' | 'name' | 'css' | 'import';

const MAX_NAME_CHARS = 80;
const CSS_MARKER = /@font-face|@import|fonts\.googleapis\.com|fonts\.gstatic\.com|<link\b/i;

export function classifyInput(text: string): InputKind {
  const value = text.trim();
  if (value === '') return 'empty';
  if (value.startsWith('{')) return 'import';
  if (CSS_MARKER.test(value)) return 'css';
  return value.length <= MAX_NAME_CHARS && !value.includes('\n') ? 'name' : 'css';
}
