import { type Locale, messagesFor } from '@/common/i18n';
import {
  addTag,
  browserOf,
  EXCLUDE_TAGS,
  INCLUDE_TAGS,
  isExcluded,
  removeTag,
  splitQuery,
} from '../lib/tags';
import { BrowserIcon } from './BrandIcon';

function Tag({ tag }: { tag: string }) {
  const browser = browserOf(tag);
  return (
    <>
      {browser && <BrowserIcon id={browser} />}
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
  const parts = splitQuery(query);
  const groups = [
    { label: t.audience_tags_included(), tags: parts.filter((part) => !isExcluded(part)) },
    { label: t.audience_tags_excluded(), tags: parts.filter(isExcluded) },
  ];
  const suggestions = [
    { label: t.audience_tags_add_include(), tags: INCLUDE_TAGS },
    { label: t.audience_tags_add_exclude(), tags: EXCLUDE_TAGS },
  ];
  return (
    <div class="ff-tags">
      {groups.map((group) => (
        <div key={group.label}>
          <h4>{group.label}</h4>
          <ul class="ff-tags__list">
            {group.tags.length === 0 && <li class="ff-muted">{t.audience_tags_none()}</li>}
            {group.tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  class="ff-tag"
                  aria-label={t.audience_tags_remove({ tag })}
                  onClick={() => onChange(removeTag(query, tag))}
                >
                  <Tag tag={tag} />
                  <span aria-hidden="true"> ×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {suggestions.map((group) => (
        <div key={group.label}>
          <h4>{group.label}</h4>
          <ul class="ff-tags__list">
            {group.tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  class="ff-tag ff-tag--suggestion"
                  disabled={parts.includes(tag)}
                  onClick={() => onChange(addTag(query, tag))}
                >
                  <Tag tag={tag} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
