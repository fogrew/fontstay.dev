import { useId, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Icon } from '@/common/ui';
import { looksLikeQueryList, parseBrowserslist } from '../lib/browserslist-file';
import { MY_STATS_PRESET, PRESETS } from '../lib/presets';
import {
  addTags,
  browserOf,
  isExcluded,
  removeTag,
  splitQuery,
  TAG_GROUPS,
  toggleNot,
} from '../lib/tags';
import { BrowserIcon } from './BrandIcon';

const SETS = PRESETS.filter((preset) => ['usage', 'desktop', 'mobile'].includes(preset.id));
const stripNot = (tag: string) => tag.replace(/^not\s+/i, '');

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
  browser?: string | undefined;
}

export function TagEditor({
  locale,
  query,
  onChange,
  stats = false,
}: {
  locale: Locale;
  query: string;
  onChange: (query: string) => void;
  stats?: boolean;
}) {
  const t = messagesFor(locale);
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const parts = splitQuery(query);
  const groupName = (id: (typeof TAG_GROUPS)[number]['id']) => {
    if (id === 'popularity') return t.audience_tags_group_popularity();
    if (id === 'baseline') return t.audience_tags_group_baseline();
    return id === 'recency' ? t.audience_tags_group_recency() : t.audience_tags_group_browsers();
  };
  const sets: QuickTag[] = [
    ...SETS.map((preset) => ({
      key: preset.id,
      label: t[preset.label](),
      query: preset.query,
    })),
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
      items: group.tags.map((tag) => ({
        key: tag.label,
        label: tag.label,
        query: tag.include,
        browser: tag.browser,
      })),
    })),
    { id: 'sets', title: t.audience_tags_group_sets(), items: sets },
  ];
  const commit = (text: string) => {
    const added = looksLikeQueryList(text) ? parseBrowserslist(text) : splitQuery(text);
    if (added.length > 0) onChange(addTags(query, added));
    setDraft('');
  };
  return (
    <div class="ff-tags">
      <fieldset class="ff-tags__field">
        <legend class="ff-sr-only">{t.audience_tags_label()}</legend>
        <ul class="ff-tags__chips">
          {parts.map((tag, index) => (
            <li key={`${tag}-${index}`} class="ff-chip" data-excluded={isExcluded(tag)}>
              <button
                type="button"
                class="ff-chip__not"
                aria-pressed={isExcluded(tag)}
                aria-label={t.audience_tag_exclude({ tag: stripNot(tag) })}
                onClick={() => onChange(toggleNot(query, tag))}
              >
                <span aria-hidden="true">⊘ </span>
                {t.audience_tag_not()}
              </button>
              <span class="ff-chip__label">
                <Label tag={stripNot(tag)} />
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
        </ul>
        <input
          ref={input}
          class="ff-tags__input"
          type="text"
          spellcheck={false}
          autocomplete="off"
          aria-label={t.audience_tags_input()}
          aria-describedby={hintId}
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
              <li key={item.key}>
                <button
                  type="button"
                  class="ff-tag"
                  disabled={splitQuery(item.query).every((part) => parts.includes(part))}
                  onClick={() => {
                    onChange(addTags(query, splitQuery(item.query)));
                    input.current?.focus({ preventScroll: true });
                  }}
                >
                  {item.browser && <BrowserIcon id={item.browser} />}
                  {group.id === 'baseline' && (
                    <Icon
                      name={item.label.includes('newly') ? 'baseline-newly' : 'baseline-widely'}
                    />
                  )}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
