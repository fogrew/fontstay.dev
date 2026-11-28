import type { RefObject } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Select, type SelectProps } from '@/common/ui';
import { placeBar } from '../lib/text-levels';
import {
  LEVEL_SIZE,
  type LevelStyle,
  LINE_HEIGHT,
  TEXT_LEVELS,
  type TextLevel,
  type Wrap,
} from '../lib/view-state';

const blocksOf = (stage: HTMLElement | null, level: TextLevel) =>
  [
    ...(stage?.querySelectorAll<HTMLElement>(
      `.ff-article:not(.ff-article--ghost) [data-level="${level}"]`,
    ) ?? []),
  ].filter((block) => !block.closest('[inert]'));

export function FormatBar({
  locale,
  id,
  level,
  block,
  focus,
  stage,
  opener,
  style,
  wraps,
  font,
  version,
  onLevel,
  onChange,
  onReset,
  onClose,
}: {
  locale: Locale;
  id: string;
  level: TextLevel;
  block: Element | undefined;
  focus: boolean;
  stage: RefObject<HTMLElement | null>;
  opener: RefObject<HTMLButtonElement | null>;
  style: LevelStyle;
  wraps: SelectProps['options'];
  font: Pick<SelectProps, 'label' | 'value' | 'options' | 'onChange'> | undefined;
  version: string;
  onLevel: (level: TextLevel) => void;
  onChange: (change: LevelStyle) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const t = messagesFor(locale);
  const ids = useId();
  const bar = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ size: 18, lineHeight: 1.5 });
  const [present, setPresent] = useState<readonly TextLevel[]>(TEXT_LEVELS);
  const labels: Record<TextLevel, string> = {
    title: t.format_level_title(),
    heading: t.format_level_heading(),
    subheading: t.format_level_subheading(),
    kicker: t.format_level_kicker(),
    lead: t.format_level_lead(),
    body: t.format_level_body(),
    quote: t.format_level_quote(),
    small: t.format_level_small(),
    code: t.format_level_code(),
  };
  const anchor = () =>
    block?.isConnected && (block as HTMLElement).dataset.level === level
      ? (block as HTMLElement)
      : blocksOf(stage.current, level)[0];

  const close = () => {
    if (bar.current?.contains(document.activeElement)) {
      const button = opener.current;
      const target = button?.checkVisibility({ visibilityProperty: true })
        ? button
        : button?.closest('.ff-toolbar__tools')?.querySelector<HTMLElement>('button');
      target?.focus();
    }
    onClose();
  };

  const place = () => {
    const element = bar.current;
    const target = anchor();
    if (!element || !target) return;
    const selection = document.getSelection();
    const selected =
      selection && !selection.isCollapsed && target.contains(selection.anchorNode)
        ? selection.getRangeAt(0).getBoundingClientRect()
        : undefined;
    const view = window.visualViewport;
    const { left, top } = placeBar(
      selected ?? target.getBoundingClientRect(),
      element.getBoundingClientRect(),
      {
        left: view?.offsetLeft ?? 0,
        top: view?.offsetTop ?? 0,
        width: view?.width ?? document.documentElement.clientWidth,
        height: view?.height ?? window.innerHeight,
      },
    );
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  };

  useEffect(() => {
    const element = bar.current;
    element?.showPopover?.();
    if (focus) {
      anchor()?.scrollIntoView({ block: 'center' });
      element?.querySelector<HTMLElement>('[role="combobox"]')?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    const target = anchor();
    const text = target?.querySelector('.ff-article__code-text') ?? target;
    if (target && text) {
      const size = Number.parseFloat(getComputedStyle(text).fontSize);
      const computed = getComputedStyle(target);
      const ratio =
        Number.parseFloat(computed.lineHeight) / Number.parseFloat(computed.fontSize) || 1.5;
      setMeasured({ size: Math.round(size), lineHeight: Math.round(ratio * 20) / 20 });
    }
    setPresent(TEXT_LEVELS.filter((id) => blocksOf(stage.current, id).length > 0));
    place();
    const observer = new ResizeObserver(place);
    if (bar.current) observer.observe(bar.current);
    if (stage.current) observer.observe(stage.current);
    addEventListener('resize', place);
    addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer.disconnect();
      removeEventListener('resize', place);
      removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [level, block, version]);

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const target = event.target as Element;
      if (bar.current?.contains(target) || opener.current?.contains(target)) return;
      if (stage.current?.contains(target) && target.closest?.('[data-level]')) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const slider = (
    key: 'size' | 'lineHeight',
    label: string,
    limits: { min: number; max: number },
    step: number,
    unit: string,
  ) => {
    const value = style[key] ?? measured[key];
    return (
      <div class="ff-format-bar__field">
        <div class="ff-format-bar__label">
          <label for={`${ids}-${key}`}>{label}</label>
          <output for={`${ids}-${key}`}>
            {value}
            {unit}
          </output>
        </div>
        <input
          class="ff-format-bar__range ff-control"
          id={`${ids}-${key}`}
          type="range"
          min={limits.min}
          max={limits.max}
          step={step}
          value={value}
          onInput={(event) => onChange({ [key]: event.currentTarget.valueAsNumber })}
        />
      </div>
    );
  };

  return (
    <div
      ref={bar}
      id={id}
      class="ff-format-bar"
      popover="manual"
      role="dialog"
      aria-label={`${t.format_bar_label()}: ${labels[level]}`}
    >
      <Select
        compact
        label={t.format_level()}
        value={level}
        options={present.map((value) => ({ value, label: labels[value] }))}
        onChange={(value) => onLevel(value as TextLevel)}
      />
      {slider('size', t.preview_size_label(), LEVEL_SIZE, 1, 'px')}
      {slider('lineHeight', t.preview_line_height_label(), LINE_HEIGHT, 0.05, '')}
      {level !== 'code' && (
        <Select
          compact
          label={t.article_wrap_label()}
          value={style.wrap ?? 'wrap'}
          options={wraps}
          onChange={(value) => onChange({ wrap: value as Wrap })}
        />
      )}
      {font && <Select compact {...font} />}
      <div class="ff-format-bar__actions">
        <button type="button" class="ff-control ff-button ff-button--secondary" onClick={onReset}>
          {t.format_reset()}
        </button>
        <button
          type="button"
          class="ff-control ff-button ff-button--secondary ff-format-bar__close"
          aria-label={t.format_close()}
          title={t.format_close()}
          onClick={close}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
}
