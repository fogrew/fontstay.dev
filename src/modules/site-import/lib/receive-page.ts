import { storePending } from './handoff';
import { PENDING_HASH, tokenFromHash } from './protocol';
import { startReceiver } from './receiver';

export function runReceivePage(root: HTMLElement): void {
  const { locale = 'en', failed = '' } = root.dataset;
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
  history.replaceState(null, '', location.pathname);
  startReceiver(window, {
    token,
    onFailure: fail,
    onImport: (value) => {
      void storePending(value).then((stored) => {
        if (stored) location.replace(`/${locale}/${PENDING_HASH}`);
        else fail();
      });
    },
  });
}
