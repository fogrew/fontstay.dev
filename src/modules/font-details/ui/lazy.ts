import { type ComponentType, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export function lazyPanel<P extends object>(
  load: () => Promise<ComponentType<P>>,
): ComponentType<P> {
  return (props) => {
    const [Panel, setPanel] = useState<ComponentType<P>>();
    useEffect(() => {
      let cancelled = false;
      load()
        .then((component) => {
          if (!cancelled) setPanel(() => component);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []);
    return Panel ? h(Panel, props) : null;
  };
}
