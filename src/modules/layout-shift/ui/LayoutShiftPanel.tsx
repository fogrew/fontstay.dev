import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, LiveRegion } from '@/common/ui';
import { sampleBlocks } from '../lib/document';
import { compassSearch, type Dimension } from '../lib/optimize';
import { type PredictFont, predictViewport } from '../lib/predict';
import type { SampleLanguage } from '../lib/samples';
import type { ViewportResult } from '../lib/score';
import {
  DEFAULT_VIEWPORTS,
  ratingOf,
  type SimulationInput,
  simulateLayoutShift,
} from '../lib/simulate';
import './layout-shift.css';

const SETTLE_MS = 700;

export interface ModelFace {
  id: string;
  label: string;
  systems: string;
  font: PredictFont | null;
}

export interface PanelModel {
  web: PredictFont;
  faces: ModelFace[];
  language: SampleLanguage;
}

export type PanelInput = Omit<SimulationInput, 'viewports' | 'signal'>;

export interface OptimizerSetup {
  dimensions: Dimension[];
  fontFor: (values: Record<string, number>) => PredictFont | null;
  applied: boolean;
  onApply: (values: Record<string, number>) => void;
  onReset: () => void;
}

type OptimizeState =
  | { state: 'idle' }
  | { state: 'running'; count: number }
  | { state: 'failed' }
  | { state: 'done'; before: number; after: number; count: number };

type VerifyState =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'failed' }
  | { state: 'done'; results: ViewportResult[] };

export function scoreOf(
  model: Pick<PanelModel, 'web' | 'language'>,
  font: PredictFont,
  viewports = DEFAULT_VIEWPORTS,
): ViewportResult[] {
  const blocks = sampleBlocks(model.language);
  return viewports.map((viewport) => predictViewport(model.web, font, blocks, viewport));
}

export function LayoutShiftPanel({
  locale,
  model,
  verify,
  optimizer,
}: {
  locale: Locale;
  model: PanelModel | undefined;
  verify?: PanelInput | undefined;
  optimizer?: OptimizerSetup | undefined;
}) {
  const t = messagesFor(locale);
  const [announcement, setAnnouncement] = useState('');
  const [optimize, setOptimize] = useState<OptimizeState>({ state: 'idle' });
  const [verified, setVerified] = useState<VerifyState>({ state: 'idle' });
  const verifying = useRef<AbortController>();
  useEffect(() => () => verifying.current?.abort(), []);

  const rows = useMemo(
    () =>
      model
        ? model.faces.map((face) => ({
            face,
            results: face.font ? scoreOf(model, face.font) : null,
          }))
        : [],
    [model],
  );

  const signature = rows
    .map((row) => `${row.face.id}:${row.results?.map((item) => item.score.toFixed(5)).join(',')}`)
    .join('|');
  useEffect(() => {
    verifying.current?.abort();
    setVerified({ state: 'idle' });
  }, [signature]);

  const ratingLabel = (score: number) => {
    const rating = ratingOf(score);
    if (rating === 'good') return t.cls_rating_good();
    return rating === 'needs-improvement' ? t.cls_rating_needs() : t.cls_rating_poor();
  };
  const score = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(
      value,
    );

  useEffect(() => {
    const worst = rows
      .flatMap((row) => (row.results ?? []).map((item) => ({ face: row.face.label, item })))
      .sort((a, b) => b.item.score - a.item.score)[0];
    if (!worst) return;
    const timer = setTimeout(
      () =>
        setAnnouncement(
          t.cls_announcement({
            face: worst.face,
            width: worst.item.viewport.width,
            score: score(worst.item.score),
            rating: ratingLabel(worst.item.score),
          }),
        ),
      SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [rows]);

  const runOptimizer = async () => {
    if (!model || !optimizer) return;
    setOptimize({ state: 'running', count: 0 });
    try {
      let evaluated = 0;
      const result = await compassSearch(
        optimizer.dimensions,
        async (values) => {
          evaluated += 1;
          if (evaluated % 40 === 0) await new Promise<void>((resolve) => setTimeout(resolve));
          const font = optimizer.fontFor(values);
          if (!font) return 0;
          return scoreOf(model, font).reduce((sum, item) => sum + item.score, 0);
        },
        {
          maxEvaluations: 1500,
          maxMs: 4000,
          onProgress: (count) => setOptimize({ state: 'running', count }),
        },
      );
      if (result.score < result.startScore - 1e-9) optimizer.onApply(result.values);
      setOptimize({
        state: 'done',
        before: result.startScore,
        after: Math.min(result.score, result.startScore),
        count: result.evaluations,
      });
    } catch {
      setOptimize({ state: 'failed' });
    }
  };

  const runVerify = async () => {
    if (!verify) return;
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
    <section class="ff-generator__section ff-cls" aria-label={t.cls_heading()}>
      <p class="ff-muted">{t.cls_note()}</p>
      {rows.length > 0 && (
        <table class="ff-cls__table">
          <caption class="ff-sr-only">{t.cls_heading()}</caption>
          <thead>
            <tr>
              <th scope="col">{t.cls_font()}</th>
              {DEFAULT_VIEWPORTS.map((viewport) => (
                <th scope="col" key={viewport.width}>{`${viewport.width}px`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ face, results }) => (
              <tr key={face.id}>
                <th scope="row">
                  {face.label}
                  <span class="ff-muted"> {face.systems}</span>
                </th>
                {results ? (
                  results.map((item) => (
                    <td key={item.viewport.width}>
                      {`${score(item.score)} · ${ratingLabel(item.score)}`}
                      <span class="ff-muted">
                        {' '}
                        {t.cls_detail({
                          lines: t.cls_change({ before: item.linesBefore, after: item.linesAfter }),
                          height: t.cls_change_px({
                            before: Math.round(item.heightBefore),
                            after: Math.round(item.heightAfter),
                          }),
                        })}
                      </span>
                    </td>
                  ))
                ) : (
                  <td colSpan={DEFAULT_VIEWPORTS.length}>{t.cls_no_glyphs()}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div class="ff-cls__optimize">
        <div class="ff-generator__buttons">
          {optimizer && (
            <Button
              onClick={() => {
                if (optimize.state !== 'running') void runOptimizer();
              }}
              aria-disabled={optimize.state === 'running'}
            >
              {t.cls_optimize()}
            </Button>
          )}
          {optimizer?.applied && (
            <Button
              onClick={() => {
                optimizer.onReset();
                setOptimize({ state: 'idle' });
              }}
            >
              {t.cls_optimize_reset()}
            </Button>
          )}
          {verify && (
            <Button
              onClick={() => {
                if (verified.state !== 'running') void runVerify();
              }}
              aria-disabled={verified.state === 'running'}
            >
              {t.cls_verify()}
            </Button>
          )}
        </div>
        {optimizer && <p class="ff-muted">{t.cls_optimize_note()}</p>}
        <p class="ff-muted" role="status">
          {optimize.state === 'running' && t.cls_optimizing({ count: optimize.count })}
          {optimize.state === 'failed' && t.cls_failed()}
          {optimize.state === 'done' &&
            (optimize.after < optimize.before - 1e-9
              ? t.cls_optimized({
                  before: score(optimize.before),
                  after: score(optimize.after),
                  count: optimize.count,
                })
              : t.cls_optimize_none())}
          {verified.state === 'running' && ` ${t.cls_verifying()}`}
          {verified.state === 'failed' && ` ${t.cls_failed()}`}
          {verified.state === 'done' &&
            ` ${t.cls_verified({
              results: verified.results
                .map((item) => `${item.viewport.width}px: ${score(item.score)}`)
                .join(', '),
            })}`}
        </p>
      </div>
      <LiveRegion>{announcement}</LiveRegion>
    </section>
  );
}
