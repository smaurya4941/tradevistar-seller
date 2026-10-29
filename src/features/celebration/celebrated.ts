/**
 * The celebrations this device has already played, so each plays once and never again — not after
 * a restart, a sign-out or a reopened app. Saved on the device, not per account, like the web's
 * per-browser memory. The last few are kept.
 */
import { rememberCelebrated } from '@tradevistar/seller-api';
import { createStore, useStore } from '@/core/store';
import {
  deviceStorage,
  DeviceKeys,
  readJson,
  writeJson,
} from '@/core/storage/kv';

function load(): readonly string[] {
  try {
    const saved = readJson<unknown>(
      deviceStorage,
      DeviceKeys.celebratedNotices,
    );
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

const celebratedStore = createStore<readonly string[]>(load());

/** Marked as a celebration starts, so reopening the app mid-celebration does not replay it. */
export function markCelebrated(id: string): void {
  const next = rememberCelebrated(celebratedStore.get(), id);
  celebratedStore.set(next);
  try {
    writeJson(deviceStorage, DeviceKeys.celebratedNotices, next);
  } catch {
    // Without the saved copy it may play again after a restart; not worth interrupting for.
  }
}

export function useCelebrated(): readonly string[] {
  return useStore(celebratedStore);
}

/** For tests. */
export function resetCelebrated(): void {
  celebratedStore.set([]);
  try {
    deviceStorage.remove(DeviceKeys.celebratedNotices);
  } catch {
    // Nothing to clear.
  }
}
