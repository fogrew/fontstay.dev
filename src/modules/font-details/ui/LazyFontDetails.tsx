import { type ComponentType, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { FontDetailsPanelProps } from './FontDetailsPanel';

export function LazyFontDetails(props: FontDetailsPanelProps) {
  const [Panel, setPanel] = useState<ComponentType<FontDetailsPanelProps>>();
  useEffect(() => {
    let cancelled = false;
    import('./FontDetailsPanel')
      .then((module) => {
        if (!cancelled) setPanel(() => module.FontDetailsPanel);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return Panel ? h(Panel, props) : null;
}
