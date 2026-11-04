import type { Font } from 'fontkitten';
import {
  type FontAxis,
  type FontDetails,
  type FontFeature,
  type FontInstance,
  type FontNames,
  type FontPalettes,
  type LayoutTable,
  MAX_AXES,
  MAX_FEATURES,
  MAX_INSTANCES,
  MAX_NAME_LENGTH,
  MAX_PALETTE_ENTRIES,
  MAX_PALETTES,
  MAX_SCRIPTS,
} from './model';

interface TableStream {
  pos: number;
  buffer: Uint8Array;
}

interface RawFont {
  directory: { tables: Record<string, { length: number } | undefined> };
  _getTableStream(tag: string): TableStream | null;
  name?: { records?: Record<string, Record<string, unknown> | undefined> };
  fvar?: {
    axis?: {
      axisTag: string;
      name?: { en?: unknown };
      minValue: number;
      defaultValue: number;
      maxValue: number;
    }[];
    instance?: { name?: { en?: unknown }; coord: number[] }[];
  };
  CPAL?: {
    numPaletteEntries: number;
    numPalettes: number;
    colorRecords: { red: number; green: number; blue: number; alpha: number }[];
    colorRecordIndices: number[];
  };
}

const COLOR_TABLES: readonly [string, string][] = [
  ['COLR', 'COLR'],
  ['SVG ', 'SVG'],
  ['sbix', 'sbix'],
  ['CBDT', 'CBDT'],
];
const NAME_FIELDS: Record<keyof FontNames, string> = {
  copyright: 'copyright',
  version: 'version',
  designer: 'designer',
  manufacturer: 'manufacturer',
  description: 'description',
  license: 'license',
  licenseUrl: 'licenseURL',
  vendorUrl: 'vendorURL',
  designerUrl: 'designerURL',
};
const LABELLED_FEATURE = /^(?:ss(?:0[1-9]|1\d|20)|cv(?:0[1-9]|[1-9]\d))$/;

class Reader {
  constructor(private readonly view: DataView) {}

  u16(offset: number): number {
    if (offset < 0 || offset + 2 > this.view.byteLength) throw new RangeError('out of bounds');
    return this.view.getUint16(offset);
  }

  tag(offset: number): string | null {
    if (offset < 0 || offset + 4 > this.view.byteLength) throw new RangeError('out of bounds');
    let text = '';
    for (let i = 0; i < 4; i++) {
      const code = this.view.getUint8(offset + i);
      if (code < 0x20 || code > 0x7e) return null;
      text += String.fromCharCode(code);
    }
    return text;
  }
}

function tableBytes(font: RawFont, tag: string): Uint8Array | null {
  const entry = font.directory.tables[tag];
  if (!entry) return null;
  const stream = font._getTableStream(tag);
  if (!stream) return null;
  const start = stream.pos;
  return stream.buffer.subarray(start, Math.min(start + entry.length, stream.buffer.length));
}

function nameText(font: RawFont, id: number): string | null {
  const record = font.name?.records?.fontFeatures?.[id];
  return text(record);
}

function text(record: unknown): string | null {
  if (typeof record === 'string') return clean(record);
  if (typeof record !== 'object' || record === null) return null;
  const values = record as Record<string, unknown>;
  const value = values.en ?? values[Object.keys(values)[0] ?? ''];
  return typeof value === 'string' ? clean(value) : null;
}

function clean(value: string): string | null {
  const trimmed = value.replace(/\0/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return trimmed === '' ? null : trimmed;
}

function readLayout(font: RawFont, table: LayoutTable, features: Map<string, FontFeature>) {
  const bytes = tableBytes(font, table);
  const scripts: string[] = [];
  if (!bytes || bytes.length < 10) return scripts;
  const reader = new Reader(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const scriptList = reader.u16(4);
  const featureList = reader.u16(6);

  if (scriptList) {
    const count = Math.min(reader.u16(scriptList), MAX_SCRIPTS);
    for (let i = 0; i < count; i++) {
      const tag = reader.tag(scriptList + 2 + i * 6);
      if (tag) scripts.push(tag);
    }
  }

  if (featureList) {
    const count = reader.u16(featureList);
    for (let i = 0; i < count; i++) {
      const record = featureList + 2 + i * 6;
      const tag = reader.tag(record);
      if (!tag) continue;
      const known = features.get(tag);
      if (known) {
        if (!known.tables.includes(table)) known.tables.push(table);
        continue;
      }
      if (features.size >= MAX_FEATURES) continue;
      let label: string | null = null;
      if (LABELLED_FEATURE.test(tag)) {
        const feature = featureList + reader.u16(record + 4);
        const params = reader.u16(feature);
        if (params) label = nameText(font, reader.u16(feature + params + 2));
      }
      features.set(tag, { tag, tables: [table], label });
    }
  }
  return scripts;
}

function readFeatures(font: RawFont): Pick<FontDetails, 'features' | 'scripts'> {
  const features = new Map<string, FontFeature>();
  const scripts = new Set<string>();
  for (const table of ['GSUB', 'GPOS'] as const) {
    try {
      for (const script of readLayout(font, table, features)) scripts.add(script);
    } catch {
      // A malformed layout table only loses that table's feature list.
    }
  }
  return {
    features: [...features.values()].sort((a, b) => a.tag.localeCompare(b.tag)),
    scripts: [...scripts].sort(),
  };
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readVariations(font: RawFont): Pick<FontDetails, 'axes' | 'instances'> {
  const table = font.fvar;
  if (!table?.axis) return { axes: [], instances: [] };
  const axes: FontAxis[] = [];
  const tags: string[] = [];
  for (const axis of table.axis.slice(0, MAX_AXES)) {
    const tag = axis.axisTag.trim();
    const min = finite(axis.minValue);
    const def = finite(axis.defaultValue);
    const max = finite(axis.maxValue);
    if (tag === '' || min === null || def === null || max === null)
      return { axes: [], instances: [] };
    tags.push(tag);
    axes.push({ tag, name: text(axis.name) ?? tag, min, default: def, max });
  }
  const instances: FontInstance[] = [];
  for (const instance of (table.instance ?? []).slice(0, MAX_INSTANCES)) {
    const coordinates: Record<string, number> = {};
    tags.forEach((tag, index) => {
      const value = finite(instance.coord[index]);
      if (value !== null) coordinates[tag] = value;
    });
    instances.push({ name: text(instance.name) ?? '', coordinates });
  }
  return { axes, instances };
}

function readNames(font: RawFont): FontNames {
  const records = font.name?.records ?? {};
  const names = {} as FontNames;
  for (const key of Object.keys(NAME_FIELDS) as (keyof FontNames)[]) {
    names[key] = text(records[NAME_FIELDS[key]]);
  }
  return names;
}

const hex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');

function readPalettes(font: RawFont): FontPalettes | null {
  const cpal = font.CPAL;
  if (!cpal) return null;
  const entries = Math.min(cpal.numPaletteEntries, MAX_PALETTE_ENTRIES);
  const palettes: string[][] = [];
  for (const start of cpal.colorRecordIndices.slice(0, MAX_PALETTES)) {
    const colors: string[] = [];
    for (let i = 0; i < entries; i++) {
      const color = cpal.colorRecords[start + i];
      if (!color) break;
      const alpha = color.alpha === 255 ? '' : hex(color.alpha);
      colors.push(`#${hex(color.red)}${hex(color.green)}${hex(color.blue)}${alpha}`);
    }
    if (colors.length === entries) palettes.push(colors);
  }
  return palettes.length > 0 && entries > 0 ? { entries, palettes } : null;
}

function guarded<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function emptyFontDetails(): FontDetails {
  return {
    features: [],
    scripts: [],
    axes: [],
    instances: [],
    names: {
      copyright: null,
      version: null,
      designer: null,
      manufacturer: null,
      description: null,
      license: null,
      licenseUrl: null,
      vendorUrl: null,
      designerUrl: null,
    },
    colorFormats: [],
    palettes: null,
  };
}

export function readFontDetails(font: Font): FontDetails {
  const raw = font as unknown as RawFont;
  const empty = emptyFontDetails();
  return {
    ...guarded(() => readFeatures(raw), { features: empty.features, scripts: empty.scripts }),
    ...guarded(() => readVariations(raw), { axes: empty.axes, instances: empty.instances }),
    names: guarded(() => readNames(raw), empty.names),
    colorFormats: COLOR_TABLES.filter(([tag]) => raw.directory.tables[tag]).map(
      ([, label]) => label,
    ),
    palettes: guarded(() => readPalettes(raw), null),
  };
}
