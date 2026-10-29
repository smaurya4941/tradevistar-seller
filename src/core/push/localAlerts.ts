/**
 * System notifications raised by the app itself.
 *
 * The backend has no push sender yet (gap 3), so when the app is running in the background and a
 * notification the seller asked to be pushed arrives (the server marks it `metadata._push`), the
 * app shows it through Notifee. Foreground arrivals get an in-app banner instead, and a cold
 * start never raises alerts for old rows (see `ArrivalTracker`).
 */
import notifee, {
  EventType,
  type Event as NotifeeEvent,
} from '@notifee/react-native';
import {
  markNotificationRead,
  PUSH_CHANNELS,
  type NotificationCategory,
  type SellerNotification,
} from '@tradevistar/seller-api';
import { openPortalHref } from '@/app/navigation/openHref';
import { logger } from '@/core/logger';
import { queryClient, queryKeys } from '@/core/query/queryClient';
import { t } from '@/i18n';
import {
  alertChannel,
  alertData,
  alertIdFor,
  tappedHref,
  tappedNotificationId,
  type AlertData,
} from './alertPayload';
import { lastLauncherCount } from './launcherBadge';
import { getPushPermission } from './permission';
import { conversationIdFor } from './conversationAlert';

const SUMMARY_PREFIX = 'summary-';

const SUMMARY_KEY: Record<
  NotificationCategory,
  | 'push.group.orders'
  | 'push.group.quotes'
  | 'push.group.samples'
  | 'push.group.messages'
  | 'push.group.updates'
> = {
  orders: 'push.group.orders',
  quotes: 'push.group.quotes',
  samples: 'push.group.samples',
  messages: 'push.group.messages',
  updates: 'push.group.updates',
};

/** Keeps one summary per channel once two or more of its alerts are showing ("3 order updates"). */
async function refreshGroupSummary(
  channel: NotificationCategory,
): Promise<void> {
  const shown = await notifee.getDisplayedNotifications();
  const members = shown.filter(
    item =>
      item.notification?.android?.groupId === channel &&
      !item.notification?.android?.groupSummary,
  );
  const summaryId = `${SUMMARY_PREFIX}${channel}`;
  if (members.length < 2) {
    await notifee.cancelNotification(summaryId);
    return;
  }
  const name = PUSH_CHANNELS.find(item => item.id === channel)?.name ?? channel;
  await notifee.displayNotification({
    id: summaryId,
    title: name,
    body: t(SUMMARY_KEY[channel], { count: members.length }),
    data: { summary: channel },
    android: {
      channelId: channel,
      smallIcon: 'ic_launcher',
      groupId: channel,
      groupSummary: true,
      pressAction: { id: 'default' },
    },
  });
}

/**
 * Shows one server notification as a system notification on the channel for its category,
 * grouped with the rest of that channel and carrying the launcher-icon count. Returns false when
 * the seller has not allowed notifications or the system refused.
 */
export async function displayLocalAlert(
  row: SellerNotification,
  unreadTotal?: number,
): Promise<boolean> {
  try {
    if ((await getPushPermission()) !== 'granted') return false;
    const data = alertData(row);
    const channel = alertChannel(data);
    await notifee.displayNotification({
      // The same id for the same server row: a refreshed duplicate replaces its alert.
      id: alertIdFor(row.id),
      title: row.title,
      body: row.body ?? undefined,
      data,
      android: {
        channelId: channel,
        smallIcon: 'ic_launcher',
        tag: alertIdFor(row.id),
        groupId: channel,
        badgeCount: Math.min(99, unreadTotal ?? lastLauncherCount() + 1),
        pressAction: { id: 'default' },
      },
    });
    await refreshGroupSummary(channel).catch(error =>
      logger.info('[push] group summary failed', error),
    );
    return true;
  } catch (error) {
    logger.info('[push] could not show an alert', error);
    return false;
  }
}

/** Clears the shown alerts for a conversation once its thread is open (Phase 6 calls this). */
export async function dismissConversationAlerts(
  conversationId: string,
): Promise<void> {
  try {
    const shown = await notifee.getDisplayedNotifications();
    const matches = shown.filter(
      item =>
        conversationIdFor(item.notification?.data as AlertData | undefined) ===
        conversationId,
    );
    for (const item of matches) {
      if (item.id) await notifee.cancelNotification(item.id);
    }
    if (matches.length) await refreshGroupSummary('messages');
  } catch (error) {
    logger.info('[push] dismiss failed', error);
  }
}

/** Marks the notification behind a tapped alert read, so every badge clears. */
function markTappedRead(data: AlertData | undefined): void {
  const id = tappedNotificationId(data);
  if (!id) return;
  markNotificationRead(id)
    .then(() =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
    )
    .catch(error => logger.info('[push] mark read failed', error));
}

/** A tap on an alert: mark it read and open where it leads. */
export function openFromAlert(data: AlertData | undefined): void {
  // A tap on a group summary opens the notification centre.
  if (typeof data?.summary === 'string') {
    openPortalHref('/seller/dashboard/notifications');
    return;
  }
  markTappedRead(data);
  openPortalHref(tappedHref(data));
}

function onNotifeeEvent({ type, detail }: NotifeeEvent): void {
  if (type === EventType.PRESS) {
    openFromAlert(detail.notification?.data as AlertData | undefined);
  }
}

let started = false;

/** Starts tap handling for alerts while the app is in front, and delivers the tap that launched it. */
export function startAlertListeners(): () => void {
  if (started) return () => undefined;
  started = true;
  const unsubscribe = notifee.onForegroundEvent(onNotifeeEvent);
  notifee
    .getInitialNotification()
    .then(initial => {
      if (initial) {
        openFromAlert(initial.notification.data as AlertData | undefined);
      }
    })
    .catch(error =>
      logger.warn('[push] initial notification unavailable', error),
    );
  return () => {
    unsubscribe();
    started = false;
  };
}

/**
 * A local alert that exercises channels, display and tap routing end to end without the server.
 * Development and staging only (Diagnostics).
 */
export async function showLocalTestAlert(): Promise<boolean> {
  return displayLocalAlert({
    id: `local-${Date.now()}`,
    type: 'order.placed',
    title: 'Test: you have a new order',
    body: 'Tap to check that notification taps are routed.',
    read: false,
    createdAt: new Date().toISOString(),
    metadata: { orderId: 'TEST-ORDER-1', _push: true },
  });
}
