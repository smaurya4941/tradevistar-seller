/**
 * Notifications: the live snapshot that feeds every badge, the paged list, read state, the
 * platform sound, and the seller's preferences.
 *
 * All of `/notifications/*` is open to unverified sellers (the controller is @AllowUnverified).
 */
import { api, apiRequest } from "../http/client";
import { pageMetaOf, qs, type Page, type PageMeta } from "./paged";

/** The buckets the notification list filters by, derived on the server from the type prefix. */
export type NotificationCategory = "orders" | "quotes" | "samples" | "messages" | "updates";

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  "orders",
  "quotes",
  "samples",
  "messages",
  "updates",
];

/** The 14 unread work areas behind the navigation badges. */
export type NotificationArea =
  | "orders"
  | "cancellations"
  | "returns"
  | "refunds"
  | "rfs"
  | "samples"
  | "messages"
  | "payments"
  | "wallet"
  | "products"
  | "support"
  | "disputes"
  | "approvals"
  | "updates";

export interface SellerNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  /** Entity ids, an optional `actionUrl`, and `_push: true` when the seller's Push preference is on. */
  metadata: Record<string, unknown> | null;
  /** Present on list rows; the live snapshot omits it. */
  category?: NotificationCategory;
  icon?: string | null;
}

export interface NotificationSnapshot {
  /** The 30 most recent rows. */
  notifications: SellerNotification[];
  unreadNotifications: number;
  unreadMessages: number;
  unreadByArea: Record<NotificationArea, number>;
  conversationRevision: string;
  /** -1 when the admin has set no sound. */
  soundVersion: number;
}

export interface NotificationCounts {
  total: number;
  byCategory: Record<NotificationCategory, number>;
  byArea: Record<NotificationArea, number>;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unread?: boolean;
  category?: NotificationCategory;
}

export interface NotificationPage extends Page<SellerNotification> {
  unreadCount: number;
}

export const getNotificationSnapshot = (signal?: AbortSignal) =>
  api.get<NotificationSnapshot>("/notifications/live", { requireAuth: true, signal });

export async function listNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<NotificationPage> {
  const result = await apiRequest<SellerNotification[]>(
    `/notifications${qs({
      page: params.page,
      limit: params.limit,
      unread: params.unread ? true : undefined,
      category: params.category,
    })}`,
    { method: "GET", requireAuth: true, signal },
  );
  const items = Array.isArray(result.data) ? result.data : [];
  const meta = (result.meta ?? {}) as Partial<PageMeta> & { unreadCount?: number };
  return { items, meta: pageMetaOf(meta, items.length), unreadCount: meta.unreadCount ?? 0 };
}

export const getNotificationCounts = (signal?: AbortSignal) =>
  api.get<NotificationCounts>("/notifications/counts", { requireAuth: true, signal });

export const markNotificationRead = (id: string) =>
  api.post<void>(`/notifications/${encodeURIComponent(id)}/read`, undefined, { requireAuth: true });

export const markNotificationUnread = (id: string) =>
  api.post<void>(`/notifications/${encodeURIComponent(id)}/unread`, undefined, { requireAuth: true });

/** Without a category every unread row is cleared. */
export const markAllNotificationsRead = (category?: NotificationCategory) =>
  api.post<void>("/notifications/read-all", category ? { category } : {}, { requireAuth: true });

/**
 * The platform notification sound an admin uploaded: a `data:audio/…;base64,` URI of at most 1 MB
 * (or a link), with the version it was saved at. `source` is null when none is set.
 */
export interface NotificationSoundSetting {
  source: string | null;
  version: number;
}

export const getNotificationSound = (signal?: AbortSignal) =>
  api.get<NotificationSoundSetting>("/notifications/sound", { requireAuth: true, signal });

/* ------------------------------------------------------------------ preferences */

/** The 15 preference categories (Prisma `NotificationCategory`), in the order the web lists them. */
export const PREFERENCE_CATEGORIES = [
  "ORDERS",
  "PAYMENTS",
  "RFQS",
  "BUYER_INQUIRIES",
  "MESSAGES",
  "PRODUCTS",
  "INVENTORY",
  "SHIPMENTS",
  "VERIFICATION",
  "KYC",
  "BANK",
  "MARKETING",
  "ANALYTICS",
  "SECURITY",
  "ACCOUNT",
] as const;
export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number];

export const PREFERENCE_CHANNELS = ["EMAIL", "SMS", "PUSH", "IN_APP"] as const;
export type PreferenceChannel = (typeof PREFERENCE_CHANNELS)[number];

export interface PreferenceChannelState {
  channel: PreferenceChannel;
  enabled: boolean;
  /** Always on; the server refuses to switch it off (403 NOTIFICATION_LOCKED). */
  locked: boolean;
}

export interface NotificationPreferenceRow {
  category: PreferenceCategory;
  channels: PreferenceChannelState[];
}

export interface PreferenceChange {
  category: PreferenceCategory;
  channel: PreferenceChannel;
  enabled: boolean;
}

export const getNotificationPreferences = (signal?: AbortSignal) =>
  api.get<NotificationPreferenceRow[]>("/seller/profile/notifications", { requireAuth: true, signal });

/** A batch of changes in one call; the answer is the full matrix after saving. */
export const updateNotificationPreferences = (preferences: PreferenceChange[]) =>
  api.patch<NotificationPreferenceRow[]>("/seller/profile/notifications", { preferences }, { requireAuth: true });

export type PreferredContactMethod = "EMAIL" | "PHONE" | "WHATSAPP" | "IN_APP";

export interface CommunicationPreferences {
  emailEnabled: boolean;
  phoneEnabled: boolean;
  whatsappEnabled: boolean;
  marketingOptIn: boolean;
  marketingOptInAt: string | null;
  promotionalOptIn: boolean;
  promotionalOptInAt: string | null;
  buyerInquiryAlerts: boolean;
  preferredLanguage: string;
  preferredContactMethod: PreferredContactMethod | string;
  timezone: string;
  /** Optimistic-concurrency version; send it back with every update. */
  version: number;
}

export type CommunicationUpdate = Partial<
  Pick<
    CommunicationPreferences,
    | "emailEnabled"
    | "phoneEnabled"
    | "whatsappEnabled"
    | "marketingOptIn"
    | "promotionalOptIn"
    | "buyerInquiryAlerts"
    | "preferredLanguage"
    | "preferredContactMethod"
  >
> & { version?: number };

export const getCommunicationPreferences = (signal?: AbortSignal) =>
  api.get<CommunicationPreferences>("/seller/profile/communication", { requireAuth: true, signal });

export const updateCommunicationPreferences = (update: CommunicationUpdate) =>
  api.patch<CommunicationPreferences>("/seller/profile/communication", update, { requireAuth: true });

/* ------------------------------------------------------------------ push registration */

export type PushPlatform = "ANDROID" | "IOS";

export interface PushDeviceRegistration {
  token: string;
  platform: PushPlatform;
  appVersion: string;
  deviceName: string;
  locale: string;
}

/**
 * Push-device registration (`POST /me/devices`). The API has no such route yet (gap 3), so this
 * answers 404 today; the caller records that as "unsupported" and registration starts working with
 * no app change when the route ships.
 */
export const registerPushDevice = (body: PushDeviceRegistration) =>
  api.post<unknown>("/me/devices", body, { requireAuth: true });

export const unregisterPushDevice = (token: string) =>
  api.delete<void>(`/me/devices/${encodeURIComponent(token)}`, { requireAuth: true });
