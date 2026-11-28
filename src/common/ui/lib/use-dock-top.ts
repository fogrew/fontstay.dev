import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

const DESKTOP_LAYOUT = '(min-width: 64rem)';

export function useDockTop(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const desktop = window.matchMedia(DESKTOP_LAYOUT);
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!desktop.matches) {
        el.style.removeProperty('--ff-dock-top');
        return;
      }
      if (!el.getClientRects().length) return;
      const inset = Number.parseFloat(getComputedStyle(el).insetBlockStart) || 0;
      el.style.setProperty('--ff-dock-top', `${Math.max(el.getBoundingClientRect().top, inset)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
}
