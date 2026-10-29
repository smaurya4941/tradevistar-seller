/**
 * Notification preferences: 15 categories by 4 channels (Email, SMS, Push, In-app), one card per
 * category on a phone. Switches save at once with a spinner each, batched, and snap back with a
 * message if the server refuses.
 *
 * Rules, from the backend: Security and Bank have Email and In-app locked on; Marketing and
 * Analytics start off; Push needs In-app on, and turning In-app off turns Push off; SMS is saved
 * but not sent today (the SMS gateway carries sign-in codes only). Turning Push on asks for the
 * Android notification permission first.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  channelState,
  getNotificationPreferences,
  PREFERENCE_CATEGORIES,
  PREFERENCE_CHANNELS,
  updateNotificationPreferences,
  type PreferenceCategory,
  type PreferenceChannel,
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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { track } from '@/core/analytics/analytics';
import { useSession } from '@/core/auth/SessionProvider';
import { queryKeys } from '@/core/query/queryClient';
import {
  Banner,
  Card,
  colors,
  EmptyState,
  HIT_TARGET,
  Icon,
  ListRow,
  Skeleton,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { PreferenceSaver } from './preferenceSaver';
import { askForPushPermission } from './pushPermissionFlow';

const CATEGORY_LABEL: Record<PreferenceCategory, TranslationKey> = {
  ORDERS: 'prefs.category.ORDERS',
  PAYMENTS: 'prefs.category.PAYMENTS',
  RFQS: 'prefs.category.RFQS',
  BUYER_INQUIRIES: 'prefs.category.BUYER_INQUIRIES',
  MESSAGES: 'prefs.category.MESSAGES',
  PRODUCTS: 'prefs.category.PRODUCTS',
  INVENTORY: 'prefs.category.INVENTORY',
  SHIPMENTS: 'prefs.category.SHIPMENTS',
  VERIFICATION: 'prefs.category.VERIFICATION',
  KYC: 'prefs.category.KYC',
  BANK: 'prefs.category.BANK',
  MARKETING: 'prefs.category.MARKETING',
  ANALYTICS: 'prefs.category.ANALYTICS',
  SECURITY: 'prefs.category.SECURITY',
  ACCOUNT: 'prefs.category.ACCOUNT',
};

const CHANNEL_LABEL: Record<PreferenceChannel, TranslationKey> = {
  EMAIL: 'prefs.channel.EMAIL',
  SMS: 'prefs.channel.SMS',
  PUSH: 'prefs.channel.PUSH',
  IN_APP: 'prefs.channel.IN_APP',
};

const CHANNEL_ICON: Record<PreferenceChannel, string> = {
  EMAIL: 'mail',
  SMS: 'sms',
  PUSH: 'notifications_active',
  IN_APP: 'inbox',
};

export function NotificationSettingsScreen() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();
  const session = useSession();
  const scope = session.status === 'signedIn' ? session.user.id : null;
  const queryKey = useMemo(
    () => [...queryKeys.notificationPreferences, scope] as const,
    [scope],
  );
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getNotificationPreferences(signal),
    enabled: scope !== null,
    staleTime: 60_000,
  });
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;

  const saver = useMemo(
    () =>
      new PreferenceSaver({
        get: () => queryClient.getQueryData(queryKey),
        set: rows => queryClient.setQueryData(queryKey, rows),
        save: changes => updateNotificationPreferences(changes),
        onPending: setPending,
        onError: error => {
          const message =
            error instanceof ApiError && error.code === 'NOTIFICATION_LOCKED'
              ? tRef.current('prefs.error.locked')
              : tRef.current('prefs.error.save');
          toastRef.current.show(message, 'error');
        },
      }),
    [queryClient, queryKey],
  );

  // Anything still waiting to be sent goes out when the screen closes.
  useEffect(
    () => () => {
      void saver.dispose();
    },
    [saver],
  );

  const toggle = useCallback(
    async (
      category: PreferenceCategory,
      channel: PreferenceChannel,
      next: boolean,
    ) => {
      if (channel === 'PUSH' && next) {
        const result = await askForPushPermission();
        if (result !== 'granted') {
          toastRef.current.show(
            tRef.current('prefs.error.pushPermission'),
            'info',
          );
          return;
        }
      }
      const outcome = saver.toggle(category, channel, next);
      if (outcome.kind === 'blocked') {
        toastRef.current.show(
          outcome.reason === 'locked'
            ? tRef.current('prefs.error.locked')
            : tRef.current('prefs.error.needsInApp'),
          'info',
        );
      } else if (outcome.kind === 'queued') {
        track('preferences_changed', { category, channel });
      }
    },
    [saver],
  );

  const rows = query.data;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void query.refetch().finally(() => setRefreshing(false));
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      testID="screen-notification-settings"
    >
      <Banner
        tone="blue"
        icon="info"
        message={t('prefs.smsNote')}
        testID="prefs-sms-note"
      />
      {rows === undefined ? (
        query.isError ? (
          <EmptyState
            icon="cloud_off"
            title={t('prefs.loadFailed')}
            actionLabel={t('common.tryAgain')}
            onAction={() => {
              void query.refetch();
            }}
          />
        ) : (
          <View style={styles.stack} testID="prefs-loading">
            {[0, 1, 2].map(index => (
              <Skeleton key={index} height={190} />
            ))}
          </View>
        )
      ) : (
        PREFERENCE_CATEGORIES.map(category => (
          <Card key={category} style={styles.card} testID={`prefs-${category}`}>
            <Text variant="section" accessibilityRole="header">
              {t(CATEGORY_LABEL[category])}
            </Text>
            {PREFERENCE_CHANNELS.map(channel => {
              const state = channelState(rows, category, channel);
              const inApp = channelState(rows, category, 'IN_APP').enabled;
              const needsInApp = channel === 'PUSH' && !inApp && !state.enabled;
              const busy = pending.has(`${category}.${channel}`);
              const label = t(CHANNEL_LABEL[channel]);
              return (
                <View
                  key={channel}
                  style={styles.switchRow}
                  testID={`pref-${category}-${channel}`}
                >
                  <Icon
                    name={CHANNEL_ICON[channel]}
                    size={20}
                    color={colors.secondary}
                  />
                  <View style={styles.flex}>
                    <Text variant="label">{label}</Text>
                    {state.locked ? (
                      <Text variant="small" color={colors.textMuted}>
                        {t('prefs.alwaysOn')}
                      </Text>
                    ) : needsInApp ? (
                      <Text variant="small" color={colors.textMuted}>
                        {t('prefs.needsInApp')}
                      </Text>
                    ) : null}
                  </View>
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      testID={`pref-spinner-${category}-${channel}`}
                    />
                  ) : state.locked ? (
                    <Icon
                      name="lock"
                      size={20}
                      color={colors.outline}
                      accessibilityLabel={t('prefs.locked')}
                    />
                  ) : null}
                  <Switch
                    value={state.enabled}
                    disabled={state.locked || needsInApp}
                    onValueChange={next => {
                      void toggle(category, channel, next);
                    }}
                    accessibilityRole="switch"
                    accessibilityLabel={`${t(
                      CATEGORY_LABEL[category],
                    )}, ${label}`}
                    accessibilityState={{
                      checked: state.enabled,
                      disabled: state.locked || needsInApp,
                      busy,
                    }}
                    trackColor={{
                      false: colors.outlineVariant,
                      true: colors.primary,
                    }}
                    thumbColor={colors.surface}
                    testID={`switch-${category}-${channel}`}
                  />
                </View>
              );
            })}
          </Card>
        ))
      )}
      <Card style={styles.linkCard}>
        <ListRow
          testID="prefs-open-communication"
          icon="forum"
          label={t('prefs.communication')}
          description={t('prefs.communication.body')}
          onPress={() =>
            (navigation.navigate as (name: string) => void)(
              'CommunicationSettings',
            )
          }
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.huge,
  },
  stack: { gap: spacing.md },
  flex: { flex: 1 },
  card: { gap: spacing.xs },
  linkCard: { paddingVertical: spacing.xs },
  switchRow: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
