/**
 * The team-invitation token held between opening the link and accepting it.
 *
 * Memory only: a seller who is not signed in yet signs in first, and the token is then used. It
 * goes with the app process (or with sign-out), so a stale invitation is never replayed later.
 * The 7-day cap the spec allows for a persisted token is moot because nothing is persisted.
 */
import { createStore, useStore } from '@/core/store';

export const pendingInvitationStore = createStore<string | null>(null);

export function holdInvitationToken(token: string): void {
  pendingInvitationStore.set(token);
}

export function clearInvitationToken(): void {
  pendingInvitationStore.set(null);
}

export function usePendingInvitation(): string | null {
  return useStore(pendingInvitationStore);
}
