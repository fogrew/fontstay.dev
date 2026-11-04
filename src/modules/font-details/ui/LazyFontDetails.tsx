import { type ComponentType, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { FontDetailsPanelProps } from './FontDetailsPanel';

export function LazyFontDetails(props: FontDetailsPanelProps) {
  const [Panel, setPanel] = useState<ComponentType<FontDetailsPanelProps>>();
  useEffect(() => {
    let cancelled = false;
    void import('./FontDetailsPanel').then((module) => {
      if (!cancelled) setPanel(() => module.FontDetailsPanel);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return Panel ? h(Panel, props) : null;
}
