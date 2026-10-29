/**
 * Server state for the notification centre and its filters.
 *
 * Every read, unread and "mark all read" invalidates the whole `notifications` family, so the
 * list, the category counts, the live snapshot behind every badge and the launcher number all move
 * together. Rows flip straight away (optimistic) and are rolled back when the server refuses.
 *
 * The first page of the unfiltered list is kept on the device, so the Inbox opens offline.
 */
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  getNotificationCounts,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPage,
  type SellerNotification,
} from '@tradevistar/seller-api';
import { useMemo } from 'react';
import { useSession } from '@/core/auth/SessionProvider';
import { readStored, writeStored } from '@/core/query/persistedQuery';
import { queryClient, queryKeys } from '@/core/query/queryClient';

export const PAGE_SIZE = 25;

export type NotificationTab = 'all' | NotificationCategory;

export const NOTIFICATION_TABS: readonly NotificationTab[] = [
  'all',
  ...NOTIFICATION_CATEGORIES,
];

export function isNotificationTab(value: unknown): value is NotificationTab {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_TABS as readonly string[]).includes(value)
  );
}

const keys = {
  counts: [...queryKeys.notifications, 'counts'] as const,
  list: (tab: NotificationTab, unread: boolean) =>
    [...queryKeys.notifications, 'list', tab, unread] as const,
  allLists: [...queryKeys.notifications, 'list'] as const,
};

const FIRST_PAGE = 'notifications.firstPage';

function useScope(): string | null {
  const session = useSession();
  return session.status === 'signedIn' || session.status === 'offline'
    ? session.user?.id ?? null
    : null;
}

export function useNotificationCounts() {
  const scope = useScope();
  return useQuery({
    queryKey: [...keys.counts, scope],
    queryFn: ({ signal }) => getNotificationCounts(signal),
    enabled: scope !== null,
    staleTime: 10_000,
  });
}

export function useNotificationList(tab: NotificationTab, unreadOnly: boolean) {
  const scope = useScope();
  // Only the unfiltered first page is worth keeping for offline reading.
  const cacheable = tab === 'all' && !unreadOnly;
  const stored = cacheable
    ? readStored<NotificationPage>(FIRST_PAGE)
    : undefined;
  const result = useInfiniteQuery({
    queryKey: [...keys.list(tab, unreadOnly), scope],
    queryFn: async ({ pageParam, signal }) => {
      const page = await listNotifications(
        {
          category: tab === 'all' ? undefined : tab,
          unread: unreadOnly || undefined,
          page: pageParam,
          limit: PAGE_SIZE,
        },
        signal,
      );
      if (cacheable && pageParam === 1) writeStored(FIRST_PAGE, page);
      return page;
    },
    initialPageParam: 1,
    getNextPageParam: last =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: scope !== null,
    staleTime: 10_000,
    ...(stored
      ? {
          initialData: { pages: [stored.data], pageParams: [1] },
          initialDataUpdatedAt: stored.at,
        }
      : {}),
  });
  const items = useMemo(() => {
    // A page boundary can repeat a row when new ones arrive between pages.
    const seen = new Set<string>();
    return (result.data?.pages ?? [])
      .flatMap(page => page.items)
      .filter(item => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  }, [result.data]);
  return { ...result, items };
}

type ListSnapshot = [
  readonly unknown[],
  InfiniteData<NotificationPage> | undefined,
][];

/** Flips one row's read flag in every loaded list, before the server answers. */
function setReadLocally(id: string, read: boolean): ListSnapshot {
  const previous = queryClient.getQueriesData<InfiniteData<NotificationPage>>({
    queryKey: keys.allLists,
  });
  queryClient.setQueriesData<InfiniteData<NotificationPage>>(
    { queryKey: keys.allLists },
    data =>
      data
        ? {
            ...data,
            pages: data.pages.map(page => ({
              ...page,
              items: page.items.map(item =>
                item.id === id ? { ...item, read } : item,
              ),
            })),
          }
        : data,
  );
  return previous;
}

function rollback(previous: ListSnapshot): void {
  for (const [key, data] of previous) queryClient.setQueryData(key, data);
}

function refreshAll(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
}

async function setRead(
  notification: SellerNotification,
  read: boolean,
): Promise<void> {
  if (notification.read === read) return;
  const previous = setReadLocally(notification.id, read);
  try {
    await (read
      ? markNotificationRead(notification.id)
      : markNotificationUnread(notification.id));
  } catch (error) {
    rollback(previous);
    throw error;
  } finally {
    refreshAll();
  }
}

export const markRead = (notification: SellerNotification) =>
  setRead(notification, true);

export const markUnread = (notification: SellerNotification) =>
  setRead(notification, false);

/** Clears the tab in view only, so "Mark all read" on Orders leaves quotes and messages alone. */
export async function markAllRead(tab: NotificationTab): Promise<void> {
  try {
    await markAllNotificationsRead(tab === 'all' ? undefined : tab);
  } finally {
    refreshAll();
  }
}
