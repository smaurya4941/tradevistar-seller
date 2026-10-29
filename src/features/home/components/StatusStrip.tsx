/**
 * The eight order states with their counts, as a row of chips that scrolls sideways. Tapping a
 * state opens the Orders tab with that state as the filter (the Orders screen reads `status`).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  statusCountList,
  type OrderStatusCounts,
} from '@tradevistar/seller-api';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { openRoute } from '@/app/navigation/openHref';
import { colors, HIT_TARGET, radii, Skeleton, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { orderStatusLabel } from '../statusLabels';
import { CardError } from './HomeCard';

export function StatusStrip({
  query,
}: {
  query: UseQueryResult<OrderStatusCounts>;
}) {
  const t = useT();
  const { data } = query;
  if (data === undefined) {
    return query.isError ? (
      <CardError
        onRetry={() => {
          void query.refetch();
        }}
      />
    ) : (
      <View style={styles.row} testID="status-strip-skeleton">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} width={112} height={64} radius={radii.lg} />
        ))}
      </View>
    );
  }
  const list = statusCountList(data);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="status-strip"
    >
      {list.map(entry => {
        const label = orderStatusLabel(t, entry.status);
        return (
          <Pressable
            key={entry.status}
            testID={`status-chip-${entry.status}`}
            accessibilityRole="button"
            accessibilityLabel={t('home.status.chip', {
              label,
              count: entry.count,
            })}
            onPress={() =>
              openRoute({
                name: 'Main',
                params: { screen: 'Orders', query: { status: entry.status } },
              })
            }
            style={({ pressed }) => [
              styles.chip,
              pressed && { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <View style={styles.top}>
              <View style={[styles.dot, { backgroundColor: entry.color }]} />
              <Text variant="stat" style={styles.count}>
                {entry.count}
              </Text>
            </View>
            <Text variant="small" color={colors.textMuted} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minWidth: 112,
    minHeight: HIT_TARGET + 16,
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  count: { fontSize: 22, lineHeight: 28 },
});
