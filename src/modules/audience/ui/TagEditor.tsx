import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Icon } from '@/common/ui';
import { addTag, browserOf, isExcluded, removeTag, splitQuery, TAG_GROUPS } from '../lib/tags';
import { BrowserIcon } from './BrandIcon';

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

export function TagEditor({
  locale,
  query,
  onChange,
}: {
  locale: Locale;
  query: string;
  onChange: (query: string) => void;
}) {
  const t = messagesFor(locale);
  const [mode, setMode] = useState<'include' | 'exclude'>('include');
  const parts = splitQuery(query);
  const groups = [
    { label: t.audience_tags_included(), tags: parts.filter((part) => !isExcluded(part)) },
    { label: t.audience_tags_excluded(), tags: parts.filter(isExcluded) },
  ];
  const groupName = (id: (typeof TAG_GROUPS)[number]['id']) => {
    if (id === 'popularity') return t.audience_tags_group_popularity();
    if (id === 'baseline') return t.audience_tags_group_baseline();
    return id === 'recency' ? t.audience_tags_group_recency() : t.audience_tags_group_browsers();
  };
  return (
    <div class="ff-tags">
      {groups.map((group) => (
        <div key={group.label}>
          <h4>{group.label}</h4>
          <ul class="ff-tags__list">
            {group.tags.length === 0 && <li class="ff-muted">{t.audience_tags_none()}</li>}
            {group.tags.map((tag, index) => (
              <li key={`${tag}-${index}`}>
                <button
                  type="button"
                  class="ff-tag"
                  aria-label={t.audience_tags_remove({ tag })}
                  onClick={() => onChange(removeTag(query, tag))}
                >
                  <Label tag={tag} />
                  <span aria-hidden="true"> ×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <fieldset class="ff-tags__mode">
        <legend>{t.audience_tags_mode_label()}</legend>
        {(['include', 'exclude'] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="ff-tags-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
            />{' '}
            {value === 'include' ? t.audience_tags_included() : t.audience_tags_excluded()}
          </label>
        ))}
      </fieldset>
      {TAG_GROUPS.map((group) => (
        <div key={group.id}>
          <h4>
            {group.id === 'baseline' && <Icon name="baseline-widely" />}
            {groupName(group.id)}
          </h4>
          <ul class="ff-tags__list">
            {group.tags.map((tag) => {
              const query_ = mode === 'include' ? tag.include : tag.exclude;
              return (
                <li key={tag.label}>
                  <button
                    type="button"
                    class="ff-tag"
                    disabled={parts.includes(query_)}
                    onClick={() => onChange(addTag(query, query_))}
                  >
                    {tag.browser && <BrowserIcon id={tag.browser} />}
                    {group.id === 'baseline' && (
                      <Icon
                        name={tag.label.includes('newly') ? 'baseline-newly' : 'baseline-widely'}
                      />
                    )}
                    {tag.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
