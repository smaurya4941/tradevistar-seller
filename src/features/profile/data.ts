/**
 * Server state for the profile area. Everything lives under the `company` query family so one
 * invalidation refreshes it all. The reads a seller opens most (overview, account, business,
 * addresses, team, calendar, bank list) are kept on the device for offline reading with a "Last
 * updated" label; sensitive screens (tax, documents, security) are never stored. Writes are
 * never queued: they need a connection, and the form stays filled when one is missing.
 */
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  getAccount,
  getAccountManager,
  getBankAccountHistory,
  getBusinessDetails,
  getCategories,
  getCalendar,
  getDeletionPreflight,
  getGstManualVerification,
  getGstOwnership,
  getGstVerificationMode,
  getLocationCities,
  getLocationCountries,
  getLocationStates,
  getLoginHistory,
  getMyKyc,
  getProfileOverview,
  getSecurityActivity,
  getSecurityOverview,
  getTaxDetail,
  getTaxHistory,
  listBankAccounts,
  listCompanyAddresses,
  listDocuments,
  listInvitations,
  listKycChangeRequests,
  listSecuritySessions,
  listTeam,
  type Page,
  type TaxHistoryEntry,
} from '@tradevistar/seller-api';
import { useMemo } from 'react';
import { useSession } from '@/core/auth/SessionProvider';
import { relativeLabel } from '@/core/format/relativeTime';
import { updatedAtOf, withStoredAnswer } from '@/core/query/persistedQuery';
import { queryKeys } from '@/core/query/queryClient';
import { useT } from '@/i18n';

export function useScope(): string | null {
  const session = useSession();
  return session.status === 'signedIn' || session.status === 'offline'
    ? session.user?.id ?? null
    : null;
}

export const companyKeys = {
  all: queryKeys.company,
  overview: [...queryKeys.company, 'overview'] as const,
  account: [...queryKeys.company, 'account'] as const,
  business: [...queryKeys.company, 'business'] as const,
  addresses: [...queryKeys.company, 'addresses'] as const,
  tax: [...queryKeys.company, 'tax'] as const,
  taxHistory: [...queryKeys.company, 'tax-history'] as const,
  gst: [...queryKeys.company, 'gst-ownership'] as const,
  gstMode: [...queryKeys.company, 'gst-mode'] as const,
  gstManual: [...queryKeys.company, 'gst-manual'] as const,
  documents: (archived: boolean) =>
    [...queryKeys.company, 'documents', archived] as const,
  allDocuments: [...queryKeys.company, 'documents'] as const,
  changeRequests: [...queryKeys.company, 'kyc-change-requests'] as const,
  kyc: [...queryKeys.company, 'kyc'] as const,
  banks: [...queryKeys.company, 'banks'] as const,
  bankHistory: (id: string) =>
    [...queryKeys.company, 'bank-history', id] as const,
  team: [...queryKeys.company, 'team'] as const,
  invitations: [...queryKeys.company, 'invitations'] as const,
  calendar: [...queryKeys.company, 'calendar'] as const,
  security: [...queryKeys.company, 'security'] as const,
  sessions: [...queryKeys.company, 'sessions'] as const,
  loginHistory: [...queryKeys.company, 'login-history'] as const,
  activity: [...queryKeys.company, 'activity'] as const,
  deletion: [...queryKeys.company, 'deletion'] as const,
  manager: [...queryKeys.company, 'account-manager'] as const,
  states: (country: string) =>
    [...queryKeys.company, 'states', country] as const,
  cities: (country: string, state: string) =>
    [...queryKeys.company, 'cities', country, state] as const,
  countries: [...queryKeys.company, 'countries'] as const,
};

/** The profile reads that are kept for offline reading, and the names they are kept under. */
const STORED = {
  overview: 'company.overview',
  account: 'company.account',
  business: 'company.business',
  addresses: 'company.addresses',
  team: 'company.team',
  calendar: 'company.calendar',
  banks: 'company.banks',
} as const;

const STALE = 30_000;

/** Reads of one's own profile are per user: the key carries the user so accounts never mix. */
function useOwn<T>(
  key: readonly unknown[],
  storedName: keyof typeof STORED | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean; staleTime?: number } = {},
) {
  const scope = useScope();
  // The stored answer only seeds the first load, so it is read once, not on every render.
  const stored = useMemo(
    () =>
      storedName ? withStoredAnswer(STORED[storedName], fetcher) : null,
    // The fetchers are stateless functions; a new closure each render must not re-read storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedName],
  );
  const query = useQuery({
    queryKey: [...key, scope],
    queryFn: stored ? stored.queryFn : ({ signal }) => fetcher(signal),
    ...(stored?.initialData !== undefined
      ? {
          initialData: stored.initialData,
          initialDataUpdatedAt: stored.initialDataUpdatedAt,
        }
      : {}),
    enabled: scope !== null && (options.enabled ?? true),
    staleTime: options.staleTime ?? STALE,
  });
  return { ...query, storedName };
}

export const useProfileOverview = () =>
  useOwn(companyKeys.overview, 'overview', getProfileOverview);
export const useAccount = () =>
  useOwn(companyKeys.account, 'account', getAccount);
export const useBusiness = () =>
  useOwn(companyKeys.business, 'business', getBusinessDetails);
export const useAddresses = () =>
  useOwn(companyKeys.addresses, 'addresses', s =>
    listCompanyAddresses(undefined, s),
  );
export const useTeam = () => useOwn(companyKeys.team, 'team', listTeam);
export const useInvitations = (enabled = true) =>
  useOwn(companyKeys.invitations, null, listInvitations, { enabled });
export const useCalendar = () =>
  useOwn(companyKeys.calendar, 'calendar', getCalendar);
export const useBanks = () =>
  useOwn(companyKeys.banks, 'banks', listBankAccounts);

// Never stored on the device: tax, documents, KYC, GST ownership and security.
export const useTax = () =>
  useOwn(companyKeys.tax, null, getTaxDetail, { staleTime: 0 });
export const useGstOwnership = (enabled: boolean) =>
  useOwn(companyKeys.gst, null, getGstOwnership, { enabled, staleTime: 0 });
export const useGstMode = (enabled: boolean) =>
  useOwn(companyKeys.gstMode, null, getGstVerificationMode, {
    enabled,
    staleTime: 60_000,
  });
export const useGstManual = (enabled: boolean) =>
  useOwn(companyKeys.gstManual, null, getGstManualVerification, {
    enabled,
    staleTime: 0,
  });
export const useDocuments = (includeArchived: boolean) =>
  useOwn(
    companyKeys.documents(includeArchived),
    null,
    s => listDocuments(includeArchived, s),
    { staleTime: 0 },
  );
export const useKycChangeRequests = () =>
  useOwn(companyKeys.changeRequests, null, listKycChangeRequests, {
    staleTime: 0,
  });
/** The seller's KYC case; the response may carry open requests from compliance (checked, see gaps). */
export const useMyKyc = () =>
  useOwn(companyKeys.kyc, null, getMyKyc, { staleTime: 60_000 });
export const useBankHistory = (id: string) =>
  useOwn(companyKeys.bankHistory(id), null, s => getBankAccountHistory(id, s));
export const useSecurity = () =>
  useOwn(companyKeys.security, null, getSecurityOverview, { staleTime: 0 });
export const useSessions = () =>
  useOwn(companyKeys.sessions, null, listSecuritySessions, { staleTime: 0 });
export const useLoginHistory = () =>
  useOwn(companyKeys.loginHistory, null, getLoginHistory);
export const useSecurityActivity = () =>
  useOwn(companyKeys.activity, null, getSecurityActivity);
export const useDeletionPreflight = () =>
  useOwn(companyKeys.deletion, null, getDeletionPreflight, { staleTime: 0 });
export const useAccountManager = () =>
  useOwn(companyKeys.manager, null, getAccountManager, {
    staleTime: 5 * 60_000,
  });

/** Tax history, 10 at a time. */
export function useTaxHistory() {
  const scope = useScope();
  const result = useInfiniteQuery({
    queryKey: [...companyKeys.taxHistory, scope],
    queryFn: ({ pageParam, signal }) => getTaxHistory(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last: Page<TaxHistoryEntry>) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: scope !== null,
    staleTime: 0,
  });
  const items = useMemo(
    () =>
      (
        result.data as InfiniteData<Page<TaxHistoryEntry>, number> | undefined
      )?.pages.flatMap(page => page.items) ?? [],
    [result.data],
  );
  return { ...result, items };
}

/* ------------------------------------------------------------------ reference lists */

export function useCountries() {
  return useQuery({
    queryKey: companyKeys.countries,
    queryFn: ({ signal }) => getLocationCountries(signal),
    staleTime: 24 * 60 * 60_000,
  });
}

/** The top-level category list; its `code` is what the business record stores. */
export function useCategories() {
  return useQuery({
    queryKey: [...queryKeys.company, 'categories'],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 60 * 60_000,
  });
}

export function useStates(countryCode: string) {
  return useQuery({
    queryKey: companyKeys.states(countryCode),
    queryFn: ({ signal }) => getLocationStates(countryCode, signal),
    enabled: Boolean(countryCode),
    staleTime: 24 * 60 * 60_000,
  });
}

export function useCities(countryCode: string, stateCode: string) {
  return useQuery({
    queryKey: companyKeys.cities(countryCode, stateCode),
    queryFn: ({ signal }) => getLocationCities(countryCode, stateCode, signal),
    enabled: Boolean(countryCode && stateCode),
    staleTime: 24 * 60 * 60_000,
  });
}

/* ------------------------------------------------------------------ helpers */

/** Invalidates the whole profile family (after a write that can change several screens). */
export function useRefreshCompany() {
  const client = useQueryClient();
  return (...keys: readonly (readonly unknown[])[]) => {
    const targets = keys.length > 0 ? keys : [companyKeys.all];
    return Promise.all(
      targets.map(queryKey => client.invalidateQueries({ queryKey })),
    );
  };
}

/** "Last updated 5m ago" for a stored read; empty while the answer is fresh from the network. */
export function useUpdatedLabel(query: {
  dataUpdatedAt: number;
  isFetching: boolean;
  storedName: keyof typeof STORED | null;
}): string {
  const t = useT();
  const at = query.storedName
    ? updatedAtOf(query.dataUpdatedAt, STORED[query.storedName])
    : query.dataUpdatedAt || null;
  if (!at || query.isFetching) return '';
  return t('form.lastUpdated', {
    time: relativeLabel(t, new Date(at).toISOString()),
  });
}
