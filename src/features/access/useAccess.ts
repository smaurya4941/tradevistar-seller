/**
 * Verified access (`GET /me/access`) as one hook.
 *
 * - `verified: true` is writable, including sellers exempt from verification (the server already
 *   reports those as verified).
 * - A role of `null` means the account has nothing to gate, so nothing is limited.
 * - While the answer is unknown (loading, or the request failed) nothing is limited either: the
 *   server stays the source of truth and refuses a write itself (ACCOUNT_VERIFICATION_REQUIRED).
 *
 * It refetches on sign-in (the query becomes enabled), when the app returns to the foreground,
 * when the main tab changes (`refreshAccessOnNavigation`) and after any verification refusal
 * (wired in `wireQueryLifecycle`).
 */
import {
  getMyAccess,
  verificationState,
  type AccountAccess,
  type KycStatus,
  type VerificationState,
} from '@tradevistar/seller-api';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/core/auth/SessionProvider';
import { queryClient, queryKeys } from '@/core/query/queryClient';

export interface AccessInfo {
  access: AccountAccess | null;
  /** True only when the server said so. */
  verified: boolean;
  kycStatus: KycStatus | null;
  /** The limited state to explain, or null when nothing limits the seller. */
  state: VerificationState | null;
  /** False while the seller is view-only. */
  canWrite: boolean;
  refetch: () => void;
}

export function useAccess(): AccessInfo {
  const session = useSession();
  const signedIn = session.status === 'signedIn';
  const { data, refetch } = useQuery({
    queryKey: queryKeys.access,
    queryFn: ({ signal }) => getMyAccess(signal),
    enabled: signedIn,
    // Always re-read on focus: a seller verified a minute ago should not wait for a stale window.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const access = signedIn ? data ?? null : null;
  const state = verificationState(access);
  return {
    access,
    verified: access?.verified === true,
    kycStatus: access?.kycStatus ?? null,
    state,
    canWrite: state === null,
    refetch: () => {
      void refetch();
    },
  };
}

let lastRoute: string | undefined;

/** Called when the screen in front changes: a tab switch re-checks access, like the web does per page. */
export function refreshAccessOnNavigation(routeName: string | undefined): void {
  if (!routeName || routeName === lastRoute) return;
  const previous = lastRoute;
  lastRoute = routeName;
  if (previous === undefined) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.access });
}

/** Test-only. */
export function resetAccessNavigation(): void {
  lastRoute = undefined;
}
