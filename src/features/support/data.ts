/**
 * Server state for support. Everything under the `support` query family refreshes together when
 * the socket reports a change (a support reply creates a notification). The ticket list's first
 * page, the FAQs, the announcements and the categories are kept on the device for offline reading.
 */
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  getTicket,
  getTicketCounts,
  listAnnouncements,
  listFaqs,
  listSupportCategories,
  listTickets,
  TICKET_PAGE_SIZE,
  type Page,
  type SupportTicket,
  type TicketStatus,
} from '@tradevistar/seller-api';
import { useMemo } from 'react';
import { useSession } from '@/core/auth/SessionProvider';
import {
  readStored,
  withStoredAnswer,
  writeStored,
} from '@/core/query/persistedQuery';
import { queryClient, queryKeys } from '@/core/query/queryClient';
import { deviceStorage } from '@/core/storage/kv';

function useScope(): string | null {
  const session = useSession();
  return session.status === 'signedIn' || session.status === 'offline'
    ? session.user?.id ?? null
    : null;
}

export const supportKeys = {
  counts: [...queryKeys.support, 'counts'] as const,
  list: (status: TicketStatus | undefined, q: string) =>
    [...queryKeys.support, 'list', status ?? 'all', q] as const,
  allLists: [...queryKeys.support, 'list'] as const,
  ticket: (id: string) => [...queryKeys.support, 'ticket', id] as const,
  categories: [...queryKeys.support, 'categories'] as const,
  faqs: [...queryKeys.support, 'faqs'] as const,
  announcements: [...queryKeys.support, 'announcements'] as const,
};

const FIRST_PAGE = 'support.tickets.firstPage';

export function useTicketCounts() {
  const scope = useScope();
  return useQuery({
    queryKey: [...supportKeys.counts, scope],
    queryFn: ({ signal }) => getTicketCounts(signal),
    enabled: scope !== null,
    staleTime: 15_000,
  });
}

export function useTicketList(status: TicketStatus | undefined, q: string) {
  const scope = useScope();
  const cacheable = !status && !q;
  const stored = cacheable
    ? readStored<Page<SupportTicket>>(FIRST_PAGE)
    : undefined;
  const result = useInfiniteQuery({
    queryKey: [...supportKeys.list(status, q), scope],
    queryFn: async ({ pageParam, signal }) => {
      const page = await listTickets(
        { status, q: q || undefined, page: pageParam, limit: TICKET_PAGE_SIZE },
        signal,
      );
      if (cacheable && pageParam === 1) writeStored(FIRST_PAGE, page);
      return page;
    },
    initialPageParam: 1,
    getNextPageParam: (last: Page<SupportTicket>) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: scope !== null,
    staleTime: 15_000,
    ...(stored
      ? {
          initialData: {
            pages: [stored.data],
            pageParams: [1],
          } as InfiniteData<Page<SupportTicket>, number>,
          initialDataUpdatedAt: stored.at,
        }
      : {}),
  });
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (result.data?.pages ?? [])
      .flatMap(page => page.items)
      .filter(item => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  }, [result.data]);
  return { ...result, items };
}

/** A ticket and its thread; refreshed every 30 seconds while the screen is open. */
export function useTicket(id: string) {
  const scope = useScope();
  return useQuery({
    queryKey: [...supportKeys.ticket(id), scope],
    queryFn: ({ signal }) => getTicket(id, signal),
    enabled: scope !== null,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useSupportCategories() {
  return useQuery({
    queryKey: supportKeys.categories,
    ...withStoredAnswer(
      'support.categories',
      listSupportCategories,
      deviceStorage,
    ),
    staleTime: 10 * 60_000,
  });
}

export function useFaqs() {
  return useQuery({
    queryKey: supportKeys.faqs,
    ...withStoredAnswer('support.faqs', listFaqs, deviceStorage),
    staleTime: 5 * 60_000,
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: supportKeys.announcements,
    ...withStoredAnswer(
      'support.announcements',
      listAnnouncements,
      deviceStorage,
    ),
    staleTime: 60_000,
  });
}

/** Every support list and count is stale (a ticket was created, replied to, closed or rated). */
export function refreshSupport(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.support });
}
