import {
  type Category,
  type OsAvailability,
  type OsFontsDataset,
  type OsId,
  osAvailability,
} from '@/modules/os-fonts';

export const CATALOG_SYSTEMS: readonly OsId[] = [
  'windows',
  'macos',
  'linux',
  'chromeos',
  'android',
  'ios',
];

export interface CatalogCell {
  level: OsAvailability;
  present: string[];
  missing: string[];
}

export interface CatalogRow {
  id: string;
  family: string;
  category: Category;
  cells: Record<OsId, CatalogCell>;
}

export type SystemShares = Partial<Record<OsId, number>>;

const LEVEL_WEIGHT: Record<OsAvailability, number> = {
  preinstalled: 1,
  partial: 0.5,
  'on-demand': 0,
  unknown: 0,
};

export function catalogRows(dataset: OsFontsDataset): CatalogRow[] {
  return dataset.fonts.map((font) => ({
    id: font.id,
    family: font.family,
    category: font.category,
    cells: Object.fromEntries(
      CATALOG_SYSTEMS.map((os) => [os, osAvailability(font, os, dataset)]),
    ) as Record<OsId, CatalogCell>,
  }));
}

export function audienceCoverage(row: CatalogRow, shares: SystemShares): number {
  let total = 0;
  let covered = 0;
  for (const os of CATALOG_SYSTEMS) {
    const share = shares[os] ?? 0;
    total += share;
    covered += share * LEVEL_WEIGHT[row.cells[os].level];
  }
  return total > 0 ? (covered / total) * 100 : 0;
}

export type SortKey = 'family' | 'category' | 'coverage' | OsId;

const LEVEL_ORDER: Record<OsAvailability, number> = {
  preinstalled: 3,
  partial: 2,
  'on-demand': 1,
  unknown: 0,
};

export function sortRows(
  rows: readonly CatalogRow[],
  key: SortKey,
  descending: boolean,
  shares: SystemShares,
): CatalogRow[] {
  const value = (row: CatalogRow): number | string => {
    if (key === 'family') return row.family.toLowerCase();
    if (key === 'category') return row.category;
    if (key === 'coverage') return audienceCoverage(row, shares);
    return LEVEL_ORDER[row.cells[key].level];
  };
  const direction = descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    const order =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    return order * direction || a.family.localeCompare(b.family);
  });
}
