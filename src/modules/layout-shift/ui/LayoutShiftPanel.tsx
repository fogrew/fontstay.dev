import { useEffect, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import type { ViewportResult } from '../lib/score';
import { DEFAULT_VIEWPORTS, type SimulationInput, simulateLayoutShift } from '../lib/simulate';
import './layout-shift.css';

export type PanelInput = Omit<SimulationInput, 'viewports' | 'signal'>;

type VerifyState =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'failed' }
  | { state: 'done'; results: ViewportResult[] };

export function LayoutShiftPanel({
  locale,
  verify,
  signature,
}: {
  locale: Locale;
  verify: PanelInput;
  signature: string;
}) {
  const t = messagesFor(locale);
  const [verified, setVerified] = useState<VerifyState>({ state: 'idle' });
  const verifying = useRef<AbortController>();
  useEffect(() => () => verifying.current?.abort(), []);
  useEffect(() => {
    verifying.current?.abort();
    setVerified({ state: 'idle' });
  }, [signature]);

  const score = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(
      value,
    );

  const runVerify = async () => {
    verifying.current?.abort();
    const controller = new AbortController();
    verifying.current = controller;
    setVerified({ state: 'running' });
    try {
      const results = await simulateLayoutShift({
        ...verify,
        viewports: DEFAULT_VIEWPORTS,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setVerified({ state: 'done', results });
    } catch {
      if (!controller.signal.aborted) setVerified({ state: 'failed' });
    }
  };

  return (
    <div class="ff-cls">
      <Button
        onClick={() => {
          if (verified.state !== 'running') void runVerify();
        }}
        aria-disabled={verified.state === 'running'}
      >
        {t.cls_verify()}
      </Button>
      <p class="ff-muted" role="status">
        {verified.state === 'running' && t.cls_verifying()}
        {verified.state === 'failed' && t.cls_failed()}
        {verified.state === 'done' &&
          t.cls_verified({
            results: verified.results
              .map((item) => `${item.viewport.width}px: ${score(item.score)}`)
              .join(', '),
          })}
      </p>
    </div>
  );
}
