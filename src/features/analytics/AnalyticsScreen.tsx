/**
 * Analytics: revenue, orders, quotations, buyers and the catalog over the last 3, 6 or 12 months.
 *
 * The plan gate is a UI rule: the API still returns the revenue and order series on a plan without
 * Insights & Analytics and only withholds the top products and insights, so the app asks the
 * subscription usage first and shows a locked state when the feature is not included.
 *
 * Two web quirks are kept and labelled honestly: the change figures compare the earlier and later
 * halves of the selected window (not the true previous period), and the catalog mix and quote
 * figures read only the first 100 products and quotes.
 */
import { useQuery } from '@tanstack/react-query';
import {
  ANALYTICS_PERIODS,
  formatCompactRupees,
  formatCompactTick,
  formatRupees,
  getSubscriptionUsage,
  listCatalogProducts,
  listQuoteRecords,
  ORDER_STATUS_SERIES,
  performanceCsv,
  planIncludesInsights,
  type AnalyticsPeriod,
} from '@tradevistar/seller-api';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { openRoute } from '@/app/navigation/openHref';
import { track } from '@/core/analytics/analytics';
import { useSession } from '@/core/auth/SessionProvider';
import { queryKeys } from '@/core/query/queryClient';
import {
  Button,
  Card,
  colors,
  DonutChart,
  EmptyState,
  Icon,
  palette,
  RankedBars,
  SalesChart,
  SegmentedTabs,
  Skeleton,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { CardError } from '../home/components/HomeCard';
import { useDashboardSummary } from '../home/useHomeData';
import { ExportCancelled, shareCsv } from './exportCsv';
import { analyticsMetrics, signedPercent } from './metrics';
import {
  catalogSummary,
  quoteSummary,
  salesSummary,
  topProductsSummary,
} from './summaries';

const SERIES = ORDER_STATUS_SERIES;

function useUsage() {
  const session = useSession();
  const scope = session.status === 'signedIn' ? session.user.id : null;
  return useQuery({
    queryKey: [...queryKeys.dashboard, 'usage', scope],
    queryFn: ({ signal }) => getSubscriptionUsage(signal),
    enabled: scope !== null,
    staleTime: 60_000,
  });
}

export function AnalyticsScreen() {
  const usage = useUsage();

  if (usage.data === undefined) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.root}>
        {usage.isError ? (
          <Card>
            <CardError
              onRetry={() => {
                void usage.refetch();
              }}
            />
          </Card>
        ) : (
          <AnalyticsSkeleton />
        )}
      </ScrollView>
    );
  }

  if (!planIncludesInsights(usage.data)) return <LockedAnalytics />;
  return <AnalyticsContent />;
}

function LockedAnalytics() {
  const t = useT();
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.root}
      testID="analytics-locked"
    >
      <Card>
        <EmptyState
          icon="lock"
          title={t('analytics.locked.title')}
          message={t('analytics.locked.body')}
          actionLabel={t('analytics.locked.action')}
          onAction={() =>
            openRoute({
              name: 'Section',
              params: { sectionId: 'subscription' },
            })
          }
        />
      </Card>
    </ScrollView>
  );
}

function AnalyticsSkeleton() {
  return (
    <View style={styles.stack} testID="analytics-skeleton">
      <Skeleton height={48} />
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={96} width="48%" />
        ))}
      </View>
      <Skeleton height={240} />
    </View>
  );
}

function AnalyticsContent() {
  const t = useT();
  const toast = useToast();
  const [period, setPeriod] = useState<AnalyticsPeriod>(6);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dashboard = useDashboardSummary();
  const products = useQuery({
    queryKey: [...queryKeys.dashboard, 'analytics-products'],
    queryFn: ({ signal }) =>
      listCatalogProducts({ page: 1, limit: 100 }, signal),
    staleTime: 60_000,
  });
  const quotes = useQuery({
    queryKey: [...queryKeys.dashboard, 'analytics-quotes'],
    queryFn: ({ signal }) => listQuoteRecords({ page: 1, limit: 100 }, signal),
    staleTime: 60_000,
  });

  const metrics = useMemo(
    () =>
      dashboard.data
        ? analyticsMetrics({
            dashboard: dashboard.data,
            products: products.data?.items ?? [],
            productsTotal: products.data?.meta.total ?? 0,
            quotes: quotes.data?.items ?? [],
            months: period,
          })
        : null,
    [dashboard.data, products.data, quotes.data, period],
  );

  const choosePeriod = useCallback((next: AnalyticsPeriod) => {
    setPeriod(next);
    track('analytics_viewed', { period: next });
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dashboard.refetch(),
        products.refetch(),
        quotes.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dashboard, products, quotes]);

  React.useEffect(() => {
    track('analytics_viewed', { period: 6 });
    // Once per visit; later period changes report themselves.
  }, []);

  if (!dashboard.data || !metrics) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.root}>
        {dashboard.isError ? (
          <Card>
            <CardError
              onRetry={() => {
                void dashboard.refetch();
              }}
            />
          </Card>
        ) : (
          <AnalyticsSkeleton />
        )}
      </ScrollView>
    );
  }

  const supportingFailed = products.isError || quotes.isError;
  const {
    points,
    outcome,
    categories,
    revenue,
    orders,
    revenueChange,
    ordersChange,
  } = metrics;

  const exportReport = async () => {
    setExporting(true);
    try {
      await shareCsv(
        `seller-analytics-${period}-months`,
        performanceCsv(points),
      );
    } catch (error) {
      if (!(error instanceof ExportCancelled)) {
        toast.show(t('analytics.export.failed'), 'error');
      }
    } finally {
      setExporting(false);
    }
  };

  const cards = [
    {
      key: 'revenue',
      label: t('analytics.metric.revenue'),
      value: formatCompactRupees(revenue),
      helper: t('analytics.metric.change', {
        change: signedPercent(revenueChange),
      }),
      icon: 'currency_rupee',
      tint: palette.blue700,
      background: palette.blue50,
    },
    {
      key: 'orders',
      label: t('analytics.metric.orders'),
      value: String(orders),
      helper: t('analytics.metric.change', {
        change: signedPercent(ordersChange),
      }),
      icon: 'shopping_cart',
      tint: palette.orange600,
      background: palette.orange50,
    },
    {
      key: 'aov',
      label: t('analytics.metric.aov'),
      value: formatCompactRupees(metrics.averageOrderValue),
      helper: t('analytics.metric.aov.helper'),
      icon: 'bar_chart',
      tint: palette.amber700,
      background: palette.amber100,
    },
    {
      key: 'conversion',
      label: t('analytics.metric.conversion'),
      value: `${outcome.winRate}%`,
      helper: t('analytics.metric.conversion.helper', {
        won: outcome.won,
        total: outcome.total,
      }),
      icon: 'percent',
      tint: palette.green700,
      background: palette.green50,
    },
    {
      key: 'buyers',
      label: t('analytics.metric.buyers'),
      value: String(metrics.uniqueBuyers),
      helper: t('analytics.metric.buyers.helper'),
      icon: 'group',
      tint: palette.blue700,
      background: palette.blue50,
    },
    {
      key: 'products',
      label: t('analytics.metric.products'),
      value: `${metrics.activeProducts}/${metrics.totalProducts}`,
      helper: t('analytics.metric.products.helper'),
      icon: 'inventory_2',
      tint: colors.secondary,
      background: palette.slate100,
    },
  ];

  const segments = [
    {
      key: 'open',
      label: t('analytics.quote.open'),
      value: outcome.open,
      color: SERIES[0],
    },
    {
      key: 'won',
      label: t('analytics.quote.won'),
      value: outcome.won,
      color: SERIES[2],
    },
    {
      key: 'lost',
      label: t('analytics.quote.lost'),
      value: outcome.lost,
      color: SERIES[1],
    },
    {
      key: 'expired',
      label: t('analytics.quote.expired'),
      value: outcome.expiredOrWithdrawn,
      color: '#8A94A6',
    },
  ];

  const insight =
    dashboard.data.aiInsights?.priceOptimization ??
    t('analytics.insight.default');
  const topProducts = dashboard.data.topProducts;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void refresh();
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      testID="analytics-screen"
    >
      <SegmentedTabs
        testID="analytics-period"
        value={String(period) as '3' | '6' | '12'}
        onChange={key => choosePeriod(Number(key) as AnalyticsPeriod)}
        tabs={ANALYTICS_PERIODS.map(months => ({
          key: String(months) as '3' | '6' | '12',
          label: t('analytics.period', { months }),
        }))}
      />
      <Button
        label={t('analytics.export')}
        icon="download"
        variant="outline"
        loading={exporting}
        disabled={!points.length}
        onPress={() => {
          void exportReport();
        }}
        testID="analytics-export"
      />

      {supportingFailed ? (
        <Card style={styles.warning}>
          <Icon name="warning" size={18} color={palette.amber700} />
          <Text variant="meta" style={styles.flex}>
            {t('analytics.partial')}
          </Text>
        </Card>
      ) : null}

      <View style={styles.grid} accessibilityLabel={t('analytics.metrics')}>
        {cards.map(card => (
          <View
            key={card.key}
            style={styles.metric}
            accessible
            accessibilityLabel={`${card.label}: ${card.value}, ${card.helper}`}
            testID={`metric-${card.key}`}
          >
            <View
              style={[styles.metricIcon, { backgroundColor: card.background }]}
            >
              <Icon name={card.icon} size={18} color={card.tint} />
            </View>
            <Text variant="small" color={colors.textMuted} numberOfLines={2}>
              {card.label}
            </Text>
            <Text variant="stat" numberOfLines={1} adjustsFontSizeToFit>
              {card.value}
            </Text>
            <Text variant="small" color={colors.textMuted} numberOfLines={2}>
              {card.helper}
            </Text>
          </View>
        ))}
      </View>

      <Card>
        <Text variant="section" accessibilityRole="header">
          {t('analytics.sales.title')}
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          {t('analytics.sales.subtitle')}
        </Text>
        <SalesChart
          data={points.map(p => ({
            label: p.label,
            revenue: p.revenue,
            orders: p.orders,
          }))}
          revenueColor={SERIES[0]}
          ordersColor={SERIES[1]}
          formatRevenue={formatRupees}
          tickRevenue={formatCompactTick}
          revenueLabel={t('analytics.metric.revenue')}
          ordersLabel={t('analytics.metric.orders')}
          summary={salesSummary(t, points, period)}
          hint={t('chart.tapHint')}
          testID="chart-sales"
        />
      </Card>

      <Card>
        <Text variant="section" accessibilityRole="header">
          {t('analytics.quote.title')}
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          {t('analytics.quote.subtitle')}
        </Text>
        <DonutChart
          segments={segments}
          centerValue={`${outcome.winRate}%`}
          centerLabel={t('analytics.quote.winRate')}
          summary={quoteSummary(t, outcome)}
          testID="chart-quotes"
        />
        <Text variant="small" color={colors.textMuted}>
          {t('analytics.limit.note')}
        </Text>
      </Card>

      <Card>
        <Text variant="section" accessibilityRole="header">
          {t('analytics.top.title')}
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          {t('analytics.top.subtitle')}
        </Text>
        {topProducts.length ? (
          <RankedBars
            rows={topProducts.map(product => ({
              key: product.name,
              label: product.name,
              value: product.revenue,
              valueLabel: formatCompactRupees(product.revenue),
              detail: t('analytics.top.orders', { orders: product.orders }),
            }))}
            color={SERIES[0]}
            summary={topProductsSummary(t, topProducts)}
            testID="chart-top-products"
          />
        ) : (
          <Text variant="meta" color={colors.textMuted}>
            {t('analytics.top.empty')}
          </Text>
        )}
      </Card>

      <Card>
        <Text variant="section" accessibilityRole="header">
          {t('analytics.catalog.title')}
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          {t('analytics.catalog.subtitle')}
        </Text>
        {categories.length ? (
          <RankedBars
            rows={categories.map(category => ({
              key: category.name,
              label: category.name,
              value: category.count,
              valueLabel: String(category.count),
            }))}
            color={SERIES[1]}
            summary={catalogSummary(t, categories)}
            testID="chart-catalog"
          />
        ) : (
          <Text variant="meta" color={colors.textMuted}>
            {t('analytics.catalog.empty')}
          </Text>
        )}
        <Text variant="small" color={colors.textMuted}>
          {t('analytics.limit.note')}
        </Text>
      </Card>

      <Card>
        <Text variant="section" accessibilityRole="header">
          {t('analytics.funnel.title')}
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          {t('analytics.funnel.subtitle')}
        </Text>
        <View style={styles.grid}>
          {[
            ['sent', t('analytics.funnel.sent'), outcome.total],
            ['open', t('analytics.funnel.open'), outcome.open],
            ['won', t('analytics.funnel.won'), outcome.won],
            [
              'countries',
              t('analytics.funnel.countries'),
              metrics.countriesServed,
            ],
          ].map(([key, label, value]) => (
            <View
              key={String(key)}
              style={styles.funnel}
              accessible
              accessibilityLabel={`${label}: ${value}`}
              testID={`funnel-${key}`}
            >
              <Text variant="stat">{String(value)}</Text>
              <Text variant="small" color={colors.textMuted} align="center">
                {String(label)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.insight}>
        <View style={styles.insightHead}>
          <Icon name="auto_awesome" size={20} color={palette.blue700} />
          <Text variant="section" accessibilityRole="header">
            {t('analytics.insight.title')}
          </Text>
        </View>
        <Text variant="body" testID="analytics-insight">
          {insight}
        </Text>
        <Button
          label={t('analytics.insight.action')}
          variant="ghost"
          size="sm"
          onPress={() =>
            openRoute({ name: 'Main', params: { screen: 'Products' } })
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
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  stack: { gap: spacing.lg },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  funnel: {
    flexGrow: 1,
    flexBasis: '47%',
    alignItems: 'center',
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.amber50,
  },
  insight: { gap: spacing.sm, backgroundColor: palette.blue50 },
  insightHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
