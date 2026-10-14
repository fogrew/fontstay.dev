export type {
  ImportedFace,
  ImportedFile,
  ImportedSample,
  ImportedUse,
  SiteImport,
} from './lib/payload';
export { PENDING_HASH } from './lib/protocol';
export { runReceivePage } from './lib/receive-page';
export { ImportConfirm } from './ui/ImportConfirm';
export { SiteImportPanel } from './ui/SiteImportPanel';

export async function takePending() {
  return (await import('./lib/handoff')).takePending();
}

export async function discardPending() {
  return (await import('./lib/handoff')).discardPending();
}
