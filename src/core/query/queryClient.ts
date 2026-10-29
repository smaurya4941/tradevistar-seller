/**
 * Server-state cache. Retries skip errors a retry cannot fix (4xx), and connectivity and focus
 * are wired to React Native's NetInfo and AppState instead of browser events.
 *
 * The web portal broadcasts a `portal:refresh` event after a successful write so every open list
 * refetches. The mobile equivalent is here: after any successful mutation, active queries are
 * invalidated once, 250 ms after the last success (a burst of writes costs one refetch round).
 */
import { ApiError, onSellerEvent } from '@tradevistar/seller-api';
import {
  focusManager,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { isConnected } from '@/core/network/connectivity';
import NetInfo from '@react-native-community/netinfo';

export const MUTATION_INVALIDATE_DEBOUNCE_MS = 250;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (
          error instanceof ApiError &&
          error.statusCode >= 400 &&
          error.statusCode < 500
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

export const queryKeys = {
  /** Whether the seller is verified or view-only (GET /me/access). */
  access: ['profile', 'access'] as const,
  appConfig: ['app-config'] as const,
  health: ['health'] as const,
  session: ['session'] as const,
  /** Platform notices (GET /platform/notices?audience=seller). */
  siteNotices: ['site-notices'] as const,
  /** The notification family: counts, lists and the live snapshot behind every badge. */
  notifications: ['notifications'] as const,
  /** GET /notifications/live; inside the notifications family so one invalidation moves everything. */
  notificationSnapshot: ['notifications', 'live'] as const,
  notificationPreferences: ['notification-preferences'] as const,
  communicationPreferences: ['communication-preferences'] as const,
  /** Home and Analytics: every card reads from a key inside this family. */
  dashboard: ['dashboard'] as const,
  /** Tickets, their counts and threads; FAQs and announcements live under it too. */
  support: ['support'] as const,
  /** Conversations and open threads (Phase 6 fills this in). */
  conversations: ['conversations'] as const,
  footer: ['footer'] as const,
  /** Profile, company, KYC and GST, bank, team, calendar and security (Phase 3). */
  company: ['company'] as const,
};

/**
 * Something the seller's data may have changed under the app (a socket event, a push): the cards
 * and lists that mirror it are marked stale, and the ones on screen refetch.
 */
export function invalidatePortalData(client: QueryClient = queryClient): void {
  for (const key of [queryKeys.dashboard, queryKeys.support]) {
    void client.invalidateQueries({ queryKey: key });
  }
}

/** The conversation list and open threads are stale (a message arrived or a thread was read elsewhere). */
export function invalidateChats(client: QueryClient = queryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.conversations });
}

let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Marks every active query stale, once, shortly after the last call. Called after each successful
 * mutation; screens that are not on show refetch when they next mount.
 */
export function scheduleActiveInvalidation(
  client: QueryClient = queryClient,
): void {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    invalidateTimer = null;
    void client.invalidateQueries({ refetchType: 'active' });
  }, MUTATION_INVALIDATE_DEBOUNCE_MS);
}

/** Test-only: drops a pending invalidation. */
export function cancelScheduledInvalidation(): void {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = null;
}

/** Subscribes the debounced invalidation to successful mutations of `client`. */
export function watchMutations(client: QueryClient = queryClient): () => void {
  return client.getMutationCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'success') {
      scheduleActiveInvalidation(client);
    }
  });
}

let wired = false;

/** Connects React Query to the device's network and foreground state. Idempotent. */
export function wireQueryLifecycle(): void {
  if (wired) return;
  wired = true;
  onlineManager.setEventListener(setOnline =>
    NetInfo.addEventListener(state => {
      setOnline(isConnected(state));
    }),
  );
  focusManager.setEventListener(handleFocus => {
    const subscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => handleFocus(status === 'active'),
    );
    return () => subscription.remove();
  });
  watchMutations();
  // A refused write means the banner should already be showing: re-read now, not at the next poll.
  onSellerEvent('access:verification-required', () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.access });
  });
  // A maintenance window just refused a write: the notice that explains it should be on screen now.
  onSellerEvent('notices:maintenance-paused', () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.siteNotices });
  });
}
