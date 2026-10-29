/**
 * Home's compact analytics: monthly revenue, orders by status, monthly orders and top products,
 * with a link to the full Analytics screen. Shown only when the plan includes Insights &
 * Analytics (`insightsLocked` is false); otherwise a small card points to the plans.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  formatCompactRupees,
  formatCompactTick,
  formatRupees,
  monthLabel,
  ORDER_STATUS_SERIES,
  performanceSeries,
  statusCountList,
  type OrderStatusCounts,
  type SellerDashboard,
} from '@tradevistar/seller-api';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { openRoute } from '@/app/navigation/openHref';
import type { HomeStackParamList } from '@/app/navigation/types';
import {
  Button,
  Card,
  ColumnChart,
  colors,
  DonutChart,
  Icon,
  palette,
  RankedBars,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import {
  ordersSummary,
  revenueSummary,
  statusSummary,
  topProductsSummary,
} from '../../analytics/summaries';
import { orderStatusLabel } from '../statusLabels';
import { CardHeader } from './HomeCard';

const SERIES_BLUE = ORDER_STATUS_SERIES[0];
const SERIES_GREEN = ORDER_STATUS_SERIES[2];

export function AnalyticsSummary({
  dashboard,
  statusCounts,
}: {
  dashboard: UseQueryResult<SellerDashboard>;
  statusCounts: UseQueryResult<OrderStatusCounts>;
}) {
  const t = useT();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const data = dashboard.data;
  const points = useMemo(
    () =>
      data ? performanceSeries(data.revenueByMonth, data.ordersByMonth) : [],
    [data],
  );
  const statuses = useMemo(
    () => statusCountList(statusCounts.data),
    [statusCounts.data],
  );

  // Hidden until the plan is known, as on the web.
  if (!data) return null;

  if (data.insightsLocked) {
    return (
      <Card testID="analytics-locked-card" style={styles.card}>
        <View style={styles.lockRow}>
          <View style={styles.lockIcon}>
            <Icon name="lock" size={20} color={palette.orange600} />
          </View>
          <View style={styles.lockText}>
            <Text variant="cardTitle">{t('home.analytics.locked.title')}</Text>
            <Text variant="meta" color={colors.textMuted}>
              {t('home.analytics.locked.body')}
            </Text>
          </View>
        </View>
        <Button
          label={t('home.analytics.locked.action')}
          variant="outline"
          onPress={() =>
            openRoute({
              name: 'Section',
              params: { sectionId: 'subscription' },
            })
          }
          testID="analytics-unlock"
        />
      </Card>
    );
  }

  const revenueTotal = points.reduce((sum, p) => sum + p.revenue, 0);
  const orderTotal = points.reduce((sum, p) => sum + p.orders, 0);
  const statusTotal = statuses.reduce((sum, s) => sum + s.count, 0);
  const months = points.length;

  return (
    <View style={styles.wrap} testID="analytics-section">
      <CardHeader
        title={t('home.analytics.title')}
        actionLabel={t('home.analytics.seeAll')}
        testID="analytics-see-all"
        onAction={() => navigation.navigate('Analytics')}
      />

      <Card style={styles.card}>
        <Text variant="section">{t('home.analytics.revenue')}</Text>
        <Text variant="stat">{formatCompactRupees(revenueTotal)}</Text>
        <ColumnChart
          data={points.map(p => ({ label: p.label, value: p.revenue }))}
          color={SERIES_BLUE}
          format={formatRupees}
          tick={formatCompactTick}
          summary={revenueSummary(t, points, months)}
          hint={t('chart.tapHint')}
          height={170}
          testID="chart-revenue"
        />
        <Text variant="small" color={colors.textMuted}>
          {t('home.analytics.revenue.note')}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="section">{t('home.analytics.status')}</Text>
        <DonutChart
          segments={statuses.map(s => ({
            key: s.status,
            label: orderStatusLabel(t, s.status),
            value: s.count,
            color: s.color,
          }))}
          centerValue={String(statusTotal)}
          centerLabel={t('home.analytics.status.total')}
          summary={statusSummary(t, statuses)}
          hideEmptyInLegend
          testID="chart-status"
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="section">{t('home.analytics.orders')}</Text>
        <Text variant="stat">{orderTotal}</Text>
        <ColumnChart
          data={points.map(p => ({
            label: monthLabel(p.month),
            value: p.orders,
          }))}
          color={SERIES_GREEN}
          format={value => String(value)}
          tick={value => String(value)}
          summary={ordersSummary(t, points, months)}
          hint={t('chart.tapHint')}
          height={170}
          testID="chart-orders"
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="section">{t('home.analytics.top')}</Text>
        {data.topProducts.length ? (
          <RankedBars
            rows={data.topProducts.map(product => ({
              key: product.name,
              label: product.name,
              value: product.revenue,
              valueLabel: formatCompactRupees(product.revenue),
              detail: t('home.analytics.top.detail', {
                orders: product.orders,
                quantity: product.quantity,
              }),
            }))}
            color={SERIES_BLUE}
            summary={topProductsSummary(t, data.topProducts)}
            testID="chart-top-products"
          />
        ) : (
          <Text variant="meta" color={colors.textMuted}>
            {t('home.analytics.top.empty')}
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: { gap: spacing.sm },
  lockRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.orange50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockText: { flex: 1, gap: spacing.xxs },
});
