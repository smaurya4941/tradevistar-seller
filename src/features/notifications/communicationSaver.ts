/**
 * Saving communication preferences with the server's optimistic-concurrency version. Another
 * session (the web) may have changed the record since this screen loaded; the server then answers
 * 409 `STALE_RESOURCE_VERSION`. The save re-reads the record and sends the same change once more
 * on the fresh version, and only then gives up.
 */
import {
  ApiError,
  type CommunicationPreferences,
  type CommunicationUpdate,
} from '@tradevistar/seller-api';

export const STALE_VERSION_CODE = 'STALE_RESOURCE_VERSION';

export function isStaleVersion(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === STALE_VERSION_CODE || error.statusCode === 409)
  );
}

export interface CommunicationApi {
  get(): Promise<CommunicationPreferences>;
  update(update: CommunicationUpdate): Promise<CommunicationPreferences>;
}

/** Sends `patch` on the version we hold; on a stale version, reloads and retries exactly once. */
export async function saveCommunication(
  current: Pick<CommunicationPreferences, 'version'>,
  patch: Omit<CommunicationUpdate, 'version'>,
  api: CommunicationApi,
): Promise<CommunicationPreferences> {
  try {
    return await api.update({ ...patch, version: current.version });
  } catch (error) {
    if (!isStaleVersion(error)) throw error;
    const fresh = await api.get();
    return api.update({ ...patch, version: fresh.version });
  }
}

/** The record with `patch` applied, for the optimistic update. */
export function applyCommunicationPatch(
  current: CommunicationPreferences,
  patch: Omit<CommunicationUpdate, 'version'>,
): CommunicationPreferences {
  return { ...current, ...patch } as CommunicationPreferences;
}

export const LANGUAGE_OPTIONS = [
  { value: 'en', labelKey: 'comm.lang.en' },
  { value: 'hi', labelKey: 'comm.lang.hi' },
  { value: 'gu', labelKey: 'comm.lang.gu' },
  { value: 'ta', labelKey: 'comm.lang.ta' },
  { value: 'bn', labelKey: 'comm.lang.bn' },
] as const;

export const CONTACT_METHOD_OPTIONS = [
  { value: 'EMAIL', labelKey: 'comm.method.EMAIL' },
  { value: 'PHONE', labelKey: 'comm.method.PHONE' },
  { value: 'WHATSAPP', labelKey: 'comm.method.WHATSAPP' },
  { value: 'IN_APP', labelKey: 'comm.method.IN_APP' },
] as const;
