/**
 * The tax record's change history, 10 at a time: what changed, who changed it ("TradeVistar
 * (system)" for imports and verification results), when, and a from-to table per field.
 */
import {
  formatDateTime,
  formatTaxHistoryValue,
  TAX_FIELD_LABELS,
  type TaxHistoryEntry,
} from '@tradevistar/seller-api';
import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, colors, EmptyState, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { StateBadge } from './components/StateBadge';
import { useTaxHistory } from './data';

export function TaxHistoryScreen() {
  const t = useT();
  const query = useTaxHistory();
  return (
    <View style={styles.root} testID="screen-tax-history">
      <SecureScreen />
      <FlatList
        data={query.items}
        keyExtractor={entry => entry.id}
        contentContainerStyle={styles.content}
        refreshing={query.isRefetching}
        onRefresh={() => {
          void query.refetch();
        }}
        ListHeaderComponent={
          query.data === undefined ? (
            <LoadGate query={query}>{() => null}</LoadGate>
          ) : undefined
        }
        ListEmptyComponent={
          query.data !== undefined ? (
            <EmptyState
              icon="history"
              title={t('tax.history.emptyTitle')}
              message={t('tax.history.emptyBody')}
            />
          ) : undefined
        }
        renderItem={({ item }) => <HistoryCard entry={item} />}
        ListFooterComponent={
          query.hasNextPage ? (
            <Button
              label={
                query.isFetchingNextPage
                  ? t('common.loading')
                  : t('tax.history.more')
              }
              variant="outline"
              onPress={() => {
                void query.fetchNextPage();
              }}
              disabled={query.isFetchingNextPage}
              testID="tax-history-more"
            />
          ) : query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.secondary} />
          ) : undefined
        }
        ItemSeparatorComponent={Gap}
      />
    </View>
  );
}

function HistoryCard({ entry }: { entry: TaxHistoryEntry }) {
  const t = useT();
  return (
    <Card style={styles.card} testID={`tax-history-${entry.id}`}>
      <View style={styles.head}>
        <Text variant="cardTitle" style={styles.flex}>
          {entry.summary ?? entry.action}
        </Text>
        {entry.status ? <StateBadge state={entry.status} /> : null}
      </View>
      <Text variant="small" color={colors.textMuted}>
        {t('tax.history.by', {
          actor: entry.actor?.name ?? t('tax.history.system'),
          time: formatDateTime(entry.at),
        })}
      </Text>
      {entry.changes.map(change => (
        <View key={change.field} style={styles.change}>
          <Text variant="label">
            {TAX_FIELD_LABELS[change.field] ?? change.field}
          </Text>
          <Text variant="meta" color={colors.textMuted}>
            {formatTaxHistoryValue(change.from)} →{' '}
            {formatTaxHistoryValue(change.to)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const Gap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  change: { gap: spacing.xxs },
  gap: { height: spacing.md },
});
