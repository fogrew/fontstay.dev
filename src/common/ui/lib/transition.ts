type Transition = { finished: Promise<unknown> };
type Transitioning = Document & {
  startViewTransition?: (update: () => Promise<void>) => Transition;
};

const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.hasAttribute('data-motion');

export function transition(update: () => void): void {
  const doc = document as Transitioning;
  if (!doc.startViewTransition || reduced()) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.transition = '';
  const run = doc.startViewTransition(async () => {
    update();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const done = () => delete root.dataset.transition;
  run.finished.then(done, done);
}
