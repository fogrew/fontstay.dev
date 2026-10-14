export const READY_TYPE = 'fontstay:ready';
export const DATA_TYPE = 'fontstay:import';
export const PROTOCOL_VERSION = 1;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const PENDING_HASH = '#import';

export function tokenFromHash(hash: string): string | null {
  const match = /^#t=([^&]*)$/.exec(hash);
  const token = match?.[1] ?? '';
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function importPath(locale: string): string {
  return `/${locale}/import/`;
}
