import { useMemo } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { auditSplitFaces, type FaceRule } from '@/modules/fallback-fit';

const MAX_CHARACTERS = 120;
const list = (rules: readonly number[]) => rules.map((index) => index + 1).join(', ');
const clip = (text: string) =>
  text.length > MAX_CHARACTERS ? `${text.slice(0, MAX_CHARACTERS)}…` : text;

export function SplitWarnings({ locale, rules }: { locale: Locale; rules: readonly FaceRule[] }) {
  const t = messagesFor(locale);
  const issues = useMemo(() => auditSplitFaces(rules), [rules]);
  if (issues.length === 0) return null;
  return (
    <section class="ff-split-warnings" aria-label={t.split_title()}>
      <h3 class="ff-heading">{t.split_title()}</h3>
      <p class="ff-muted">{t.split_note()}</p>
      <ul class="ff-generator__list">
        {issues.map((issue) => {
          const base = {
            family: issue.family,
            weight: issue.weight,
            style: issue.style,
            characters: clip(issue.characters),
            count: issue.count,
          };
          const first = issue.rules[0] ?? 0;
          const second = issue.rules[1] ?? 0;
          const text =
            issue.kind === 'latin-split'
              ? t.split_latin({ ...base, rules: list(issue.rules) })
              : issue.kind === 'late-real-face'
                ? t.split_late({ ...base, first: first + 1, second: second + 1 })
                : t.split_overlap({ ...base, rules: list(issue.rules) });
          return (
            <li class="ff-generator__item" key={`${issue.kind}-${issue.rules.join('-')}`}>
              {text}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
