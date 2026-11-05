export const DEVICE_GROUPS = ['phone', 'foldable', 'tablet', 'desktop'] as const;

export type DeviceGroup = (typeof DEVICE_GROUPS)[number];

export interface Device {
  id: string;
  name: string;
  group: DeviceGroup;
  width: number;
  height: number;
  scale: number;
}

export interface DeviceData {
  devices: readonly { name: string; group: string; width: number; height: number; scale: number }[];
}

export const MIN_DEVICE_WIDTH = 320;

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function buildDevices(data: DeviceData): Device[] {
  return DEVICE_GROUPS.flatMap((group) =>
    data.devices
      .filter((device) => device.group === group && device.width >= MIN_DEVICE_WIDTH)
      .map((device) => ({ ...device, group, id: slug(device.name) })),
  );
}

let cache: Promise<readonly Device[]> | undefined;

export function loadDevices(): Promise<readonly Device[]> {
  cache ??= import('../data/devices.json')
    .then((module) => buildDevices(module.default))
    .catch((failure) => {
      cache = undefined;
      throw failure;
    });
  return cache;
}
