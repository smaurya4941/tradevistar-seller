/**
 * Notices the seller has put away. Kept in memory for the life of the app process, like the web's
 * session storage: closing the app and opening it again shows a still-running notice again, which
 * is what an announcement asks for. A live maintenance is never dismissible (see `isDismissible`).
 */
import { createStore, useStore } from '@/core/store';

const dismissedStore = createStore<readonly string[]>([]);

export function dismissNotice(id: string): void {
  dismissedStore.set(ids => (ids.includes(id) ? ids : [...ids, id]));
}

export function useDismissedNotices(): readonly string[] {
  return useStore(dismissedStore);
}

/** For tests. */
export function resetDismissedNotices(): void {
  dismissedStore.set([]);
}
