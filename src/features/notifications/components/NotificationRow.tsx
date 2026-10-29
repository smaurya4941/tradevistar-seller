/**
 * One notification: an icon tile coloured by type, the title (bold while unread), the body (three
 * lines, expandable), how long ago, an unread dot and the action it leads to.
 *
 * Tap marks it read and opens its screen (`notificationRoute`); a row with no destination just
 * expands. Long-press, the "more" button, or TalkBack's actions menu offer "Mark as read/unread".
 * The title and body are never logged: they can carry buyer names.
 */
import {
  lookOf,
  notificationRoute,
  type NotificationActionKey,
  type SellerNotification,
} from '@tradevistar/seller-api';
import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  Icon,
  palette,
  radii,
  spacing,
  Text,
  tones,
  type Tone,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';

export const ACTION_LABEL: Record<NotificationActionKey, TranslationKey> = {
  viewOrder: 'ntf.action.viewOrder',
  viewMessage: 'ntf.action.viewMessage',
  viewInquiries: 'ntf.action.viewInquiries',
  viewRfqs: 'ntf.action.viewRfqs',
  viewQuotations: 'ntf.action.viewQuotations',
  viewProducts: 'ntf.action.viewProducts',
  viewInventory: 'ntf.action.viewInventory',
  viewPayments: 'ntf.action.viewPayments',
  viewWallet: 'ntf.action.viewWallet',
  viewSubscription: 'ntf.action.viewSubscription',
  viewProfile: 'ntf.action.viewProfile',
  viewTicket: 'ntf.action.viewTicket',
  viewDetails: 'ntf.action.viewDetails',
};

/** A body longer than this is probably cut at three lines, so the row offers "Show more". */
export const LONG_BODY_CHARS = 140;

export const NotificationRow = memo(function NotificationRowView({
  notification,
  timeAgo,
  onOpen,
  onMenu,
  onToggleRead,
}: {
  notification: SellerNotification;
  timeAgo: string;
  onOpen: (notification: SellerNotification) => void;
  onMenu: (notification: SellerNotification) => void;
  onToggleRead: (notification: SellerNotification) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const look = lookOf(notification.type);
  const tone = tones[look.tone as Tone] ?? tones.blue;
  const route = notificationRoute(notification);
  const unread = !notification.read;
  const actionLabel = route ? t(ACTION_LABEL[route.action]) : null;
  const longBody = (notification.body?.length ?? 0) > LONG_BODY_CHARS;

  const activate = () => {
    if (route) onOpen(notification);
    else {
      // Nothing to open: a tap reads the row and opens it up.
      if (unread) onToggleRead(notification);
      setExpanded(value => !value);
    }
  };

  return (
    <Pressable
      testID={`notification-${notification.id}`}
      onPress={activate}
      onLongPress={() => onMenu(notification)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={[
        unread ? t('ntf.unread') : null,
        notification.title,
        notification.body,
        timeAgo,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={actionLabel ?? undefined}
      accessibilityActions={[
        { name: 'activate' },
        {
          name: 'toggleRead',
          label: unread ? t('ntf.markRead') : t('ntf.markUnread'),
        },
      ]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'toggleRead') {
          onToggleRead(notification);
        } else {
          activate();
        }
      }}
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.dotSlot}>
        {unread ? <View style={styles.dot} testID="unread-dot" /> : null}
      </View>
      <View style={[styles.tile, { backgroundColor: tone.background }]}>
        <Icon name={look.icon} size={22} color={tone.foreground} />
      </View>
      <View style={styles.body}>
        <Text
          variant={unread ? 'bodyStrong' : 'body'}
          color={colors.onSurface}
          numberOfLines={expanded ? undefined : 2}
        >
          {notification.title}
        </Text>
        {notification.body ? (
          <Text
            variant="meta"
            color={colors.textMuted}
            numberOfLines={expanded ? undefined : 3}
          >
            {notification.body}
          </Text>
        ) : null}
        {longBody ? (
          <Pressable
            onPress={() => setExpanded(value => !value)}
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? t('ntf.showLess') : t('ntf.showMore')
            }
            hitSlop={8}
            testID={`notification-expand-${notification.id}`}
          >
            <Text variant="badge" color={colors.link}>
              {expanded ? t('ntf.showLess') : t('ntf.showMore')}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.footer}>
          <Text variant="small" color={colors.textMuted}>
            {timeAgo}
          </Text>
          {actionLabel ? (
            <View style={styles.action}>
              <Text variant="badge" color={colors.link}>
                {actionLabel}
              </Text>
              <Icon name="chevron_right" size={14} color={colors.link} />
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        testID={`notification-menu-${notification.id}`}
        onPress={() => onMenu(notification)}
        accessibilityRole="button"
        accessibilityLabel={t('ntf.moreFor', { title: notification.title })}
        hitSlop={8}
        style={styles.menu}
      >
        <Icon name="more_vert" size={20} color={colors.outline} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingRight: spacing.xs,
    backgroundColor: colors.surface,
  },
  rowUnread: { backgroundColor: palette.blue50 },
  pressed: { backgroundColor: colors.surfaceContainer },
  dotSlot: { width: 14, alignItems: 'flex-end', paddingTop: 18 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  action: { flexDirection: 'row', alignItems: 'center' },
  menu: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
