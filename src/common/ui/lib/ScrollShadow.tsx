import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface ScrollShadowProps {
  class?: string | undefined;
  tabIndex?: number | undefined;
  label?: string | undefined;
  scrollRef?: Ref<HTMLDivElement> | undefined;
  children: ComponentChildren;
}

interface Edges {
  start: boolean;
  end: boolean;
  top: boolean;
  bottom: boolean;
}

const NONE: Edges = { start: false, end: false, top: false, bottom: false };

export function measureEdges(box: {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}): Edges {
  const scrolled = Math.abs(box.scrollLeft);
  const horizontalMax = box.scrollWidth - box.clientWidth;
  const verticalMax = box.scrollHeight - box.clientHeight;
  return {
    start: horizontalMax > 1 && scrolled > 1,
    end: horizontalMax > 1 && scrolled < horizontalMax - 1,
    top: verticalMax > 1 && box.scrollTop > 1,
    bottom: verticalMax > 1 && box.scrollTop < verticalMax - 1,
  };
}

export function ScrollShadow({
  class: className,
  tabIndex,
  label,
  scrollRef,
  children,
}: ScrollShadowProps) {
  const inner = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edges>(NONE);
  useEffect(() => {
    const element = inner.current;
    if (!element) return;
    const update = () => setEdges(measureEdges(element));
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const observeChildren = () => {
      for (const child of element.children) observer.observe(child);
    };
    observeChildren();
    const mutations = new MutationObserver(() => {
      observeChildren();
      update();
    });
    mutations.observe(element, { childList: true });
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
  const attach = (element: HTMLDivElement | null) => {
    inner.current = element;
    if (typeof scrollRef === 'function') scrollRef(element);
    else if (scrollRef) (scrollRef as { current: HTMLDivElement | null }).current = element;
  };
  return (
    <div
      class="ff-shadow"
      data-start={edges.start}
      data-end={edges.end}
      data-top={edges.top}
      data-bottom={edges.bottom}
    >
      <div
        ref={attach}
        class={`ff-shadow__scroll${className ? ` ${className}` : ''}`}
        tabIndex={tabIndex}
        {...(label ? { role: 'region', 'aria-label': label } : {})}
      >
        {children}
      </div>
      <span class="ff-shadow__edge" data-edge="start" aria-hidden="true" />
      <span class="ff-shadow__edge" data-edge="end" aria-hidden="true" />
      <span class="ff-shadow__edge" data-edge="top" aria-hidden="true" />
      <span class="ff-shadow__edge" data-edge="bottom" aria-hidden="true" />
    </div>
  );
}
