export interface SidebarLimits {
  min: number;
  max: number;
  initial: number;
}

export interface SidebarState {
  open: boolean;
  width: number;
}

export function clampWidth(raw: number, limits: SidebarLimits): number {
  const max = Math.max(limits.min, limits.max);
  return Math.round(Math.min(max, Math.max(limits.min, raw)));
}

export function dragState(raw: number, limits: SidebarLimits, last: number): SidebarState {
  if (raw < limits.min / 2) return { open: false, width: last };
  return { open: true, width: clampWidth(raw, limits) };
}

export function parseSidebar(
  value: unknown,
  limits: SidebarLimits,
  defaultOpen: boolean,
): SidebarState {
  const fallback = { open: defaultOpen, width: limits.initial };
  if (typeof value !== 'object' || value === null) return fallback;
  const { open, width } = value as Record<string, unknown>;
  return {
    open: typeof open === 'boolean' ? open : defaultOpen,
    width:
      typeof width === 'number' && Number.isFinite(width)
        ? clampWidth(width, limits)
        : limits.initial,
  };
}
