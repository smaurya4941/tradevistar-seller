import { deviceStorage, DeviceKeys } from '@/core/storage/kv';
import {
  parseThemePreference,
  resolveScheme,
  setThemePreference,
  themeStore,
} from '../themeStore';

describe('theme preference', () => {
  it('defaults to light, so nothing changes until the toggle exists', () => {
    expect(parseThemePreference(undefined)).toBe('light');
    expect(parseThemePreference('purple')).toBe('light');
    expect(themeStore.get()).toBe('light');
  });

  it('accepts the three real values', () => {
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
  });

  it('is saved on the device', () => {
    setThemePreference('dark');
    expect(themeStore.get()).toBe('dark');
    expect(deviceStorage.getString(DeviceKeys.theme)).toBe('dark');
    setThemePreference('light');
  });

  it('follows the phone only for "system"', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});
