import {
  type Availability,
  CATEGORIES,
  OS_IDS,
  type OsFont,
  type OsFontsDataset,
  STATUSES,
} from './model';

const ID = /^[a-z][a-z0-9-]{0,63}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FONTS = 2000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isHttps = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export function validateDataset(data: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(data)) return ['dataset must be an object'];
  if (data.schema !== 1) errors.push('schema must be 1');
  if (
    typeof data.generated !== 'string' ||
    !DATE.test(data.generated) ||
    Number.isNaN(Date.parse(data.generated))
  ) {
    errors.push('generated must be a YYYY-MM-DD date');
  }

  const versionsOf = new Map<string, Set<string>>();
  const platforms = data.platforms;
  if (!isRecord(platforms)) {
    errors.push('platforms must be an object');
  } else {
    for (const key of Object.keys(platforms)) {
      if (!(OS_IDS as readonly string[]).includes(key)) errors.push(`unknown platform ${key}`);
    }
    for (const os of OS_IDS) {
      const platform = platforms[os];
      if (!isRecord(platform) || !Array.isArray(platform.versions)) {
        errors.push(`platform ${os} needs a versions array`);
        continue;
      }
      const versions = platform.versions;
      if (!versions.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 32)) {
        errors.push(`platform ${os} has an invalid version`);
      }
      if (new Set(versions).size !== versions.length)
        errors.push(`platform ${os} repeats a version`);
      versionsOf.set(os, new Set(versions as string[]));
    }
  }

  if (!Array.isArray(data.fonts)) return [...errors, 'fonts must be an array'];
  if (data.fonts.length > MAX_FONTS) errors.push('too many fonts');
  const ids = new Set<string>();
  const families = new Set<string>();
  for (const [index, font] of data.fonts.entries()) {
    const where = `fonts[${index}]`;
    if (!isRecord(font)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    if (typeof font.id !== 'string' || !ID.test(font.id)) errors.push(`${where}.id is invalid`);
    else if (ids.has(font.id)) errors.push(`${where}.id ${font.id} is duplicated`);
    else ids.add(font.id);
    if (typeof font.family !== 'string' || font.family.trim() === '' || font.family.length > 100) {
      errors.push(`${where}.family is invalid`);
    } else if (families.has(font.family.toLowerCase())) {
      errors.push(`${where}.family ${font.family} is duplicated`);
    } else {
      families.add(font.family.toLowerCase());
    }
    if (!(CATEGORIES as readonly string[]).includes(font.category as string)) {
      errors.push(`${where}.category is invalid`);
    }
    if (!Array.isArray(font.availability) || font.availability.length === 0) {
      errors.push(`${where}.availability needs at least one entry`);
      continue;
    }
    const seen = new Set<string>();
    for (const [position, entry] of font.availability.entries()) {
      const label = `${where}.availability[${position}]`;
      if (!isRecord(entry)) {
        errors.push(`${label} must be an object`);
        continue;
      }
      const known = versionsOf.get(entry.os as string);
      if (!known) errors.push(`${label}.os is unknown`);
      if (!(STATUSES as readonly string[]).includes(entry.status as string)) {
        errors.push(`${label}.status is invalid`);
      }
      if (entry.inferred !== undefined && typeof entry.inferred !== 'boolean') {
        errors.push(`${label}.inferred must be a boolean`);
      }
      if (!isHttps(entry.source)) errors.push(`${label}.source must be an https URL`);
      if (
        !Array.isArray(entry.versions) ||
        entry.versions.length === 0 ||
        !entry.versions.every((v) => typeof v === 'string')
      ) {
        errors.push(`${label}.versions must be a non-empty string array`);
        continue;
      }
      for (const version of entry.versions as string[]) {
        if (known && !known.has(version)) errors.push(`${label} uses unknown version ${version}`);
        const key = `${entry.os}:${version}`;
        if (seen.has(key)) errors.push(`${where} repeats ${key}`);
        seen.add(key);
      }
    }
  }
  return errors;
}

export function assertDataset(data: unknown): OsFontsDataset {
  const errors = validateDataset(data);
  if (errors.length > 0)
    throw new Error(`Invalid OS fonts dataset: ${errors.slice(0, 5).join('; ')}`);
  return data as OsFontsDataset;
}

export type { Availability, OsFont };
