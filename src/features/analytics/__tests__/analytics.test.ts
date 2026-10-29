import type {
  CatalogProduct,
  QuoteRecord,
  SellerDashboard,
} from '@tradevistar/seller-api';
import {
  formatCompactRupees,
  performanceSeries,
  quoteOutcome,
  statusCountList,
} from '@tradevistar/seller-api';
import { translate } from '@/i18n';
import { csvFileName } from '../exportCsv';
import { analyticsMetrics, signedPercent } from '../metrics';
import {
  catalogSummary,
  ordersSummary,
  quoteSummary,
  revenueSummary,
  salesSummary,
  statusSummary,
  topProductsSummary,
} from '../summaries';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const months = (count: number, start = 2025, from = 10) =>
  Array.from({ length: count }, (_, index) => {
    const total = from - 1 + index;
    const year = start + Math.floor(total / 12);
    const month = (total % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });

const dashboard = (over: Partial<SellerDashboard> = {}): SellerDashboard => {
  const keys = months(12);
  return {
    approvalStatus: 'APPROVED',
    kpis: {
      totalProducts: 42,
      verifiedBuyers: 17,
      newRfqs: 3,
      pendingQuotations: 2,
      orders: 90,
      revenue: 420_000,
      countriesServed: 4,
      profileCompletion: 80,
    },
    revenueByMonth: keys.map((month, index) => ({
      month,
      amount: (index + 1) * 10_000,
    })),
    ordersByMonth: keys.map((month, index) => ({ month, count: index + 1 })),
    topProducts: [
      { name: 'Steel pipe', orders: 9, quantity: 90, revenue: 90_000 },
    ],
    aiInsights: null,
    insightsLocked: false,
    commissionPercent: 2,
    ...over,
  };
};

const products = (categories: (string | null)[]): CatalogProduct[] =>
  categories.map(category => ({ category }));

const quote = (status: string, createdAt: string): QuoteRecord => ({
  status,
  createdAt,
});

describe('analyticsMetrics', () => {
  const now = new Date('2026-09-15T00:00:00Z');

  it('slices the last N months of both series', () => {
    const metrics = analyticsMetrics({
      dashboard: dashboard(),
      products: [],
      productsTotal: 0,
      quotes: [],
      months: 3,
      now,
    });
    expect(metrics.points).toHaveLength(3);
    expect(metrics.revenue).toBe(100_000 + 110_000 + 120_000);
    expect(metrics.orders).toBe(10 + 11 + 12);
  });

  it('compares the earlier and later halves of the window', () => {
    const metrics = analyticsMetrics({
      dashboard: dashboard(),
      products: [],
      productsTotal: 0,
      quotes: [],
      months: 6,
      now,
    });
    // Revenue 70..120 thousand: earlier half 70+80+90, later half 100+110+120.
    expect(metrics.revenueChange).toBe(Math.round(((330 - 240) / 240) * 100));
    expect(signedPercent(metrics.revenueChange)).toBe('+38%');
    expect(signedPercent(-5)).toBe('-5%');
    expect(signedPercent(0)).toBe('0%');
  });

  it('works out the average order value without dividing by zero', () => {
    const empty = analyticsMetrics({
      dashboard: dashboard({ revenueByMonth: [], ordersByMonth: [] }),
      products: [],
      productsTotal: 0,
      quotes: [],
      months: 6,
      now,
    });
    expect(empty.points).toEqual([]);
    expect(empty.averageOrderValue).toBe(0);
    expect(empty.revenueChange).toBe(0);
    const metrics = analyticsMetrics({
      dashboard: dashboard(),
      products: [],
      productsTotal: 0,
      quotes: [],
      months: 3,
      now,
    });
    expect(metrics.averageOrderValue).toBe(Math.round(330_000 / 33));
  });

  it('counts only quotes inside the window and reports the win rate', () => {
    const metrics = analyticsMetrics({
      dashboard: dashboard(),
      products: [],
      productsTotal: 0,
      quotes: [
        quote('ACCEPTED', '2026-08-01T00:00:00Z'),
        quote('REJECTED', '2026-08-02T00:00:00Z'),
        quote('SUBMITTED', '2026-09-01T00:00:00Z'),
        quote('ACCEPTED', '2025-01-01T00:00:00Z'),
      ],
      months: 3,
      now,
    });
    expect(metrics.outcome).toMatchObject({
      total: 3,
      won: 1,
      lost: 1,
      open: 1,
      winRate: 33,
    });
  });

  it('builds the catalog mix from the products it was given, and the active-over-total figure', () => {
    const metrics = analyticsMetrics({
      dashboard: dashboard(),
      products: products(['Steel', 'Steel', 'Rice', null]),
      productsTotal: 250,
      quotes: [],
      months: 6,
      now,
    });
    expect(metrics.categories.map(c => [c.name, c.count])).toEqual([
      ['Steel', 2],
      ['Rice', 1],
      ['Uncategorized', 1],
    ]);
    expect(metrics.activeProducts).toBe(42);
    expect(metrics.totalProducts).toBe(250);
  });
});

describe('chart summaries', () => {
  const points = performanceSeries(
    [
      { month: '2026-08', amount: 100_000 },
      { month: '2026-09', amount: 320_000 },
    ],
    [
      { month: '2026-08', count: 4 },
      { month: '2026-09', count: 9 },
    ],
  );

  it('says the total and the best month, like "Revenue ₹4.2L over 2 months, highest in September"', () => {
    expect(revenueSummary(t, points, 2)).toBe(
      `Revenue ${formatCompactRupees(
        420_000,
      )} over 2 months, highest in September`,
    );
    expect(ordersSummary(t, points, 2)).toBe(
      '13 orders over 2 months, most in September',
    );
    expect(salesSummary(t, points, 2)).toContain('highest in September');
    expect(salesSummary(t, points, 2)).toContain('most in September');
  });

  it('says so when there is nothing to chart', () => {
    expect(revenueSummary(t, [], 6)).toBe('No revenue in the last 6 months');
    expect(ordersSummary(t, [], 6)).toBe('No orders in the last 6 months');
    const zero = performanceSeries(
      [{ month: '2026-08', amount: 0 }],
      [{ month: '2026-08', count: 0 }],
    );
    expect(revenueSummary(t, zero, 1)).toBe('No revenue in the last 1 months');
  });

  it('names each order state with its count', () => {
    const counts = statusCountList({ PENDING: 2, DELIVERED: 6 });
    expect(statusSummary(t, counts)).toBe('8 orders: Pending 2, Delivered 6');
    expect(statusSummary(t, statusCountList(null))).toBe('No orders yet');
  });

  it('summarises quotations, top products and the catalog', () => {
    expect(
      quoteSummary(
        t,
        quoteOutcome([quote('ACCEPTED', 'x'), quote('REJECTED', 'x')]),
      ),
    ).toBe('2 quotations, 1 won, win rate 50 percent');
    expect(quoteSummary(t, quoteOutcome([]))).toBe(
      'No quotations in this period',
    );
    expect(
      topProductsSummary(t, [
        { name: 'Steel pipe', orders: 1, quantity: 1, revenue: 90_000 },
      ]),
    ).toBe('Top 1 products, best seller Steel pipe with ₹90.0K');
    expect(topProductsSummary(t, [])).toBe('No product sales yet');
    expect(catalogSummary(t, [{ name: 'Steel', count: 4 }])).toBe(
      '1 categories, largest Steel with 4 products',
    );
    expect(catalogSummary(t, [])).toBe('No categorized products yet');
  });
});

describe('CSV export', () => {
  it('names the file safely', () => {
    expect(csvFileName('seller-analytics-6-months')).toBe(
      'seller-analytics-6-months.csv',
    );
    expect(csvFileName('a/b\\c:d')).toBe('a-b-c-d.csv');
    expect(csvFileName('   ')).toBe('report.csv');
  });
});
