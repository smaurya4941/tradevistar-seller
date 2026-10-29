/**
 * Server data for platform notices. Screens never call the API directly.
 *
 * Notices are time-critical (a maintenance window flips from "upcoming" to "live" on the clock),
 * so they are never saved on the device: a stale copy shown on a cold start could announce a
 * window that already ended. The list is re-read every minute while the app is in the foreground,
 * when it returns to the foreground, and straight away when the API refuses a write because of
 * maintenance (see `wireQueryLifecycle`). Failures are silent: a banner that cannot load is
 * simply absent, and whatever was showing stays.
 */
import {
  clockSkew,
  getSiteNotices,
  NOTICE_POLL_MS,
  type SiteNoticesResponse,
} from '@tradevistar/seller-api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/query/queryClient';

export interface SiteNoticeFeed extends SiteNoticesResponse {
  /** Server time minus device time when the list arrived; add to `Date.now()` for server time. */
  skew: number;
}

async function loadNotices(signal?: AbortSignal): Promise<SiteNoticeFeed> {
  const response = await getSiteNotices('seller', signal);
  return { ...response, skew: clockSkew(response.serverTime, Date.now()) };
}

export function useSiteNotices() {
  return useQuery({
    queryKey: queryKeys.siteNotices,
    queryFn: ({ signal }) => loadNotices(signal),
    staleTime: NOTICE_POLL_MS / 2,
    refetchInterval: NOTICE_POLL_MS,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
