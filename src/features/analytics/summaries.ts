/**
 * Spoken summaries for the charts, so a screen reader gets the finding instead of a picture:
 * "Revenue ₹4.2L over 6 months, highest in September". Built from the same numbers the chart
 * draws and translated through the message files.
 */
import {
  formatCompactRupees,
  monthName,
  peakOf,
  type PerformancePoint,
  type QuoteOutcome,
  type CategoryShare,
  type StatusCount,
  type TopProduct,
} from '@tradevistar/seller-api';
import type { Translate } from '@/i18n';
import { orderStatusLabel } from '../home/statusLabels';

export function revenueSummary(
  t: Translate,
  points: readonly PerformancePoint[],
  months: number,
): string {
  const total = points.reduce((sum, point) => sum + point.revenue, 0);
  const peak = peakOf(points, point => point.revenue);
  if (!points.length || !peak || peak.revenue <= 0) {
    return t('chart.summary.revenueNone', { months });
  }
  return t('chart.summary.revenue', {
    total: formatCompactRupees(total),
    months,
    month: monthName(peak.month),
  });
}

export function ordersSummary(
  t: Translate,
  points: readonly { month: string; orders: number }[],
  months: number,
): string {
  const total = points.reduce((sum, point) => sum + point.orders, 0);
  const peak = peakOf(points, point => point.orders);
  if (!points.length || !peak || peak.orders <= 0) {
    return t('chart.summary.ordersNone', { months });
  }
  return t('chart.summary.orders', {
    total,
    months,
    month: monthName(peak.month),
  });
}

export function salesSummary(
  t: Translate,
  points: readonly PerformancePoint[],
  months: number,
): string {
  return `${revenueSummary(t, points, months)}. ${ordersSummary(
    t,
    points,
    months,
  )}`;
}

export function statusSummary(
  t: Translate,
  counts: readonly StatusCount[],
): string {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  if (!total) return t('chart.summary.statusNone');
  const parts = counts
    .filter(entry => entry.count > 0)
    .map(entry => `${orderStatusLabel(t, entry.status)} ${entry.count}`)
    .join(', ');
  return t('chart.summary.status', { total, parts });
}

export function quoteSummary(t: Translate, outcome: QuoteOutcome): string {
  if (!outcome.total) return t('chart.summary.quotesNone');
  return t('chart.summary.quotes', {
    total: outcome.total,
    won: outcome.won,
    rate: outcome.winRate,
  });
}

export function topProductsSummary(
  t: Translate,
  products: readonly TopProduct[],
): string {
  if (!products.length) return t('chart.summary.productsNone');
  const first = products[0];
  return t('chart.summary.products', {
    count: products.length,
    name: first.name,
    revenue: formatCompactRupees(first.revenue),
  });
}

export function catalogSummary(
  t: Translate,
  categories: readonly CategoryShare[],
): string {
  if (!categories.length) return t('chart.summary.catalogNone');
  const first = categories[0];
  return t('chart.summary.catalog', {
    count: categories.length,
    name: first.name,
    products: first.count,
  });
}
