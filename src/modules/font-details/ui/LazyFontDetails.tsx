import { type ComponentType, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { FontDetailsGroupsProps } from './FontDetailsGroups';

export function LazyFontDetails(props: FontDetailsGroupsProps) {
  const [Groups, setGroups] = useState<ComponentType<FontDetailsGroupsProps>>();
  const needed = props.fonts.length > 0;
  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    import('./FontDetailsGroups')
      .then((module) => {
        if (!cancelled) setGroups(() => module.FontDetailsGroups);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needed]);
  return Groups ? h(Groups, props) : null;
}
