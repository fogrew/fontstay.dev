import { storePending } from './handoff';
import { openedByExtension, tokenFromHash } from './protocol';
import { startReceiver } from './receiver';

export function runReceivePage(root: HTMLElement): void {
  const { after = '/', failed = '' } = root.dataset;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const fail = () => {
    if (status) status.textContent = failed;
    root.querySelector<HTMLElement>('[data-home]')?.removeAttribute('hidden');
  };
  const token = tokenFromHash(location.hash);
  if (!token) {
    fail();
    return;
  }
  const acceptOpener = !openedByExtension(location.hash);
  history.replaceState(null, '', location.pathname);
  startReceiver(window, {
    token,
    acceptOpener,
    onFailure: fail,
    onImport: (value) => {
      void storePending(value).then((stored) => {
        if (stored) {
          window.opener = null;
          location.replace(after);
        } else fail();
      });
    },
  });
}
