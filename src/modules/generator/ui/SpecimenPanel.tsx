import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Select, Tabs } from '@/common/ui';
import type { PreviewItem } from '../lib/preview-item';
import { glyphAdvance, glyphsForPreview, type SpecimenPreset } from '../lib/specimen';
import './specimen.css';

const SIZES = [12, 16, 20, 28, 36, 48, 64, 80] as const;
const PRESETS: SpecimenPreset[] = ['paper', 'ink', 'cream', 'blue'];

export interface SpecimenPanelProps {
  locale: Locale;
  items: readonly PreviewItem[];
  fontKey: (family: string) => string;
  fontsReady: boolean;
}

export function SpecimenPanel({ locale, items, fontKey, fontsReady }: SpecimenPanelProps) {
  const t = messagesFor(locale);
  const [family, setFamily] = useState(items[0]?.family ?? '');
  const [preset, setPreset] = useState<SpecimenPreset>('paper');
  const [sample, setSample] = useState(t.preview_sample_default());
  const [point, setPoint] = useState<number>();
  const [page, setPage] = useState(0);
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const item = items.find((candidate) => candidate.family === family) ?? items[0];
  const allGlyphs = useMemo(() => (item ? glyphsForPreview(item.codePoints) : []), [item?.id]);
  const pageCount = Math.max(1, Math.ceil(allGlyphs.length / 64));
  const glyphs = allGlyphs.slice(page * 64, (page + 1) * 64);
  const active =
    point && glyphs.includes(point)
      ? point
      : (glyphs.find((codePoint) => !/\s/u.test(String.fromCodePoint(codePoint))) ?? glyphs[0]);
  const char = active === undefined ? '' : String.fromCodePoint(active);
  const metrics = item?.metrics;
  const advance =
    metrics && active !== undefined ? glyphAdvance(item.codePoints, metrics.advances, active) : 0;
  const em = metrics?.unitsPerEm || 1000;
  const ascent = metrics?.typo?.ascent ?? metrics?.hhea.ascent ?? 0;
  const descent = metrics?.typo?.descent ?? metrics?.hhea.descent ?? 0;

  useLayoutEffect(() => {
    if (item)
      root.current?.style.setProperty(
        '--ff-specimen-font',
        `"${fontKey(item.family)}", sans-serif`,
      );
  }, [item?.family]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !item || active === undefined || !fontsReady) return;
    const context = element.getContext('2d');
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(264 * ratio);
    element.height = Math.round(188 * ratio);
    context.scale(ratio, ratio);
    const size = 72;
    const x = 42;
    const y = 109;
    context.font = `${size}px "${fontKey(item.family)}"`;
    const measured = context.measureText(char);
    const lines = [
      { y: y - (ascent / em) * size, color: '#21614b' },
      { y, color: '#af3545' },
      { y: y - (descent / em) * size, color: '#5a4eb5' },
    ];
    for (const line of lines) {
      context.strokeStyle = line.color;
      context.beginPath();
      context.moveTo(8, line.y);
      context.lineTo(256, line.y);
      context.stroke();
    }
    context.fillStyle = '#171717';
    context.fillText(char, x, y);
    context.strokeStyle = '#145c82';
    context.strokeRect(
      x - measured.actualBoundingBoxLeft,
      y - measured.actualBoundingBoxAscent,
      measured.actualBoundingBoxLeft + measured.actualBoundingBoxRight,
      measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent,
    );
    const advanceX = x + (advance / em) * size;
    context.strokeStyle = '#7b4d19';
    context.beginPath();
    context.moveTo(advanceX, 24);
    context.lineTo(advanceX, 166);
    context.stroke();
  }, [active, advance, ascent, descent, em, item?.family, fontsReady]);

  if (!item) return null;
  return (
    <section class="ff-specimen" ref={root} aria-label={t.specimen_heading()}>
      <div class="ff-specimen__controls">
        <Select
          compact
          label={t.specimen_font()}
          value={item.family}
          options={[...new Set(items.map((candidate) => candidate.family))].map((value) => ({
            value,
            label: value,
          }))}
          onChange={(value) => {
            setFamily(value);
            setPage(0);
            setPoint(undefined);
          }}
        />
        <div class="ff-specimen__field">
          <label for="ff-specimen-text">{t.specimen_text()}</label>
          <input
            id="ff-specimen-text"
            class="ff-control ff-specimen__input"
            value={sample}
            maxLength={160}
            onInput={(event) => setSample(event.currentTarget.value)}
          />
        </div>
      </div>
      <Tabs
        animate
        label={t.specimen_heading()}
        items={[
          {
            id: 'waterfall',
            label: t.specimen_waterfall(),
            content: (
              <div class="ff-specimen__waterfall">
                {SIZES.map((size) => (
                  <div class="ff-specimen__row" key={size}>
                    <span class="ff-specimen__size">{size} px</span>
                    <span class="ff-specimen__sample" data-size={size}>
                      {sample || ' '}
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: 'colour',
            label: t.specimen_colour(),
            content: (
              <>
                <fieldset class="ff-specimen__presets">
                  <legend class="ff-sr-only">{t.specimen_presets()}</legend>
                  {PRESETS.map((value) => (
                    <button
                      key={value}
                      class="ff-control ff-button ff-button--secondary"
                      type="button"
                      aria-pressed={preset === value}
                      onClick={() => setPreset(value)}
                    >
                      {value === 'paper'
                        ? t.specimen_paper()
                        : value === 'ink'
                          ? t.specimen_ink()
                          : value === 'cream'
                            ? t.specimen_cream()
                            : t.specimen_blue()}
                    </button>
                  ))}
                </fieldset>
                <p class="ff-specimen__colour-sample" data-preset={preset}>
                  {sample || ' '}
                </p>
              </>
            ),
          },
          {
            id: 'glyphs',
            label: t.specimen_glyphs(),
            content: (
              <>
                <div class="ff-specimen__pagination">
                  <button
                    class="ff-control ff-button ff-button--secondary"
                    type="button"
                    disabled={page === 0}
                    onClick={() => {
                      setPage(page - 1);
                      setPoint(undefined);
                    }}
                  >
                    {t.specimen_previous()}
                  </button>
                  <span>{t.specimen_page({ page: page + 1, total: pageCount })}</span>
                  <button
                    class="ff-control ff-button ff-button--secondary"
                    type="button"
                    disabled={page + 1 >= pageCount}
                    onClick={() => {
                      setPage(page + 1);
                      setPoint(undefined);
                    }}
                  >
                    {t.specimen_next()}
                  </button>
                </div>
                <div class="ff-specimen__glyph-layout">
                  <fieldset class="ff-specimen__glyph-list">
                    <legend class="ff-sr-only">{t.specimen_glyphs()}</legend>
                    {glyphs.map((codePoint) => (
                      <button
                        key={codePoint}
                        type="button"
                        class="ff-control ff-specimen__glyph-button"
                        aria-pressed={active === codePoint}
                        aria-label={`U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`}
                        onClick={() => setPoint(codePoint)}
                      >
                        {String.fromCodePoint(codePoint)}
                      </button>
                    ))}
                  </fieldset>
                  {active !== undefined && (
                    <div class="ff-specimen__glyph-detail">
                      <canvas
                        ref={canvas}
                        class="ff-specimen__canvas"
                        width={264}
                        height={188}
                        role="img"
                        aria-label={t.specimen_diagram({ glyph: char })}
                      />
                      <dl class="ff-specimen__metrics">
                        <dt>{t.specimen_advance()}</dt>
                        <dd class="ff-specimen__metric-value">
                          {Math.round(advance)} / {em}
                        </dd>
                        <dt>{t.specimen_baseline()}</dt>
                        <dd class="ff-specimen__metric-value">0</dd>
                        <dt>{t.specimen_ascender()}</dt>
                        <dd class="ff-specimen__metric-value">{Math.round(ascent)}</dd>
                        <dt>{t.specimen_descender()}</dt>
                        <dd class="ff-specimen__metric-value">{Math.round(descent)}</dd>
                      </dl>
                      <p class="ff-specimen__legend">{t.specimen_legend()}</p>
                    </div>
                  )}
                </div>
              </>
            ),
          },
        ]}
      />
    </section>
  );
}
