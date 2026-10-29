/**
 * Account manager: the dedicated TradeVistar contact, when the plan includes one. Name, photo,
 * email and phone (tap to mail or call), working hours, the categories and regions they cover and
 * when they were assigned. FEATURE_NOT_AVAILABLE means the plan does not include a manager.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiError, formatFullDate } from '@tradevistar/seller-api';
import React from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import {
  Avatar,
  Button,
  Card,
  colors,
  EmptyState,
  FeatureLockedBanner,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { useAccountManager } from './data';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function AccountManagerScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const query = useAccountManager();
  const notIncluded =
    query.isError &&
    query.error instanceof ApiError &&
    query.error.code === 'FEATURE_NOT_AVAILABLE';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-account-manager"
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    >
      {notIncluded ? (
        <FeatureLockedBanner
          kind="featureLocked"
          title={t('manager.locked.title')}
          message={t('manager.locked.body')}
          actionLabel={t('manager.locked.plans')}
          onAction={() =>
            navigation.navigate('Section', { sectionId: 'subscription' })
          }
          testID="manager-locked"
        />
      ) : (
        <LoadGate query={query}>
          {manager =>
            manager === null ? (
              <EmptyState
                icon="support_agent"
                title={t('manager.none.title')}
                message={t('manager.none')}
              />
            ) : (
              <Card style={styles.card} testID="manager-card">
                <View style={styles.row}>
                  <Avatar
                    uri={manager.photoUrl}
                    name={manager.fullName}
                    size={64}
                  />
                  <View style={styles.flex}>
                    <Text variant="h3">{manager.fullName}</Text>
                    <Text variant="small" color={colors.textMuted}>
                      {t('manager.since', {
                        date: formatFullDate(manager.assignedSince),
                      })}
                    </Text>
                  </View>
                </View>
                <Button
                  label={manager.email}
                  icon="mail"
                  variant="outline"
                  onPress={() => {
                    void Linking.openURL(`mailto:${manager.email}`);
                  }}
                  testID="manager-email"
                />
                {manager.phone ? (
                  <Button
                    label={manager.phone}
                    icon="call"
                    variant="outline"
                    onPress={() => {
                      void Linking.openURL(`tel:${manager.phone}`);
                    }}
                    testID="manager-phone"
                  />
                ) : null}
                {manager.workingHours ? (
                  <Detail
                    label={t('manager.hours')}
                    value={manager.workingHours}
                  />
                ) : null}
                {manager.supportedCategories.length > 0 ? (
                  <Detail
                    label={t('manager.categories')}
                    value={manager.supportedCategories.join(', ')}
                  />
                ) : null}
                {manager.supportedRegions.length > 0 ? (
                  <Detail
                    label={t('manager.regions')}
                    value={manager.supportedRegions.join(', ')}
                  />
                ) : null}
              </Card>
            )
          }
        </LoadGate>
      )}
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  flex: { flex: 1 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detail: { gap: spacing.xxs },
});
