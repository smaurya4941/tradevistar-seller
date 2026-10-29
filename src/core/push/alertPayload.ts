/**
 * Turns a notification into the data a system notification carries, and back into a destination
 * when it is tapped. No native imports, so the rules are unit tested under plain Jest.
 *
 * The payload is strings only (Notifee requires it): the notification's id, type, category and
 * the portal `href` it leads to. The id is the Notifee id too, so a deduplicated server row that
 * is refreshed replaces its earlier alert instead of stacking a second one.
 */
import {
  categoryOf,
  channelIdFor,
  conversationIdOf,
  notificationRoute,
  type NotificationCategory,
  type SellerNotification,
} from '@tradevistar/seller-api';

export type AlertData = Record<string, string>;

export const FALLBACK_HREF = '/seller/dashboard/notifications';

export function alertIdFor(notificationId: string): string {
  return `tv-${notificationId}`;
}

export function alertData(row: SellerNotification): AlertData {
  const route = notificationRoute(row);
  const conversationId = conversationIdOf(row);
  return {
    notificationId: row.id,
    type: row.type,
    category: categoryOf(row.type),
    href: route?.href ?? FALLBACK_HREF,
    ...(conversationId ? { conversationId } : {}),
  };
}

export function alertChannel(
  data: AlertData | undefined,
): NotificationCategory {
  return channelIdFor(data?.category);
}

/** The notification a tapped alert stands for, so a tap can mark it read. Test alerts have none. */
export function tappedNotificationId(
  data: AlertData | undefined,
): string | undefined {
  const id = data?.notificationId;
  return id && !id.startsWith('local-') ? id : undefined;
}

/** Where tapping the alert leads: its own href, else the notification centre. */
export function tappedHref(data: AlertData | undefined): string {
  const href = data?.href;
  return href && href.startsWith('/seller/') ? href : FALLBACK_HREF;
}
