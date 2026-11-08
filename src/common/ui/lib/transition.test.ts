import { afterEach, describe, expect, it, vi } from 'vitest';
import { transition } from './transition';

afterEach(() => vi.unstubAllGlobals());

describe('transition', () => {
  it('names a view transition only until its animation finishes', async () => {
    const root = { dataset: {} as Record<string, string>, hasAttribute: () => false };
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const startViewTransition = vi.fn((update: () => Promise<void>) => {
      void update();
      return { finished };
    });
    vi.stubGlobal('document', { documentElement: root, startViewTransition });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const update = vi.fn();
    transition(update);
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset).toHaveProperty('transition');
    finish();
    await vi.waitFor(() => expect(root.dataset).not.toHaveProperty('transition'));
  });

  it('updates without a view transition when reduced motion is requested', () => {
    const root = { dataset: {} as Record<string, string>, hasAttribute: () => false };
    const startViewTransition = vi.fn();
    vi.stubGlobal('document', { documentElement: root, startViewTransition });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const update = vi.fn();
    transition(update);
    expect(update).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(root.dataset).not.toHaveProperty('transition');
  });

  it('keeps names active while a later transition is still running', async () => {
    const root = { dataset: {} as Record<string, string>, hasAttribute: () => false };
    const finishes: (() => void)[] = [];
    const startViewTransition = vi.fn((update: () => Promise<void>) => {
      void update();
      return { finished: new Promise<void>((resolve) => finishes.push(resolve)) };
    });
    vi.stubGlobal('document', { documentElement: root, startViewTransition });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    transition(() => {});
    transition(() => {});
    finishes[0]?.();
    await Promise.resolve();
    expect(startViewTransition).toHaveBeenCalledTimes(2);
    expect(root.dataset).toHaveProperty('transition');
    finishes[1]?.();
    await vi.waitFor(() => expect(root.dataset).not.toHaveProperty('transition'));
  });
});
