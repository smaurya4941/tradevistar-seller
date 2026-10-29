/**
 * The seller's display preferences: interface language and theme, kept on this device. The web
 * portal keeps these in the browser only and the API has no field for them, so the app does the
 * same.
 */
import React, { createContext, useContext, useMemo } from 'react';
import {
  setLanguage as setStoredLanguage,
  useLanguage,
  useT,
  type Language,
  type Translate,
} from '@/i18n';
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from './themeStore';

interface PreferencesValue {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  t: Translate;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const language = useLanguage();
  const theme = useThemePreference();
  const t = useT();

  const value = useMemo<PreferencesValue>(
    () => ({
      language,
      setLanguage: setStoredLanguage,
      theme,
      setTheme: setThemePreference,
      t,
    }),
    [language, theme, t],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>');
  }
  return value;
}
