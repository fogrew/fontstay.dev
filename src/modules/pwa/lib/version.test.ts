import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  headingVersion,
  hiddenSections,
  parseVersion,
  startupNotice,
} from './version';

describe('versions', () => {
  it('parses and compares semantic versions', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2')).toBeNull();
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.0', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('x', '1.0.0')).toBe(0);
  });
});

describe('startupNotice', () => {
  it('reports an update only when the version moved forward', () => {
    expect(startupNotice('1.0.0', '1.2.0')).toEqual({
      kind: 'updated',
      from: '1.0.0',
      to: '1.2.0',
    });
    expect(startupNotice('1.2.0', '1.2.0')).toEqual({ kind: 'none' });
    expect(startupNotice('2.0.0', '1.2.0')).toEqual({ kind: 'none' });
  });

  it('stays quiet on the first visit and on garbage', () => {
    expect(startupNotice(null, '1.0.0')).toEqual({ kind: 'none' });
    expect(startupNotice('junk', '1.0.0')).toEqual({ kind: 'none' });
  });
});

describe('changelog sections', () => {
  const headings = [
    '[Unreleased]',
    '[1.2.0] - 2027-01-01',
    '[1.1.0] - 2026-12-01',
    '[1.0.0] - 2026-11-01',
  ];

  it('reads the version of a heading', () => {
    expect(headingVersion('[1.2.0] - 2027-01-01')).toBe('1.2.0');
    expect(headingVersion('[Unreleased]')).toBeNull();
  });

  it('hides the versions up to the last one the user had', () => {
    expect(hiddenSections(headings, '1.1.0')).toEqual([false, false, true, true]);
    expect(hiddenSections(headings, '0.0.0')).toEqual([false, false, false, false]);
    expect(hiddenSections(headings, '9.0.0')).toEqual([false, true, true, true]);
  });
});
