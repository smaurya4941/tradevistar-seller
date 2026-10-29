/**
 * Everything the Analytics screen shows, worked out in one pure function from the three reads it
 * makes: the dashboard (12 monthly points and the KPIs), the first page of products and the first
 * page of quotes. Kept apart from the screen so each number is tested on its own.
 *
 * "Earlier half" is the web's "previous period": the selected window split at its midpoint. The
 * catalog mix and the quote figures only see the first 100 products and quotes (the web's limit).
 */
import {
  averageOrderValue,
  catalogMix,
  halfChange,
  lastMonths,
  performanceSeries,
  quoteOutcome,
  quotesInPeriod,
  topCategories,
  type CatalogProduct,
  type CategoryShare,
  type PerformancePoint,
  type QuoteOutcome,
  type QuoteRecord,
  type SellerDashboard,
} from '@tradevistar/seller-api';

export interface AnalyticsInput {
  dashboard: SellerDashboard;
  products: readonly CatalogProduct[];
  /** The total the products list reports, which can exceed the page that was read. */
  productsTotal: number;
  quotes: readonly QuoteRecord[];
  months: number;
  now?: Date;
}

export interface AnalyticsMetrics {
  points: PerformancePoint[];
  revenue: number;
  orders: number;
  revenueChange: number;
  ordersChange: number;
  averageOrderValue: number;
  outcome: QuoteOutcome;
  uniqueBuyers: number;
  activeProducts: number;
  totalProducts: number;
  categories: CategoryShare[];
  countriesServed: number;
}

export function analyticsMetrics(input: AnalyticsInput): AnalyticsMetrics {
  const { dashboard, products, quotes, months, now } = input;
  const revenueSeries = lastMonths(dashboard.revenueByMonth, months);
  const orderSeries = lastMonths(dashboard.ordersByMonth, months);
  const points = performanceSeries(revenueSeries, orderSeries);
  const revenue = points.reduce((sum, p) => sum + p.revenue, 0);
  const orders = points.reduce((sum, p) => sum + p.orders, 0);
  return {
    points,
    revenue,
    orders,
    revenueChange: halfChange(points.map(p => p.revenue)),
    ordersChange: halfChange(points.map(p => p.orders)),
    averageOrderValue: averageOrderValue(revenue, orders),
    outcome: quoteOutcome(quotesInPeriod(quotes, months, now)),
    uniqueBuyers: dashboard.kpis.verifiedBuyers,
    activeProducts: dashboard.kpis.totalProducts,
    totalProducts: Math.max(input.productsTotal, products.length),
    categories: topCategories(catalogMix(products)),
    countriesServed: dashboard.kpis.countriesServed,
  };
}

/** "+12%" / "-5%" / "0%" with an explicit sign for growth. */
export function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`;
}
