/**
 * The conversation on screen right now, if any. The chat screen (Phase 6) sets it while it is
 * focused and the app is in the foreground; the alert code reads it so a message for that thread
 * is not announced while the seller is already reading it.
 */
import { createStore } from '@/core/store';

export const visibleThreadStore = createStore<string | null>(null);

export function setVisibleThread(conversationId: string | null): void {
  if (visibleThreadStore.get() !== conversationId) {
    visibleThreadStore.set(conversationId);
  }
}
