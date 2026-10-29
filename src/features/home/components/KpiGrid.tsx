/**
 * Eight key figures in two columns. Each carries a plain caption of what it counts; unlike the web
 * there are no up/down trend arrows, because the API sends no trend to back them.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  formatCompactRupees,
  type SellerDashboard,
} from '@tradevistar/seller-api';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, colors, Icon, radii, spacing, Text } from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { CardError, CardSkeleton } from './HomeCard';

interface Kpi {
  key: string;
  label: TranslationKey;
  caption: TranslationKey;
  icon: string;
  value: string;
}

export function kpiList(kpis: SellerDashboard['kpis']): Kpi[] {
  return [
    {
      key: 'products',
      label: 'home.kpi.products',
      caption: 'home.kpi.products.caption',
      icon: 'inventory_2',
      value: String(kpis.totalProducts),
    },
    {
      key: 'buyers',
      label: 'home.kpi.buyers',
      caption: 'home.kpi.buyers.caption',
      icon: 'verified_user',
      value: String(kpis.verifiedBuyers),
    },
    {
      key: 'rfqs',
      label: 'home.kpi.rfqs',
      caption: 'home.kpi.rfqs.caption',
      icon: 'description',
      value: String(kpis.newRfqs),
    },
    {
      key: 'quotes',
      label: 'home.kpi.quotes',
      caption: 'home.kpi.quotes.caption',
      icon: 'request_quote',
      value: String(kpis.pendingQuotations),
    },
    {
      key: 'orders',
      label: 'home.kpi.orders',
      caption: 'home.kpi.orders.caption',
      icon: 'shopping_cart',
      value: String(kpis.orders),
    },
    {
      key: 'revenue',
      label: 'home.kpi.revenue',
      caption: 'home.kpi.revenue.caption',
      icon: 'currency_rupee',
      value: formatCompactRupees(kpis.revenue),
    },
    {
      key: 'countries',
      label: 'home.kpi.countries',
      caption: 'home.kpi.countries.caption',
      icon: 'public',
      value: String(kpis.countriesServed),
    },
    {
      key: 'profile',
      label: 'home.kpi.profile',
      caption: 'home.kpi.profile.caption',
      icon: 'person',
      value: `${Math.round(kpis.profileCompletion)}%`,
    },
  ];
}

export function KpiGrid({ query }: { query: UseQueryResult<SellerDashboard> }) {
  const t = useT();
  const { data } = query;
  if (data === undefined) {
    return query.isError ? (
      <Card>
        <CardError
          onRetry={() => {
            void query.refetch();
          }}
        />
      </Card>
    ) : (
      <Card>
        <CardSkeleton rows={4} />
      </Card>
    );
  }
  return (
    <View style={styles.grid} testID="kpi-grid">
      {kpiList(data.kpis).map(kpi => (
        <View
          key={kpi.key}
          style={styles.tile}
          accessible
          accessibilityLabel={`${t(kpi.label)}: ${kpi.value}, ${t(
            kpi.caption,
          )}`}
          testID={`kpi-${kpi.key}`}
        >
          <View style={styles.icon}>
            <Icon name={kpi.icon} size={18} color={colors.secondary} />
          </View>
          <Text variant="stat" numberOfLines={1} adjustsFontSizeToFit>
            {kpi.value}
          </Text>
          <Text variant="label" numberOfLines={2}>
            {t(kpi.label)}
          </Text>
          <Text variant="small" color={colors.textMuted} numberOfLines={1}>
            {t(kpi.caption)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
