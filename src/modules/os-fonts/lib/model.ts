export const OS_IDS = ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'] as const;
export const STATUSES = ['preinstalled', 'on-demand'] as const;
export const CATEGORIES = ['sans-serif', 'serif', 'monospace', 'cursive'] as const;

export type OsId = (typeof OS_IDS)[number];
export type Status = (typeof STATUSES)[number];
export type Category = (typeof CATEGORIES)[number];

export interface Availability {
  os: OsId;
  versions: string[];
  status: Status;
  source: string;
  inferred?: boolean;
}

export interface OsFont {
  id: string;
  family: string;
  category: Category;
  availability: Availability[];
}

export interface Platform {
  versions: string[];
  note?: string;
}

export interface OsFontsDataset {
  schema: 1;
  generated: string;
  platforms: Record<OsId, Platform>;
  fonts: OsFont[];
}
