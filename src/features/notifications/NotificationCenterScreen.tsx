/**
 * The Inbox tab: the notification centre.
 *
 * Category chips with unread counts (All, Orders, Quotes, Samples, Messages, Updates — the server
 * decides which a notification belongs to), rows grouped Today / Yesterday / Earlier, 25 per page
 * with infinite scroll. A tap marks the row read and opens its screen (`notificationRoute`); a
 * long-press marks it read or unread. "Mark all read" clears the category in view, after a
 * confirmation.
 *
 * Live: the socket and the live snapshot refresh the list. If the seller has scrolled down, new
 * rows do not shove the list; a "New notifications" pill offers to jump to the top instead. Phase
 * 6 adds a Messages segment next to this list.
 */
import { useNetInfo } from '@react-native-community/netinfo';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  calendarBucket,
  notificationRoute,
  type CalendarBucket,
  type SellerNotification,
} from '@tradevistar/seller-api';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openPortalHref } from '@/app/navigation/openHref';
import type { InboxStackParamList } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { relativeLabel } from '@/core/format/relativeTime';
import { isOffline } from '@/core/network/connectivity';
import {
  Banner,
  BottomSheet,
  colors,
  ConfirmDialog,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  palette,
  radii,
  SegmentedTabs,
  Skeleton,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { NotificationRow } from './components/NotificationRow';
import { PushPermissionCard } from './components/PushPermissionCard';
import {
  isNotificationTab,
  markAllRead,
  markRead,
  markUnread,
  NOTIFICATION_TABS,
  useNotificationCounts,
  useNotificationList,
  type NotificationTab,
} from './data';

const TAB_LABEL: Record<NotificationTab, TranslationKey> = {
  all: 'ntf.tab.all',
  orders: 'ntf.tab.orders',
  quotes: 'ntf.tab.quotes',
  samples: 'ntf.tab.samples',
  messages: 'ntf.tab.messages',
  updates: 'ntf.tab.updates',
};

const BUCKET_LABEL: Record<CalendarBucket, TranslationKey> = {
  today: 'ntf.today',
  yesterday: 'ntf.yesterday',
  earlier: 'ntf.earlier',
};

/** Scrolled further than this and new rows wait behind the pill instead of moving the list. */
const AWAY_FROM_TOP_PX = 160;

type Item =
  | { kind: 'header'; key: string; bucket: CalendarBucket }
  | { kind: 'row'; key: string; notification: SellerNotification };

export function groupByDay(
  items: readonly SellerNotification[],
  now: Date = new Date(),
): Item[] {
  const out: Item[] = [];
  let current: CalendarBucket | null = null;
  for (const notification of items) {
    const bucket = calendarBucket(notification.createdAt, now);
    if (bucket !== current) {
      out.push({ kind: 'header', key: `h-${bucket}`, bucket });
      current = bucket;
    }
    out.push({ kind: 'row', key: notification.id, notification });
  }
  return out;
}

export function NotificationCenterScreen() {
  const t = useT();
  const navigation =
    useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const route = useRoute<RouteProp<InboxStackParamList, 'InboxMain'>>();
  const toast = useToast();
  const net = useNetInfo();
  const offline = isOffline(net);

  const [tab, setTab] = useState<NotificationTab>(() =>
    isNotificationTab(route.params?.category) ? route.params.category : 'all',
  );
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [menuFor, setMenuFor] = useState<SellerNotification | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [marking, setMarking] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [newPill, setNewPill] = useState(false);

  const listRef = useRef<FlatList<Item>>(null);
  const offsetRef = useRef(0);
  const topId = useRef<string | null>(null);

  // A link can ask for a category while the screen is already open.
  useEffect(() => {
    if (isNotificationTab(route.params?.category))
      setTab(route.params.category);
  }, [route.params?.category]);

  const counts = useNotificationCounts();
  const list = useNotificationList(tab, unreadOnly);
  const items = useMemo(() => groupByDay(list.items), [list.items]);

  // A row that appears above what the seller is reading raises the pill instead of moving them.
  const firstId = list.items[0]?.id ?? null;
  useEffect(() => {
    const previous = topId.current;
    topId.current = firstId;
    if (previous !== null && firstId !== null && firstId !== previous) {
      if (offsetRef.current > AWAY_FROM_TOP_PX) setNewPill(true);
    }
  }, [firstId]);

  // Changing the filter starts a fresh list.
  useEffect(() => {
    topId.current = null;
    setNewPill(false);
  }, [tab, unreadOnly]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetRef.current = event.nativeEvent.contentOffset.y;
      if (offsetRef.current <= AWAY_FROM_TOP_PX / 2) setNewPill(false);
    },
    [],
  );

  const countFor = useCallback(
    (key: NotificationTab): number | undefined => {
      if (!counts.data) return undefined;
      return key === 'all' ? counts.data.total : counts.data.byCategory[key];
    },
    [counts.data],
  );
  const tabUnread = countFor(tab) ?? 0;

  const open = useCallback(
    (notification: SellerNotification) => {
      const target = notificationRoute(notification);
      track('notification_opened', { category: notification.category ?? tab });
      void markRead(notification).catch(() => undefined);
      if (target && !openPortalHref(target.href)) {
        toast.show(t('ntf.cannotOpen'), 'info');
      }
    },
    [t, tab, toast],
  );

  const toggleRead = useCallback(
    (notification: SellerNotification) => {
      const action = notification.read ? markUnread : markRead;
      action(notification).catch(() =>
        toast.show(t('ntf.updateFailed'), 'error'),
      );
    },
    [t, toast],
  );

  const markAll = async () => {
    setMarking(true);
    try {
      await markAllRead(tab);
      track('notification_marked_all', { category: tab });
      toast.show(t('ntf.markedAll'), 'success');
    } catch {
      toast.show(t('ntf.updateFailed'), 'error');
    } finally {
      setMarking(false);
      setConfirmAll(false);
    }
  };

  const refresh = async () => {
    setPulling(true);
    try {
      await Promise.all([list.refetch(), counts.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Item>) =>
      item.kind === 'header' ? (
        <Text
          variant="badge"
          color={colors.textMuted}
          accessibilityRole="header"
          style={styles.groupHeader}
        >
          {t(BUCKET_LABEL[item.bucket]).toUpperCase()}
        </Text>
      ) : (
        <NotificationRow
          notification={item.notification}
          timeAgo={relativeLabel(t, item.notification.createdAt)}
          onOpen={open}
          onMenu={setMenuFor}
          onToggleRead={toggleRead}
        />
      ),
    [open, t, toggleRead],
  );

  const toolbar = (
    <View style={styles.toolbar}>
      <PushPermissionCard />
      <View style={styles.tabs}>
        <SegmentedTabs
          testID="inbox-tabs"
          value={tab}
          onChange={setTab}
          tabs={NOTIFICATION_TABS.map(key => ({
            key,
            label: t(TAB_LABEL[key]),
            count: countFor(key),
          }))}
        />
      </View>
      <View style={styles.actions}>
        <Pressable
          testID="inbox-unread-only"
          onPress={() => setUnreadOnly(value => !value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: unreadOnly }}
          accessibilityLabel={t('ntf.unreadOnly')}
          style={[styles.toggle, unreadOnly && styles.toggleOn]}
        >
          <Icon
            name={unreadOnly ? 'check_box' : 'check_box_outline_blank'}
            size={18}
            color={unreadOnly ? colors.onSecondary : colors.secondary}
          />
          <Text
            variant="label"
            color={unreadOnly ? colors.onSecondary : colors.secondary}
          >
            {t('ntf.unreadOnly')}
          </Text>
        </Pressable>
        <Pressable
          testID="inbox-mark-all"
          onPress={() => setConfirmAll(true)}
          disabled={marking || tabUnread === 0}
          accessibilityRole="button"
          accessibilityLabel={t('ntf.markAll')}
          accessibilityState={{ disabled: marking || tabUnread === 0 }}
          style={styles.markAll}
        >
          {marking ? (
            <ActivityIndicator size="small" color={colors.link} />
          ) : (
            <Icon
              name="done_all"
              size={18}
              color={tabUnread === 0 ? colors.outlineVariant : colors.link}
            />
          )}
          <Text
            variant="label"
            color={tabUnread === 0 ? colors.outline : colors.link}
          >
            {t('ntf.markAll')}
          </Text>
        </Pressable>
      </View>
      {offline ? (
        <Banner
          tone="amber"
          icon="cloud_off"
          message={t('ntf.offline')}
          style={styles.banner}
        />
      ) : null}
    </View>
  );

  let empty: React.ReactElement;
  if (list.isPending) {
    empty = (
      <View style={styles.pad} testID="inbox-loading">
        {[0, 1, 2, 3].map(key => (
          <View key={key} style={styles.skeletonRow}>
            <Skeleton width={40} height={40} radius={radii.md} />
            <View style={styles.flex}>
              <Skeleton width="70%" height={14} />
              <Skeleton width="90%" height={12} style={styles.gap} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (list.error && !list.items.length) {
    empty = (
      <EmptyState
        icon="cloud_off"
        title={t('ntf.loadFailed')}
        actionLabel={t('common.tryAgain')}
        onAction={() => {
          void list.refetch();
        }}
      />
    );
  } else if (tab === 'all' && !unreadOnly) {
    empty = (
      <EmptyState
        icon="notifications_off"
        title={t('ntf.emptyTitle')}
        message={t('ntf.emptyBody')}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon="inbox"
        title={unreadOnly ? t('ntf.emptyUnreadTitle') : t('ntf.emptyTabTitle')}
        message={t('ntf.emptyTabBody')}
        actionLabel={t('ntf.showAll')}
        onAction={() => {
          setTab('all');
          setUnreadOnly(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root} testID="screen-inbox">
      <StatusBar barStyle="dark-content" />
      <View style={styles.titleRow}>
        <Text
          variant="h1"
          color={colors.secondary}
          accessibilityRole="header"
          style={styles.flex}
        >
          {t('inbox.title')}
        </Text>
        <Pressable
          testID="inbox-settings"
          onPress={() => navigation.navigate('NotificationSettings')}
          accessibilityRole="button"
          accessibilityLabel={t('ntf.settings')}
          hitSlop={6}
          style={styles.headerButton}
        >
          <Icon name="settings" size={24} color={colors.secondary} />
        </Pressable>
      </View>
      <View style={styles.flex}>
        <FlatList
          ref={listRef}
          testID="inbox-list"
          data={items}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          ListHeaderComponent={toolbar}
          ListEmptyComponent={empty}
          ItemSeparatorComponent={Separator}
          onScroll={onScroll}
          scrollEventThrottle={64}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) {
              void list.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={colors.primary} />
            ) : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={() => {
                void refresh();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.content}
        />
        {newPill ? (
          <Pressable
            testID="inbox-new-pill"
            accessibilityRole="button"
            accessibilityLabel={t('ntf.newPill')}
            onPress={() => {
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
              setNewPill(false);
            }}
            style={styles.pill}
          >
            <Icon name="arrow_upward" size={16} color={colors.onSecondary} />
            <Text variant="label" color={colors.onSecondary}>
              {t('ntf.newPill')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <BottomSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.title}
      >
        <View testID="inbox-row-menu">
          {menuFor && notificationRoute(menuFor) ? (
            <ListRow
              icon="open_in_new"
              label={t('ntf.open')}
              onPress={() => {
                const target = menuFor;
                setMenuFor(null);
                open(target);
              }}
            />
          ) : null}
          <ListRow
            testID="inbox-toggle-read"
            icon={menuFor?.read ? 'mark_email_unread' : 'mark_email_read'}
            label={menuFor?.read ? t('ntf.markUnread') : t('ntf.markRead')}
            onPress={() => {
              const target = menuFor;
              setMenuFor(null);
              if (target) toggleRead(target);
            }}
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={confirmAll}
        title={t('ntf.confirmAll.title')}
        message={
          tab === 'all'
            ? t('ntf.confirmAll.bodyAll')
            : t('ntf.confirmAll.bodyTab', { tab: t(TAB_LABEL[tab]) })
        }
        confirmLabel={t('ntf.markAll')}
        cancelLabel={t('common.cancel')}
        loading={marking}
        onCancel={() => setConfirmAll(false)}
        onConfirm={() => {
          void markAll();
        }}
        testID="inbox-confirm-all"
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <Divider style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pad: { padding: spacing.lg, gap: spacing.md },
  toolbar: { gap: spacing.sm, paddingBottom: spacing.sm },
  tabs: { paddingHorizontal: spacing.lg },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  toggleOn: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
  },
  banner: { marginHorizontal: spacing.lg },
  groupHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    letterSpacing: 0.6,
    backgroundColor: colors.background,
  },
  separator: { marginLeft: 62, backgroundColor: palette.blue100 },
  content: { paddingBottom: spacing.huge },
  footer: { paddingVertical: spacing.lg },
  skeletonRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  gap: { marginTop: spacing.sm },
  pill: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.secondary,
    elevation: 4,
  },
});
