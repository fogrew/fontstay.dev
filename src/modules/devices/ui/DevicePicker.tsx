import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Select } from '@/common/ui';
import { DEVICE_GROUPS, type Device, type DeviceGroup, loadDevices } from '../lib/devices';

const RESPONSIVE = 'responsive';

export function DevicePicker({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: Device | undefined;
  onChange: (device: Device | undefined) => void;
}) {
  const t = messagesFor(locale);
  const [devices, setDevices] = useState<readonly Device[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadDevices()
      .then((list) => {
        if (!cancelled) setDevices(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const groupLabels: Record<DeviceGroup, string> = {
    phone: t.device_group_phone(),
    foldable: t.device_group_foldable(),
    tablet: t.device_group_tablet(),
    desktop: t.device_group_desktop(),
  };
  const options = [
    { value: RESPONSIVE, label: t.device_responsive() },
    ...DEVICE_GROUPS.flatMap((group) =>
      devices
        .filter((device) => device.group === group)
        .map((device) => ({
          value: device.id,
          label: `${device.name} (${device.width}px)`,
          group: groupLabels[group],
        })),
    ),
  ];
  const selected = value && devices.some((device) => device.id === value.id) ? value : undefined;
  return (
    <Select
      compact
      hideLabel
      label={t.device_label()}
      value={selected?.id ?? RESPONSIVE}
      options={options}
      onChange={(next) => onChange(devices.find((device) => device.id === next))}
    />
  );
}
