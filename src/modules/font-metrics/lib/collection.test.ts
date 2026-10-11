import { describe, expect, it } from 'vitest';
import {
  collectionMemberIndices,
  collectionSize,
  extractCollectionMember,
  isFontCollection,
  MAX_COLLECTION_MEMBERS,
} from './collection';
import { buildCollection, buildFont } from './forged.test-util';
import { FontParseError } from './model';
import { parseFontBuffer } from './parse';

const latin = buildFont([[0x41, 0x43, 1]]);
const cyrillic = buildFont([[0x410, 0x412, 1]]);

describe('font collections', () => {
  const collection = buildCollection([latin, cyrillic]);

  it('are detected and counted', () => {
    expect(isFontCollection(collection)).toBe(true);
    expect(isFontCollection(latin)).toBe(false);
    expect(collectionSize(collection)).toBe(2);
  });

  it('extract each member as a standalone font the parser accepts', () => {
    const first = parseFontBuffer(extractCollectionMember(collection, 0));
    const second = parseFontBuffer(extractCollectionMember(collection, 1));
    expect([...first.codePoints]).toEqual([0x41, 0x42, 0x43]);
    expect([...second.codePoints]).toEqual([0x410, 0x411, 0x412]);
  });

  it('reject a member index outside the collection', () => {
    expect(() => extractCollectionMember(collection, 2)).toThrow(FontParseError);
    expect(() => extractCollectionMember(collection, -1)).toThrow(FontParseError);
  });

  it('list each distinct member once', () => {
    expect(collectionMemberIndices(collection)).toEqual([0, 1]);
    const repeated = collection.slice(0);
    const data = new DataView(repeated);
    data.setUint32(16, data.getUint32(12));
    expect(collectionMemberIndices(repeated)).toEqual([0]);
  });

  it('reject a member that is not an sfnt font', () => {
    const copy = collection.slice(0);
    const data = new DataView(copy);
    data.setUint32(data.getUint32(12), 0x74746366);
    expect(() => extractCollectionMember(copy, 0)).toThrow(FontParseError);
  });

  it('reject hostile headers', () => {
    const view = (source: ArrayBuffer) => {
      const copy = source.slice(0);
      return { copy, data: new DataView(copy) };
    };
    const huge = view(collection);
    huge.data.setUint32(8, MAX_COLLECTION_MEMBERS + 1);
    expect(() => collectionSize(huge.copy)).toThrow(FontParseError);

    const zero = view(collection);
    zero.data.setUint32(8, 0);
    expect(() => collectionSize(zero.copy)).toThrow(FontParseError);

    const outside = view(collection);
    outside.data.setUint32(12, outside.copy.byteLength);
    expect(() => extractCollectionMember(outside.copy, 0)).toThrow(FontParseError);

    const table = view(collection);
    const start = table.data.getUint32(12);
    table.data.setUint32(start + 12 + 12, 0x7fffffff);
    expect(() => extractCollectionMember(table.copy, 0)).toThrow(FontParseError);

    expect(() => collectionSize(latin)).toThrow(FontParseError);
  });
});
