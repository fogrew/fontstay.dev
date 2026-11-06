import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Collapsible } from '@/common/ui';
import type { FontMetrics } from '@/modules/font-metrics';
import { FontDetailsPanel } from './FontDetailsPanel';

export interface FontDetailsEntry {
  id: number;
  title: string;
  metrics: FontMetrics;
}

export interface FontDetailsGroupsProps {
  locale: Locale;
  fonts: readonly FontDetailsEntry[];
}

export function FontDetailsGroups({ locale, fonts }: FontDetailsGroupsProps) {
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
          open={open.has(font.id)}
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
