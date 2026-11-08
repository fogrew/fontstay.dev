import { useEffect, useRef } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import type { FontMetrics } from '@/modules/font-metrics';
import { GLYPH_FAMILY, glyphAdvance, glyphVertical } from '../lib/glyph-detail';

const WIDTH = 264;
const HEIGHT = 188;
const SIZE = 72;
const X = 42;
const BASELINE = 109;

export interface GlyphDetailProps {
  locale: Locale;
  metrics: FontMetrics;
  codePoint: number;
  covered: boolean;
  ready: boolean;
}

export function GlyphDetail({ locale, metrics, codePoint, covered, ready }: GlyphDetailProps) {
  const t = messagesFor(locale);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { em, ascent, descent } = glyphVertical(metrics);
  const advance = covered ? glyphAdvance(metrics.codePoints, metrics.advances, codePoint) : 0;
  const char = String.fromCodePoint(codePoint);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(WIDTH * ratio);
    element.height = Math.round(HEIGHT * ratio);
    context.scale(ratio, ratio);
    const lines = [
      { y: BASELINE - (ascent / em) * SIZE, color: '#21614b' },
      { y: BASELINE, color: '#af3545' },
      { y: BASELINE - (descent / em) * SIZE, color: '#5a4eb5' },
    ];
    for (const line of lines) {
      context.strokeStyle = line.color;
      context.beginPath();
      context.moveTo(8, line.y);
      context.lineTo(WIDTH - 8, line.y);
      context.stroke();
    }
    if (!covered || !ready) return;
    context.font = `${SIZE}px "${GLYPH_FAMILY}"`;
    const measured = context.measureText(char);
    context.fillStyle = '#171717';
    context.fillText(char, X, BASELINE);
    context.strokeStyle = '#145c82';
    context.strokeRect(
      X - measured.actualBoundingBoxLeft,
      BASELINE - measured.actualBoundingBoxAscent,
      measured.actualBoundingBoxLeft + measured.actualBoundingBoxRight,
      measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent,
    );
    const advanceX = X + (advance / em) * SIZE;
    context.strokeStyle = '#7b4d19';
    context.beginPath();
    context.moveTo(advanceX, 24);
    context.lineTo(advanceX, 166);
    context.stroke();
  }, [char, covered, ready, advance, ascent, descent, em]);

  return (
    <div class="ff-map__glyph">
      <canvas
        ref={canvas}
        class="ff-map__canvas"
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={t.coverage_glyph_diagram({ glyph: char })}
      />
      <dl class="ff-map__metrics">
        <dt>{t.coverage_glyph_advance()}</dt>
        <dd class="ff-map__metric-value">
          {Math.round(advance)} / {em}
        </dd>
        <dt>{t.coverage_glyph_baseline()}</dt>
        <dd class="ff-map__metric-value">0</dd>
        <dt>{t.coverage_glyph_ascender()}</dt>
        <dd class="ff-map__metric-value">{Math.round(ascent)}</dd>
        <dt>{t.coverage_glyph_descender()}</dt>
        <dd class="ff-map__metric-value">{Math.round(descent)}</dd>
      </dl>
      <p class="ff-map__legend">{t.coverage_glyph_legend()}</p>
    </div>
  );
}
