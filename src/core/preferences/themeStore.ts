/**
 * The theme the seller chose: follow the phone, or force light or dark. Kept on this device (the
 * API has no field for it). The default is light until the toggle ships, so nothing changes for
 * anyone by accident.
 */
import { deviceStorage, DeviceKeys } from '@/core/storage/kv';
import { createStore, useStore } from '@/core/store';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'system',
  'light',
  'dark',
];

export function parseThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : 'light';
}

function storedTheme(): ThemePreference {
  try {
    return parseThemePreference(deviceStorage.getString(DeviceKeys.theme));
  } catch {
    return 'light';
  }
}

export const themeStore = createStore<ThemePreference>(storedTheme());

export function setThemePreference(next: ThemePreference): void {
  deviceStorage.set(DeviceKeys.theme, next);
  themeStore.set(next);
}

export function useThemePreference(): ThemePreference {
  return useStore(themeStore);
}

/** The concrete scheme for a preference and the phone's current appearance. */
export function resolveScheme(
  preference: ThemePreference,
  system: 'light' | 'dark' | null | undefined,
): 'light' | 'dark' {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}
