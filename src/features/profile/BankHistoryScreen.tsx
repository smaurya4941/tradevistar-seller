/** The audit trail of one settlement account: what happened to it and when. */
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  BANK_STATUS_LABEL,
  formatDateTime,
  humanizeState,
  type BankAccountEventView,
} from '@tradevistar/seller-api';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { Card, colors, EmptyState, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { useBankHistory } from './data';

export function BankHistoryScreen() {
  const t = useT();
  const { params } = useRoute<RouteProp<SharedScreens, 'BankHistory'>>();
  const query = useBankHistory(params.accountId);
  return (
    <View style={styles.root} testID="screen-bank-history">
      <SecureScreen />
      <LoadGate query={query}>
        {events => (
          <FlatList
            data={events}
            keyExtractor={event => event.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <EmptyState icon="history" title={t('bank.history.empty')} />
            }
            renderItem={({ item }) => <Event event={item} />}
            ItemSeparatorComponent={Gap}
          />
        )}
      </LoadGate>
    </View>
  );
}

function Event({ event }: { event: BankAccountEventView }) {
  const t = useT();
  return (
    <Card style={styles.card}>
      <Text variant="cardTitle">{humanizeState(event.action)}</Text>
      {event.toStatus ? (
        <Text variant="meta" color={colors.textMuted}>
          {event.fromStatus ? `${BANK_STATUS_LABEL[event.fromStatus]} → ` : ''}
          {BANK_STATUS_LABEL[event.toStatus]}
        </Text>
      ) : null}
      <Text variant="small" color={colors.textMuted}>
        {t('bank.history.when', { time: formatDateTime(event.createdAt) })}
      </Text>
    </Card>
  );
}

const Gap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  card: { gap: spacing.xxs },
  gap: { height: spacing.md },
});
