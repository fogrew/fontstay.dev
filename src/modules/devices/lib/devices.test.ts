import { describe, expect, it } from 'vitest';
import { buildDevices, DEVICE_GROUPS, loadDevices, MIN_DEVICE_WIDTH } from './devices';

describe('devices', () => {
  it('has every group populated', async () => {
    const devices = await loadDevices();
    for (const group of DEVICE_GROUPS) {
      expect(devices.some((device) => device.group === group)).toBe(true);
    }
  });

  it('has unique ids and usable sizes', async () => {
    const devices = await loadDevices();
    expect(new Set(devices.map((device) => device.id)).size).toBe(devices.length);
    for (const device of devices) {
      expect(device.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(device.width).toBeGreaterThanOrEqual(MIN_DEVICE_WIDTH);
      expect(device.width).toBeLessThanOrEqual(4096);
      expect(device.height).toBeGreaterThan(0);
      expect(device.scale).toBeGreaterThan(0);
    }
    expect(devices.find((device) => device.id === 'iphone-se')?.width).toBe(375);
  });

  it('orders by group, drops unknown groups and devices narrower than the preview minimum', () => {
    const list = (group: string, width: number, name: string) => ({
      name,
      group,
      width,
      height: 800,
      scale: 2,
    });
    expect(
      buildDevices({
        devices: [
          list('tablet', 768, 'Tab'),
          list('phone', 375, 'Phone One'),
          list('phone', 240, 'Tiny'),
          list('watch', 400, 'Watch'),
        ],
      }).map((device) => device.id),
    ).toEqual(['phone-one', 'tab']);
  });
});
