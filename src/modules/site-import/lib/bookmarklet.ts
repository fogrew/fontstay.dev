import { DATA_TYPE, importPath, PROTOCOL_VERSION, READY_TYPE } from '@/modules/import-receiver';
import collector from '../collector/collect.js?raw';

const compact = (source: string) =>
  source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

const WRAPPER = `
(() => {
  const target = __TARGET__;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[byte % 62]).join('');
  const child = window.open(target + __PATH__ + '#t=' + token, '_blank');
  const data = fontstayCollect(window, document);
  if (!child) {
    (async () => {
      const json = data.then((payload) => new Blob([JSON.stringify({ ...payload, files: [] })], { type: 'text/plain' }));
      json.catch(() => {});
      if (window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': json })]);
      else await navigator.clipboard.writeText(await (await json).text());
    })().then(() => alert(__COPIED__), () => alert(__FAILED__));
    return;
  }
  data.catch(() => alert(__FAILED__));
  const listener = (event) => {
    if (event.source !== child || event.origin !== target || !event.data || event.data.type !== ${JSON.stringify(READY_TYPE)}) return;
    window.removeEventListener('message', listener);
    data.then((payload) => {
      child.postMessage({ type: ${JSON.stringify(DATA_TYPE)}, v: ${PROTOCOL_VERSION}, token, payload }, target, payload.files.map((file) => file.bytes));
    }, () => {});
  };
  window.addEventListener('message', listener);
})();
`;

export interface BookmarkletOptions {
  origin: string;
  locale: string;
  copied: string;
  failed: string;
}

export function bookmarkletSource(options: BookmarkletOptions): string {
  const wrapper = WRAPPER.replaceAll('__TARGET__', () => JSON.stringify(options.origin))
    .replaceAll('__PATH__', () => JSON.stringify(importPath(options.locale)))
    .replaceAll('__COPIED__', () => JSON.stringify(options.copied))
    .replaceAll('__FAILED__', () => JSON.stringify(options.failed));
  const body = collector.replace(/^export /m, '');
  return compact(`(() => { ${body}\n${wrapper} })();`);
}

export function bookmarkletHref(options: BookmarkletOptions): string {
  return `javascript:${encodeURI(bookmarkletSource(options)).replace(/#/g, '%23')}`;
}
