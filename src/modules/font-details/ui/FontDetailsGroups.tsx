import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Collapsible, Icon } from '@/common/ui';
import type { FontMetrics } from '@/modules/font-metrics';
import { detailsToggleId } from '../lib/toggle-id';
import { FontDetailsPanel } from './FontDetailsPanel';

export interface FontDetailsEntry {
  id: number;
  title: string;
  face?: string | undefined;
  metrics: FontMetrics;
}

export interface FontDetailsGroupsProps {
  locale: Locale;
  fonts: readonly FontDetailsEntry[];
  onRemove: (id: number) => void;
}

export function FontDetailsGroups({ locale, fonts, onRemove }: FontDetailsGroupsProps) {
  const t = messagesFor(locale);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  if (fonts.length === 0) return null;
  return (
    <section class="ff-generator__section" aria-labelledby="ff-details-heading">
      <h2 class="ff-generator__heading ff-heading" id="ff-details-heading">
        {t.details_heading()}
      </h2>
      {fonts.map((font) => (
        <Collapsible
          key={font.id}
          title={font.title}
          detail={font.face}
          toggleId={detailsToggleId(font.id)}
          open={open.has(font.id)}
          after={
            <button
              type="button"
              class="ff-control ff-icon-button"
              aria-label={t.details_remove({
                name: font.face ? `${font.title} (${font.face})` : font.title,
              })}
              onClick={() => onRemove(font.id)}
            >
              <Icon name="forget" />
            </button>
          }
          onToggle={(next) =>
            setOpen((current) => {
              const copy = new Set(current);
              if (next) copy.add(font.id);
              else copy.delete(font.id);
              return copy;
            })
          }
        >
          {open.has(font.id) && <FontDetailsPanel locale={locale} metrics={font.metrics} />}
        </Collapsible>
      ))}
    </section>
  );
}
