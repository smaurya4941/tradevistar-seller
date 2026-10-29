/**
 * Interface text. Every string the user can see goes through `t`, so adding a language later is a
 * second message object, not a rewrite. `{name}` placeholders are filled by `t`.
 *
 * The language lives in a small store rather than only in React state, so code outside
 * components (toasts from services, the error mapper) translates too, and every screen that
 * uses `useT()` re-renders the moment the language changes — no restart.
 */
import { useCallback } from 'react';
import { createStore, useStore } from '@/core/store';
import { deviceStorage, DeviceKeys } from '@/core/storage/kv';
import { appMessages, type AppMessageKey, type Language } from './appMessages';

export type { Language, AppMessageKey };
export type TranslationKey = AppMessageKey;
export type TranslationValues = Record<string, string | number>;
export type Translate = (
  key: TranslationKey,
  values?: TranslationValues,
) => string;

export const LANGUAGES: {
  value: Language;
  label: string;
  englishName: string;
}[] = [{ value: 'en', label: 'English', englishName: 'English' }];

function storedLanguage(): Language {
  try {
    const value = deviceStorage.getString(DeviceKeys.language);
    return LANGUAGES.some(language => language.value === value)
      ? (value as Language)
      : 'en';
  } catch {
    return 'en';
  }
}

export const languageStore = createStore<Language>(storedLanguage());

export function setLanguage(next: Language): void {
  deviceStorage.set(DeviceKeys.language, next);
  languageStore.set(next);
}

export function getLanguage(): Language {
  return languageStore.get();
}

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] !== undefined ? String(values[name]) : match,
  );
}

export function translate(
  language: Language,
  key: TranslationKey,
  values?: TranslationValues,
): string {
  const template = appMessages[language]?.[key] ?? appMessages.en[key] ?? key;
  return interpolate(template, values);
}

/** Translates in the current language; for code outside components. */
export const t: Translate = (key, values) =>
  translate(languageStore.get(), key, values);

/** A `t` bound to the current language; re-renders when the language changes. */
export function useT(): Translate {
  const language = useStore(languageStore);
  return useCallback(
    (key: TranslationKey, values?: TranslationValues) =>
      translate(language, key, values),
    [language],
  );
}

export function useLanguage(): Language {
  return useStore(languageStore);
}
