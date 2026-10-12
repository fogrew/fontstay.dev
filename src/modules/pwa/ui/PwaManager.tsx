import { useEffect, useState } from 'preact/hooks';
import { type Locale, localizeHref, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import { startupNotice } from '../lib/version';
import './pwa.css';

const STORAGE_KEY = 'fontstay:version';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

type Toast =
  | { kind: 'update'; version: string | undefined }
  | { kind: 'updated'; from: string; to: string };

const currentVersion = () => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0');

export function PwaManager({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const [toast, setToast] = useState<Toast>();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();

  useEffect(() => {
    const current = currentVersion();
    let last: string | null = null;
    try {
      last = localStorage.getItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, current);
    } catch {
      // storage may be unavailable
    }
    const notice = startupNotice(last, current);
    if (notice.kind === 'updated') setToast(notice);
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const offer = async () => {
      let version: string | undefined;
      try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        version = ((await response.json()) as { version?: string }).version;
      } catch {
        version = undefined;
      }
      setToast((existing) => existing ?? { kind: 'update', version });
    };
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      setRegistration(reg);
      if (reg.waiting && navigator.serviceWorker.controller) void offer();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) void offer();
        });
      });
      timer = setInterval(() => void reg.update().catch(() => undefined), CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      });
    });
    return () => clearInterval(timer);
  }, []);

  if (!toast) return null;
  const changelog = (since: string) => `${localizeHref('/changelog/', { locale })}?since=${since}`;

  const apply = () => {
    const waiting = registration?.waiting;
    if (!waiting) {
      location.reload();
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
      once: true,
    });
    waiting.postMessage('SKIP_WAITING');
  };

  return (
    <div class="ff-toasts" role="status">
      <div class="ff-toast">
        {toast.kind === 'update' ? (
          <>
            <p>
              {toast.version
                ? t.pwa_update_available_version({ version: toast.version })
                : t.pwa_update_available()}
            </p>
            <div class="ff-toast__actions">
              <Button variant="primary" onClick={apply}>
                {t.pwa_update()}
              </Button>
              <a href={changelog(currentVersion())}>{t.pwa_changelog()}</a>
              <Button onClick={() => setToast(undefined)} aria-label={t.pwa_dismiss()}>
                <span aria-hidden="true">×</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>{t.pwa_updated({ from: toast.from, to: toast.to })}</p>
            <div class="ff-toast__actions">
              <a href={changelog(toast.from)}>{t.pwa_whats_new()}</a>
              <Button onClick={() => setToast(undefined)} aria-label={t.pwa_dismiss()}>
                <span aria-hidden="true">×</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
