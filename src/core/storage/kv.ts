/**
 * Fast key-value storage (MMKV) for preferences and flags. Never for secrets: the refresh token
 * lives in the keystore (secureStore.ts).
 *
 * Two instances keep the sign-out wipe simple and safe:
 * - `deviceStorage` survives sign-out (language, theme, what this device has shown);
 * - `userStorage` holds anything about the signed-in seller and is cleared on sign-out.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

export const deviceStorage: MMKV = createMMKV({ id: 'tv.seller.device' });
export const userStorage: MMKV = createMMKV({ id: 'tv.seller.user' });

export const DeviceKeys = {
  language: 'prefs.language',
  theme: 'prefs.theme',
  /** The last /app/config that loaded, used when the network is slow or down at launch. */
  lastAppConfig: 'appConfig.last',
  lastAppConfigAt: 'appConfig.lastAt',
  /** The latestVersion whose optional-update card the seller dismissed. */
  optionalUpdateDismissed: 'update.optionalDismissed',
  /** Ids of the notice celebrations this device has already played. */
  celebratedNotices: 'notices.celebrated',
  /** The registration form: identifiers and business fields only, never a password or ticket. */
  registrationDraft: 'register.draft',
  /** Whether new notifications play the platform sound while the app is open (default on). */
  notificationSound: 'prefs.notificationSound',
  /** The last answer to the Android notification permission prompt. */
  pushPermission: 'push.permission',
  pushExplainerSeen: 'push.explainerSeen',
  /** When the API last answered 404 to push-device registration (re-asked after a day). */
  pushUnsupportedAt: 'push.unsupportedAt',
  lastPushToken: 'push.lastToken',
  /** The launcher-icon number last set. */
  launcherBadge: 'push.launcherBadge',
  /** The footer, kept for 24 hours so legal pages open offline. */
  footerCache: 'footer.cache',
  footerPagePrefix: 'footer.page.',
  /** The platform notification sound version last downloaded. */
  soundVersion: 'sound.version',
  /** Knowledge-base articles already voted helpful on this device (one vote each). */
  faqVotes: 'support.faqVotes',
  /** The ticket categories and the knowledge base, for reading offline. */
  supportCategories: 'support.categories',
} as const;

export const UserKeys = {
  lastUserId: 'session.lastUserId',
  /**
   * The signed-in seller's public profile (name, contact, code), so an offline launch can still
   * show who is signed in. Wiped with everything else in this instance on sign-out.
   */
  cachedUser: 'session.cachedUser',
  /** Notification id to createdAt, so a row is never alerted twice (capped at 2,000). */
  seenNotifications: 'notifications.seen',
  /** The last ten searches. */
  recentSearches: 'search.recent',
  /** The unsent new-ticket form. */
  ticketDraft: 'support.ticketDraft',
  /** Prefix of the persisted query answers shown when offline. */
  queryCachePrefix: 'qcache.',
} as const;

export function clearUserStorage(): void {
  userStorage.clearAll();
}

export function readJson<T>(storage: MMKV, key: string): T | undefined {
  const raw = storage.getString(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.remove(key);
    return undefined;
  }
}

export function writeJson(storage: MMKV, key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
