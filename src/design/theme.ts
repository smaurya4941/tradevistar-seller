/**
 * Theme-aware access to the tokens. Screens that read colors through `useThemeColors()` follow the
 * seller's theme preference (and the phone's appearance for "system"); the static `colors` export
 * stays the light theme for styles that are fixed at import time.
 */
import { useColorScheme } from 'react-native';
import {
  resolveScheme,
  useThemePreference,
} from '@/core/preferences/themeStore';
import {
  darkColors,
  darkTones,
  lightColors,
  tones,
  type ColorTokens,
  type Tone,
  type ToneColors,
} from './tokens';

export function useColorSchemeName(): 'light' | 'dark' {
  const preference = useThemePreference();
  const system = useColorScheme();
  return resolveScheme(preference, system);
}

export function useThemeColors(): ColorTokens {
  return useColorSchemeName() === 'dark' ? darkColors : lightColors;
}

export function useToneColors(tone: Tone): ToneColors {
  return useColorSchemeName() === 'dark' ? darkTones[tone] : tones[tone];
}
