/**
 * Home: how the business is doing, in the order a phone reads it — greeting, order states,
 * wallet, analytics (when the plan has them), key figures, shortcuts, then the activity lists.
 *
 * Each card has its own query, skeleton and error state. The headline queries (status counts,
 * wallet, dashboard) start first and the lists follow. Pull to refresh reloads everything, and
 * coming back to the screen after more than 30 seconds does too. Offline, the last good answers
 * are shown with an "Updated <time>" label.
 */
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNetInfo } from '@react-native-community/netinfo';
import { formatCompactRupees } from '@tradevistar/seller-api';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { openRoute } from '@/app/navigation/openHref';
import type { HomeStackParamList } from '@/app/navigation/types';
import { TabScreen } from '@/app/components/TabScreen';
import { track } from '@/core/analytics/analytics';
import { useSession } from '@/core/auth/SessionProvider';
import { relativeLabel } from '@/core/format/relativeTime';
import { isOffline } from '@/core/network/connectivity';
import { useBadge } from '@/core/realtime/liveSnapshot';
import {
  Avatar,
  colors,
  CountBadge,
  HIT_TARGET,
  Icon,
  radii,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { ActivityNote } from './components/ActivityNote';
import {
  InquiryCenterCard,
  RecentOrdersCard,
  ShipmentsCard,
} from './components/ActivityCards';
import { AnalyticsSummary } from './components/AnalyticsSummary';
import { KpiGrid } from './components/KpiGrid';
import { QuickActions } from './components/QuickActions';
import { StatusStrip } from './components/StatusStrip';
import { WalletCard } from './components/WalletCard';
import {
  refreshHome,
  useDashboardSummary,
  useGreetingName,
  useInquiries,
  usePrimarySettled,
  useRecentOrders,
  useRefreshOnFocus,
  useShipments,
  useStatusCounts,
  useWalletSummary,
} from './useHomeData';

function HeaderIcon({
  icon,
  label,
  onPress,
  badge = 0,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: number;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={4}
      style={styles.iconButton}
    >
      <Icon name={icon} size={24} color={colors.secondary} />
      <CountBadge count={badge} style={styles.badge} />
    </Pressable>
  );
}

/** The seller's picture (or initials); opens the profile hub. */
function ProfileEntry({ onPress }: { onPress: () => void }) {
  const t = useT();
  const session = useSession();
  const user =
    session.status === 'signedIn' || session.status === 'offline'
      ? session.user
      : null;
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    t('home.profile');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('home.profile')}
      testID="home-profile"
      style={styles.iconButton}
    >
      <Avatar uri={user?.avatarUrl} name={name} size={32} />
    </Pressable>
  );
}

/** The bell: reads only the unread total, so it alone re-renders when that changes. */
function Bell() {
  const t = useT();
  const unread = useBadge('notifications');
  return (
    <HeaderIcon
      icon="notifications"
      testID="home-bell"
      badge={unread}
      label={
        unread > 0 ? t('home.bell.unread', { count: unread }) : t('home.bell')
      }
      onPress={() => openRoute({ name: 'Main', params: { screen: 'Inbox' } })}
    />
  );
}

export function HomeScreen() {
  const t = useT();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const net = useNetInfo();
  const name = useGreetingName();
  const dashboard = useDashboardSummary();
  const statusCounts = useStatusCounts();
  const wallet = useWalletSummary();
  const primarySettled = usePrimarySettled(dashboard, statusCounts, wallet);
  const orders = useRecentOrders(primarySettled);
  const inquiries = useInquiries(primarySettled);
  const shipments = useShipments(primarySettled);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshHome();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onFocus = useRefreshOnFocus(() => {
    void refreshHome();
  });
  useFocusEffect(
    useCallback(() => {
      onFocus();
    }, [onFocus]),
  );
  useFocusEffect(
    useCallback(() => {
      track('home_viewed', {});
    }, []),
  );

  const queries = [
    dashboard,
    statusCounts,
    wallet,
    orders,
    inquiries,
    shipments,
  ];
  const stamps = queries
    .map(query => query.dataUpdatedAt)
    .filter(stamp => stamp > 0);
  const oldest = stamps.length ? Math.min(...stamps) : null;
  const showUpdated =
    oldest !== null &&
    (isOffline(net) || queries.some(query => query.isError && query.data));

  return (
    <TabScreen
      title={t('home.welcome', { name })}
      testID="screen-home"
      refreshing={refreshing}
      onRefresh={() => {
        void refresh();
      }}
      right={
        <View style={styles.actions}>
          <HeaderIcon
            icon="search"
            testID="home-search"
            label={t('home.search')}
            onPress={() => navigation.navigate('Search')}
          />
          <Bell />
          <ProfileEntry onPress={() => navigation.navigate('ProfileHub')} />
        </View>
      }
    >
      {wallet.data ? (
        <Pressable
          onPress={() =>
            openRoute({ name: 'Section', params: { sectionId: 'wallet' } })
          }
          accessibilityRole="button"
          accessibilityLabel={t('home.walletChip.spoken', {
            amount: formatCompactRupees(wallet.data.withdrawableBalance),
          })}
          style={styles.chip}
          testID="home-wallet-chip"
        >
          <Icon
            name="account_balance_wallet"
            size={18}
            color={colors.secondary}
          />
          <Text variant="label" color={colors.secondary}>
            {formatCompactRupees(wallet.data.withdrawableBalance)}
          </Text>
        </Pressable>
      ) : null}
      {showUpdated && oldest !== null ? (
        <ActivityNote
          icon="cloud_off"
          text={t('home.updated', {
            when: relativeLabel(t, new Date(oldest).toISOString()),
          })}
          testID="home-updated"
        />
      ) : null}

      <StatusStrip query={statusCounts} />
      <WalletCard query={wallet} />
      <AnalyticsSummary dashboard={dashboard} statusCounts={statusCounts} />
      <KpiGrid query={dashboard} />
      <QuickActions />
      <RecentOrdersCard query={orders} />
      <InquiryCenterCard query={inquiries} />
      <ShipmentsCard query={shipments} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: 4, right: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
  },
});
