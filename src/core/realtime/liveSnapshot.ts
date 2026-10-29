/**
 * The one query behind every badge: `GET /notifications/live`, the snapshot the web polls. It is
 * refreshed by:
 * - the socket (`notification:changed` invalidates the notifications family);
 * - the app returning to the foreground (React Query's focus manager);
 * - any read, unread or mark-all action (same family);
 * - a fallback poll, paced by `snapshotPollInterval`.
 *
 * Components read slices with `select`, so a change in one badge does not re-render a component
 * that shows another. Sign-out clears the cache, which drops every badge with it.
 */
import { useQuery } from '@tanstack/react-query';
import {
  badgeCounts,
  getNotificationSnapshot,
  type BadgeKey,
  type NotificationSnapshot,
} from '@tradevistar/seller-api';
import { useSession } from '@/core/auth/SessionProvider';
import { queryKeys } from '@/core/query/queryClient';
import { focusedRouteStore, isLiveScreen } from './focusedRoute';
import { isNotificationSocketConnected } from './notificationSocket';
import { snapshotPollInterval } from './pollInterval';

/** The signed-in seller's id while the snapshot should run, else null (signed out, or offline). */
export function useSnapshotScope(): string | null {
  const session = useSession();
  return session.status === 'signedIn' ? session.user.id : null;
}

export function useLiveSnapshot<T = NotificationSnapshot>(
  select?: (snapshot: NotificationSnapshot) => T,
): T | undefined {
  const scope = useSnapshotScope();
  const query = useQuery({
    queryKey: [...queryKeys.notificationSnapshot, scope ?? 'anon'],
    queryFn: ({ signal }) => getNotificationSnapshot(signal),
    enabled: scope !== null,
    staleTime: 15_000,
    refetchInterval: () =>
      snapshotPollInterval({
        socketConnected: isNotificationSocketConnected(),
        liveScreenVisible: isLiveScreen(focusedRouteStore.get()),
      }),
    refetchIntervalInBackground: false,
    select: select as (snapshot: NotificationSnapshot) => T,
  });
  return scope === null ? undefined : query.data;
}

/** One navigation badge: the number, re-rendering only when that number changes. */
export function useBadge(key: BadgeKey): number {
  return useLiveSnapshot(snapshot => badgeCounts(snapshot)[key]) ?? 0;
}

/** True when any of the given badges is above zero (the More tab's dot). */
export function useAnyBadge(keys: readonly BadgeKey[]): boolean {
  return (
    useLiveSnapshot(snapshot => {
      const counts = badgeCounts(snapshot);
      return keys.some(key => counts[key] > 0);
    }) ?? false
  );
}
