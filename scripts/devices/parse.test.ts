import { describe, expect, it } from 'vitest';
import { parseEmulatedDevices } from './parse.ts';

const source = `
const UIStrings = {
  /** @description Laptop */
  laptop: 'Laptop with touch',
};
const emulatedDevices = [
  // DEVICE-LIST-BEGIN
  {
    'order': 10,
    'title': 'Phone A',
    'screen': {
      'horizontal': {'width': 667, 'height': 375},
      'device-pixel-ratio': 2,
      'vertical': {'width': 375, 'height': 667},
    },
    'type': 'phone',
  },
  {
    'title': 'Folder',
    'foldable-screen': true,
    'screen': {
      'horizontal': {'width': 900, 'height': 400},
      'device-pixel-ratio': 2.5,
      'vertical': {'width': 400, 'height': 900},
      'vertical-spanned': {'width': 800, 'height': 840, 'hinge': {'width': 0}},
    },
    'type': 'phone',
  },
  {
    'title': i18nLazyString(UIStrings.laptop),
    'screen': {
      'horizontal': {'width': 1280, 'height': 950},
      'device-pixel-ratio': 1,
      'vertical': {'width': 950, 'height': 1280},
    },
    'type': 'notebook',
  },
] as const;
`;

describe('parseEmulatedDevices', () => {
  it('groups devices, resolves UI strings and adds the unfolded size', () => {
    expect(parseEmulatedDevices(source)).toEqual([
      { name: 'Phone A', group: 'phone', width: 375, height: 667, scale: 2 },
      { name: 'Folder', group: 'foldable', width: 400, height: 900, scale: 2.5 },
      { name: 'Folder (unfolded)', group: 'foldable', width: 800, height: 840, scale: 2.5 },
      { name: 'Laptop with touch', group: 'desktop', width: 1280, height: 950, scale: 1 },
    ]);
  });

  it('rejects code it cannot read as plain data', () => {
    const evil = source.replace("'order': 10", "'order': process.exit(1)");
    expect(() => parseEmulatedDevices(evil)).toThrow(/Unsupported expression/);
  });

  it('rejects an unknown device type', () => {
    expect(() => parseEmulatedDevices(source.replace("'notebook'", "'watch'"))).toThrow(
      /Unknown device type/,
    );
  });

  it('fails when the list is missing', () => {
    expect(() => parseEmulatedDevices('const x = 1;')).toThrow(/not found/);
  });
});
