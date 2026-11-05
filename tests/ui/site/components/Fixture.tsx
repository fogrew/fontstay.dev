import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, CodeBlock, Disclosure, FitField, type FitValue, Select, Tabs } from '@/common/ui';

export function Fixture({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const [value, setValue] = useState<FitValue>({ mode: 'auto' });
  const [autoValue, setAutoValue] = useState(105);
  const [fallback, setFallback] = useState('arial');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div class="ff-fixture" data-ready={ready}>
      <FitField
        locale={locale}
        label={t.fit_size_label()}
        unit={t.fit_percent_unit()}
        value={value}
        autoValue={autoValue}
        min={50}
        max={200}
        onChange={setValue}
      />
      <Button variant="primary" onClick={() => setAutoValue(120)}>
        {t.fit_recalculate()}
      </Button>
      <Select
        label={t.fallback_font_label()}
        value={fallback}
        options={[
          { value: 'arial', label: 'Arial' },
          { value: 'helvetica', label: 'Helvetica' },
        ]}
        onChange={setFallback}
      />
      <Tabs
        label={t.preview_tabs_label()}
        items={[
          { id: 'preview', label: t.preview_tab(), content: <p>{t.home_heading()}</p> },
          {
            id: 'css',
            label: t.css_tab(),
            content: (
              <CodeBlock
                locale={locale}
                label={t.css_tab()}
                code={'font-family: "Example", sans-serif;'}
              />
            ),
          },
        ]}
      />
      <Disclosure summary={t.guide_disclosure()}>
        <code>{'<script>example</script>'}</code>
      </Disclosure>
    </div>
  );
}
