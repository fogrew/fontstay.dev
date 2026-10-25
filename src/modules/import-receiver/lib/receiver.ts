import { type SiteImport, sanitizeImport } from './payload';
import { DATA_TYPE, PROTOCOL_VERSION, READY_TYPE } from './protocol';

export interface ReceiverWindow {
  opener: { postMessage: (message: unknown, targetOrigin: string) => void } | null;
  location: { origin: string };
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
}

export interface ReceiverOptions {
  token: string;
  onImport: (value: SiteImport) => void;
  onFailure: () => void;
  acceptOpener?: boolean;
  announceEveryMs?: number;
  timeoutMs?: number;
}

export function startReceiver(win: ReceiverWindow, options: ReceiverOptions): () => void {
  const acceptOpener = options.acceptOpener !== false;
  let finished = false;
  const stop = () => {
    finished = true;
    win.removeEventListener('message', listener);
    clearInterval(announcer);
    clearTimeout(timer);
  };
  const listener = (event: MessageEvent) => {
    if (finished) return;
    const data: unknown = event.data;
    if (typeof data !== 'object' || data === null) return;
    const message = data as Record<string, unknown>;
    if (message.type !== DATA_TYPE || message.v !== PROTOCOL_VERSION) return;
    const fromOpener = acceptOpener && win.opener !== null && event.source === win.opener;
    const fromSelf = event.source === (win as unknown) && event.origin === win.location.origin;
    if (!fromOpener && !fromSelf) return;
    if (message.token !== options.token) return;
    stop();
    const claimed = fromSelf && typeof message.origin === 'string' ? message.origin : event.origin;
    let value: SiteImport | null = null;
    try {
      value = sanitizeImport(message.payload, claimed, true);
    } catch {
      value = null;
    }
    if (value) options.onImport(value);
    else options.onFailure();
  };
  // The wildcard target is intentional: READY carries no data.
  const announce = () => {
    if (acceptOpener) win.opener?.postMessage({ type: READY_TYPE, v: PROTOCOL_VERSION }, '*');
  };
  win.addEventListener('message', listener);
  announce();
  const announcer = setInterval(announce, options.announceEveryMs ?? 400);
  const timer = setTimeout(() => {
    if (finished) return;
    stop();
    options.onFailure();
  }, options.timeoutMs ?? 60_000);
  return stop;
}
