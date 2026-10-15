import { useId, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Icon } from '@/common/ui';
import { looksLikeQueryList, parseBrowserslist } from '../lib/browserslist-file';
import { MY_STATS_PRESET, PRESETS } from '../lib/presets';
import { addTags, browserOf, removeTag, splitQuery, TAG_GROUPS } from '../lib/tags';
import { BrowserIcon, OsIcon } from './BrandIcon';

const SETS = PRESETS.filter((preset) => ['usage', 'desktop', 'mobile'].includes(preset.id));
const LATEST = [
  'last 1 chrome version',
  'last 1 edge version',
  'last 1 firefox version',
  'last 1 safari version',
  'last 1 ios_saf version',
  'last 1 and_chr version',
].join(', ');

function Label({ tag }: { tag: string }) {
  const browser = browserOf(tag);
  return (
    <>
      {browser && <BrowserIcon id={browser} />}
      {/baseline/i.test(tag) && (
        <Icon name={/newly/i.test(tag) ? 'baseline-newly' : 'baseline-widely'} />
      )}
      {tag}
    </>
  );
}

interface QuickTag {
  key: string;
  label: string;
  query: string;
  exclude?: string | undefined;
  browser?: string | undefined;
  os?: string | undefined;
}

export function TagEditor({
  locale,
  query,
  onChange,
  stats = false,
  invalid = false,
  describedBy,
}: {
  locale: Locale;
  query: string;
  onChange: (query: string) => void;
  stats?: boolean;
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const t = messagesFor(locale);
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const parts = splitQuery(query);
  const groupName = (id: (typeof TAG_GROUPS)[number]['id']) => {
    if (id === 'popularity') return t.audience_tags_group_popularity();
    if (id === 'baseline') return t.audience_tags_group_baseline();
    if (id === 'os') return t.audience_tags_group_os();
    return id === 'recency' ? t.audience_tags_group_recency() : t.audience_tags_group_browsers();
  };
  const osLabel = (id: string) => t[`audience_os_${id}` as 'audience_os_linux']();
  const sets: QuickTag[] = [
    ...SETS.map((preset) => ({ key: preset.id, label: t[preset.label](), query: preset.query })),
    ...(stats
      ? [
          {
            key: MY_STATS_PRESET.id,
            label: t[MY_STATS_PRESET.label](),
            query: MY_STATS_PRESET.query,
          },
        ]
      : []),
  ];
  const groups: { id: string; title: string; items: QuickTag[] }[] = [
    ...TAG_GROUPS.map((group) => ({
      id: group.id,
      title: groupName(group.id),
      items: [
        ...group.tags.map((tag) => ({
          key: tag.label,
          label: tag.os ? osLabel(tag.os) : tag.label,
          query: tag.include,
          exclude: tag.exclude,
          browser: tag.browser,
          os: tag.os,
        })),
        ...(group.id === 'baseline'
          ? [{ key: 'latest', label: t.audience_set_latest(), query: LATEST }]
          : []),
      ],
    })),
    { id: 'sets', title: t.audience_tags_group_sets(), items: sets },
  ];
  const commit = (text: string) => {
    const added = looksLikeQueryList(text) ? parseBrowserslist(text) : splitQuery(text);
    if (added.length > 0) onChange(addTags(query, added));
    setDraft('');
  };
  const add = (value: string) => {
    onChange(addTags(query, splitQuery(value)));
    input.current?.focus({ preventScroll: true });
  };
  const taken = (value: string) => splitQuery(value).every((part) => parts.includes(part));
  return (
    <div class="ff-tags">
      <fieldset class="ff-tags__field" data-query={query} aria-invalid={invalid}>
        <legend class="ff-sr-only">{t.audience_tags_label()}</legend>
        <ul class="ff-tags__chips">
          {parts.map((tag, index) => (
            <li key={`${tag}-${index}`} class="ff-chip">
              <span class="ff-chip__label">
                <Label tag={tag} />
              </span>
              <button
                type="button"
                class="ff-chip__remove"
                aria-label={t.audience_tags_remove({ tag })}
                onClick={() => onChange(removeTag(query, tag))}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
          <li class="ff-tags__entry">
            <input
              ref={input}
              class="ff-tags__input"
              type="text"
              spellcheck={false}
              autocomplete="off"
              aria-label={t.audience_tags_input()}
              aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
              aria-invalid={invalid}
              value={draft}
              onInput={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || (event.key === ',' && draft.trim())) {
                  event.preventDefault();
                  commit(draft);
                } else if (event.key === 'Backspace' && !draft && parts.length > 0) {
                  onChange(removeTag(query, parts[parts.length - 1] ?? ''));
                }
              }}
              onBlur={() => draft.trim() && commit(draft)}
              onPaste={(event) => {
                const text = event.clipboardData?.getData('text') ?? '';
                if (!looksLikeQueryList(text)) return;
                event.preventDefault();
                commit(text);
              }}
            />
          </li>
        </ul>
      </fieldset>
      <p id={hintId} class="ff-muted">
        {t.audience_tags_input_hint()}
      </p>
      {groups.map((group) => (
        <div key={group.id}>
          <h4>
            {group.id === 'baseline' && <Icon name="baseline-widely" />}
            {group.title}
          </h4>
          <ul class="ff-tags__list">
            {group.items.map((item) => (
              <li key={item.key} class="ff-quick">
                <button
                  type="button"
                  class="ff-tag"
                  disabled={taken(item.query)}
                  onClick={() => add(item.query)}
                >
                  {item.browser && <BrowserIcon id={item.browser} />}
                  {item.os && <OsIcon os={item.os as 'linux'} />}
                  {group.id === 'baseline' && (
                    <Icon
                      name={item.label.includes('newly') ? 'baseline-newly' : 'baseline-widely'}
                    />
                  )}
                  {item.label}
                </button>
                {item.exclude && (
                  <button
                    type="button"
                    class="ff-quick__not"
                    disabled={taken(item.exclude)}
                    aria-label={t.audience_tag_not_action({ tag: item.label })}
                    onClick={() => add(item.exclude ?? '')}
                  >
                    {t.audience_tag_not()}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
