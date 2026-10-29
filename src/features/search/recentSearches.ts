/**
 * The last ten searches, stored per seller on the device and cleared on sign-out with the rest of
 * the user's storage. Only searches the seller acted on (opened a result) are remembered.
 */
import { rememberSearch } from '@tradevistar/seller-api';
import { readJson, userStorage, UserKeys, writeJson } from '@/core/storage/kv';

export function loadRecentSearches(): string[] {
  const stored = readJson<unknown>(userStorage, UserKeys.recentSearches);
  return Array.isArray(stored)
    ? stored.filter((item): item is string => typeof item === 'string')
    : [];
}

export function addRecentSearch(term: string): string[] {
  const next = rememberSearch(loadRecentSearches(), term);
  writeJson(userStorage, UserKeys.recentSearches, next);
  return next;
}

export function clearRecentSearches(): void {
  userStorage.remove(UserKeys.recentSearches);
}
