/**
 * Home's server state. Every card has its own query, so a slow or failing one never blanks the
 * screen. `/seller/dashboard` feeds both the KPIs and the analytics card and is requested once.
 *
 * Order of work: the status counts, wallet and dashboard start first; the three lists (recent
 * orders, inquiries, shipments) start once those have settled, so the figures at the top are not
 * competing with the lists for the connection.
 *
 * The last good answer of each query is kept on the device, so Home opens offline with what it
 * showed last and an "Updated <time>" label.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getBusinessName,
  getOrderStatusCounts,
  getSellerDashboard,
  getWalletSummary,
  listInquirySummaries,
  listRecentOrders,
  listShipmentSummaries,
  sellerDisplayName,
} from '@tradevistar/seller-api';
import { useCallback, useRef } from 'react';
import { useSession } from '@/core/auth/SessionProvider';
import { queryClient, queryKeys } from '@/core/query/queryClient';
import { withStoredAnswer } from '@/core/query/persistedQuery';

export const HOME_REFRESH_AFTER_MS = 30_000;

export const homeKeys = {
  dashboard: [...queryKeys.dashboard, 'summary'] as const,
  statusCounts: [...queryKeys.dashboard, 'status-counts'] as const,
  wallet: [...queryKeys.dashboard, 'wallet'] as const,
  orders: [...queryKeys.dashboard, 'recent-orders'] as const,
  inquiries: [...queryKeys.dashboard, 'inquiries'] as const,
  shipments: [...queryKeys.dashboard, 'shipments'] as const,
  business: [...queryKeys.dashboard, 'business-name'] as const,
};

function useScope(): string | null {
  const session = useSession();
  return session.status === 'signedIn' || session.status === 'offline'
    ? session.user?.id ?? null
    : null;
}

const STALE_MS = 30_000;

export function useDashboardSummary() {
  const scope = useScope();
  return useQuery({
    queryKey: [...homeKeys.dashboard, scope],
    ...withStoredAnswer('home.dashboard', getSellerDashboard),
    enabled: scope !== null,
    staleTime: STALE_MS,
  });
}

export function useStatusCounts() {
  const scope = useScope();
  return useQuery({
    queryKey: [...homeKeys.statusCounts, scope],
    ...withStoredAnswer('home.statusCounts', getOrderStatusCounts),
    enabled: scope !== null,
    staleTime: STALE_MS,
  });
}

export function useWalletSummary() {
  const scope = useScope();
  return useQuery({
    queryKey: [...homeKeys.wallet, scope],
    ...withStoredAnswer('home.wallet', getWalletSummary),
    enabled: scope !== null,
    staleTime: STALE_MS,
  });
}

/**
 * True once the three headline queries have each finished (answered or failed), so the lists may
 * start. A stored answer does not count as finished: the headline figures refresh first, then the
 * lists, whether or not something was saved from last time.
 */
export function usePrimarySettled(
  ...queries: { isFetching: boolean }[]
): boolean {
  return queries.every(query => !query.isFetching);
}

export function useRecentOrders(enabled: boolean) {
  const scope = useScope();
  return useQuery({
    queryKey: [...homeKeys.orders, scope],
    ...withStoredAnswer('home.orders', signal => listRecentOrders(5, signal)),
    enabled: enabled && scope !== null,
    staleTime: STALE_MS,
  });
}

export function useInquiries(enabled: boolean) {
  const scope = useScope();
  return useQuery({
    queryKey: [...homeKeys.inquiries, scope],
    ...withStoredAnswer('home.inquiries', signal =>
      listInquirySummaries(8, signal),
    ),
    enabled: enabled && scope !== null,
    staleTime: STALE_MS,
  });
}

export function useShipments(enabled: boolean) {
  const scope = useScope();
  return useQuery({
    queryKey: [...homeKeys.shipments, scope],
    ...withStoredAnswer('home.shipments', signal =>
      listShipmentSummaries(8, signal),
    ),
    enabled: enabled && scope !== null,
    staleTime: STALE_MS,
  });
}

/** The name Home greets the seller by: business name, then person, then the product name. */
export function useGreetingName(): string {
  const session = useSession();
  const scope = useScope();
  const business = useQuery({
    queryKey: [...homeKeys.business, scope],
    ...withStoredAnswer('home.business', getBusinessName),
    enabled: scope !== null,
    staleTime: 5 * 60_000,
  });
  const user =
    session.status === 'signedIn' || session.status === 'offline'
      ? session.user
      : null;
  return sellerDisplayName(business.data, user);
}

/** Refreshes every Home card at once (pull to refresh, or returning after a while). */
export function refreshHome(): Promise<void> {
  return queryClient.refetchQueries({ queryKey: queryKeys.dashboard });
}

/**
 * Calls `refresh` when the screen comes back into view after more than 30 seconds, and records
 * when it last ran. Returns the callback to hand to `useFocusEffect`.
 */
export function useRefreshOnFocus(refresh: () => void): () => void {
  // The latest `refresh` is read from a ref so the returned callback keeps its identity: a
  // callback that changed on every render would run on every render and never see 30 seconds pass.
  const latest = useRef(refresh);
  latest.current = refresh;
  const last = useRef(Date.now());
  return useCallback(() => {
    if (Date.now() - last.current > HOME_REFRESH_AFTER_MS) {
      latest.current();
    }
    last.current = Date.now();
  }, []);
}
