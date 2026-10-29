/**
 * Keeps the last good answer of a query on the device, so a screen opened offline shows what was
 * there with an "Updated <time>" label instead of an empty error. Writes while offline are never
 * queued; this is for reading only.
 *
 * A stored answer seeds the query (`initialData`) with its original time, so React Query still
 * treats it as stale and refetches the moment the network is back. Storage is the user instance
 * (cleared on sign-out) unless the data is public, which passes `deviceStorage`.
 */
import type { MMKV } from 'react-native-mmkv';
import { logger } from '@/core/logger';
import { readJson, userStorage, UserKeys, writeJson } from '@/core/storage/kv';

interface Stored<T> {
  at: number;
  data: T;
}

export function storedKey(name: string): string {
  return `${UserKeys.queryCachePrefix}${name}`;
}

export function readStored<T>(
  name: string,
  storage: MMKV = userStorage,
): Stored<T> | undefined {
  try {
    const stored = readJson<Stored<T>>(storage, storedKey(name));
    return stored && typeof stored.at === 'number' ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function writeStored<T>(
  name: string,
  data: T,
  storage: MMKV = userStorage,
): void {
  try {
    writeJson(storage, storedKey(name), { at: Date.now(), data });
  } catch (error) {
    // A full or unavailable disk only costs the offline copy.
    logger.info('[cache] could not store an answer', error);
  }
}

/** The time a query's answer was fetched (or stored), for "Updated 5 min ago". */
export function updatedAtOf(
  dataUpdatedAt: number,
  name: string,
  storage: MMKV = userStorage,
): number | null {
  if (dataUpdatedAt > 0) return dataUpdatedAt;
  return readStored(name, storage)?.at ?? null;
}

/**
 * Query options that store each successful answer under `name` and seed the query from the
 * stored one: spread them into `useQuery({ queryKey, ...withStoredAnswer(name, fetcher) })`.
 */
export function withStoredAnswer<T>(
  name: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  storage: MMKV = userStorage,
  /** A stored answer older than this is ignored (public pages keep a day, say). */
  maxAgeMs?: number,
): {
  queryFn: (context: { signal: AbortSignal }) => Promise<T>;
  initialData?: T;
  initialDataUpdatedAt?: number;
} {
  const found = readStored<T>(name, storage);
  const stored =
    found && maxAgeMs !== undefined && Date.now() - found.at > maxAgeMs
      ? undefined
      : found;
  return {
    queryFn: async ({ signal }) => {
      const data = await fetcher(signal);
      writeStored(name, data, storage);
      return data;
    },
    ...(stored
      ? { initialData: stored.data, initialDataUpdatedAt: stored.at }
      : {}),
  };
}
