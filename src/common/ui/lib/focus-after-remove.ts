export function neighbourAfterRemoval<T>(items: readonly T[], removed: T): T | undefined {
  const index = items.indexOf(removed);
  if (index < 0) return undefined;
  return items[index + 1] ?? items[index - 1];
}

export function focusToggle(toggleId: string): boolean {
  const toggle = document.querySelector<HTMLElement>(`[data-toggle-id="${CSS.escape(toggleId)}"]`);
  toggle?.focus();
  return toggle !== null;
}
