export const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024;
export const MAX_BACKGROUND_SIDE = 8192;
export const MAX_BACKGROUND_PIXELS = 24_000_000;
export const BACKGROUND_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export const BACKGROUND_FITS = ['cover', 'contain', 'actual'] as const;
export type BackgroundFit = (typeof BACKGROUND_FITS)[number];

export type BackgroundType = (typeof BACKGROUND_TYPES)[number];
export type BackgroundRejection = 'type' | 'size' | 'dimensions' | 'unreadable';
