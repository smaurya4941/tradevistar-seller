/**
 * App and device identity: the version for the force-update check, and a descriptive User-Agent
 * so the seller's Security tab shows "TradeVistarSeller/1.0.0 (Android 14; Pixel 7)" rather than
 * "okhttp/4.12".
 */
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export const appVersion: string = DeviceInfo.getVersion();
export const buildNumber: string = DeviceInfo.getBuildNumber();
export const bundleId: string = DeviceInfo.getBundleId();

export const platformKey: 'android' | 'ios' =
  Platform.OS === 'ios' ? 'ios' : 'android';

function osLabel(): string {
  const name = Platform.OS === 'ios' ? 'iOS' : 'Android';
  return `${name} ${DeviceInfo.getSystemVersion()}`;
}

/** e.g. "Samsung SM-S918B"; the brand is dropped when the model already starts with it. */
export function deviceLabel(): string {
  const brand = DeviceInfo.getBrand();
  const model = DeviceInfo.getModel();
  if (!brand || model.toLowerCase().startsWith(brand.toLowerCase()))
    return model;
  return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} ${model}`;
}

export function userAgent(): string {
  return `TradeVistarSeller/${appVersion} (${osLabel()}; ${deviceLabel()}) build/${buildNumber}`;
}

export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-IN';
  } catch {
    return 'en-IN';
  }
}
