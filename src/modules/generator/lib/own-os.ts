import type { OsId } from '@/modules/os-fonts';

interface Environment {
  userAgent: string;
  platform: string;
  uaPlatform?: string | undefined;
  maxTouchPoints?: number | undefined;
}

export function detectOs(env: Environment): OsId | undefined {
  const text = `${env.uaPlatform ?? ''} ${env.platform} ${env.userAgent}`.toLowerCase();
  if (/android/.test(text)) return 'android';
  if (/iphone|ipad|ipod/.test(text)) return 'ios';
  if (/macintosh|macintel|macos/.test(text)) return (env.maxTouchPoints ?? 0) > 1 ? 'ios' : 'macos';
  if (/cros|chrome os/.test(text)) return 'chromeos';
  if (/win/.test(text)) return 'windows';
  if (/linux|x11/.test(text)) return 'linux';
  return undefined;
}

export function ownOs(): OsId | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectOs({
    userAgent: nav.userAgent,
    platform: nav.platform,
    uaPlatform: nav.userAgentData?.platform,
    maxTouchPoints: nav.maxTouchPoints,
  });
}
