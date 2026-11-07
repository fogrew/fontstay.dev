export { BookmarkletTool } from './ui/BookmarkletTool';
export { ImportConfirm } from './ui/ImportConfirm';
export { SiteImportPanel } from './ui/SiteImportPanel';
export { SplitWarnings } from './ui/SplitWarnings';

export const PENDING_HASH = '#import';

export async function takePending() {
  return (await import('./lib/pending')).takePending();
}

export async function discardPending() {
  return (await import('./lib/pending')).discardPending();
}

export async function clearPendingStore() {
  return (await import('./lib/pending')).clearPendingStore();
}

export async function readClipboardImport(text: string) {
  return (await import('./lib/pending')).parseClipboardImport(text);
}
