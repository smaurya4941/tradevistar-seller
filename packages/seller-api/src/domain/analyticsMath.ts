/**
 * The arithmetic behind the Analytics screen, ported from the web page (analytics/page.tsx) and
 * kept pure so each rule is tested on its own.
 *
 * Two web quirks are kept on purpose and described honestly in the app:
 * - "vs previous period" compares the first and second half of the selected window
 *   (`halfChange`), not the true previous period;
 * - catalog mix and quote conversion use only the first 100 products and quotes.
 */
import type { CatalogProduct, MonthAmount, MonthCount, QuoteRecord, UsageItem } from "../endpoints/dashboard";

export const ANALYTICS_PERIODS = [3, 6, 12] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const INSIGHTS_FEATURE_KEY = "INSIGHTS_ANALYTICS";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" → "Sep 26". Anything that is not a year-month is returned as it came. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;
  const index = Number(match[2]) - 1;
  if (index < 0 || index > 11) return month;
  return `${MONTHS[index]} ${match[1].slice(2)}`;
}

/** The last `count` entries of a series (the series is oldest first). */
export function lastMonths<T>(series: readonly T[] | null | undefined, count: number): T[] {
  if (!series?.length || count <= 0) return [];
  return series.slice(-count);
}

/** Whole-number percent change; a zero baseline reads as 100% when there is something, else 0. */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/**
 * The web's "previous period": the window split at its midpoint, the earlier half against the
 * later. With an odd length the extra month falls in the later half.
 */
export function halfSplit(values: readonly number[]): { earlier: number; later: number } {
  const midpoint = Math.floor(values.length / 2);
  return { earlier: sum(values.slice(0, midpoint)), later: sum(values.slice(midpoint)) };
}

export function halfChange(values: readonly number[]): number {
  const { earlier, later } = halfSplit(values);
  return percentChange(later, earlier);
}

export function averageOrderValue(revenue: number, orders: number): number {
  return orders > 0 ? Math.round(revenue / orders) : 0;
}

/** The first moment of the window: `months` months before `now`. */
export function periodStart(now: Date, months: number): Date {
  const date = new Date(now.getTime());
  date.setMonth(date.getMonth() - months);
  return date;
}

export function quotesInPeriod(
  quotes: readonly QuoteRecord[] | null | undefined,
  months: number,
  now: Date = new Date(),
): QuoteRecord[] {
  const start = periodStart(now, months).getTime();
  return (quotes ?? []).filter((quote) => new Date(quote.createdAt).getTime() >= start);
}

export interface QuoteOutcome {
  total: number;
  open: number;
  won: number;
  lost: number;
  expiredOrWithdrawn: number;
  /** Whole percent of quotes that were accepted. */
  winRate: number;
}

export function quoteOutcome(quotes: readonly QuoteRecord[]): QuoteOutcome {
  let open = 0;
  let won = 0;
  let lost = 0;
  let expiredOrWithdrawn = 0;
  for (const quote of quotes) {
    switch (quote.status) {
      case "SUBMITTED":
        open += 1;
        break;
      case "ACCEPTED":
        won += 1;
        break;
      case "REJECTED":
        lost += 1;
        break;
      case "EXPIRED":
      case "WITHDRAWN":
        expiredOrWithdrawn += 1;
        break;
      default:
        break;
    }
  }
  const total = quotes.length;
  return { total, open, won, lost, expiredOrWithdrawn, winRate: total ? Math.round((won / total) * 100) : 0 };
}

export interface CategoryShare {
  name: string;
  count: number;
}

export const UNCATEGORIZED = "Uncategorized";

/** Products per category, biggest first; ties keep the order they were first seen. */
export function catalogMix(products: readonly CatalogProduct[] | null | undefined): CategoryShare[] {
  const counts = new Map<string, number>();
  for (const product of products ?? []) {
    const name = product.category?.trim() || UNCATEGORIZED;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export const topCategories = (mix: readonly CategoryShare[], limit = 6): CategoryShare[] => mix.slice(0, limit);

/** Whether the plan includes Insights & Analytics: an `INSIGHTS_ANALYTICS` entry marked included. */
export function planIncludesInsights(usage: readonly UsageItem[] | null | undefined): boolean {
  return Boolean(usage?.some((item) => item.featureKey === INSIGHTS_FEATURE_KEY && item.included));
}

export interface PerformancePoint {
  month: string;
  label: string;
  revenue: number;
  orders: number;
}

/** Revenue and order counts for the same months, joined by month (falling back to position). */
export function performanceSeries(
  revenueByMonth: readonly MonthAmount[],
  ordersByMonth: readonly MonthCount[],
): PerformancePoint[] {
  return revenueByMonth.map((entry, index) => ({
    month: entry.month,
    label: monthLabel(entry.month),
    revenue: entry.amount,
    orders: ordersByMonth.find((order) => order.month === entry.month)?.count ?? ordersByMonth[index]?.count ?? 0,
  }));
}

/** The month with the most of something, for the chart's spoken summary; null for an empty series. */
export function peakOf<T>(items: readonly T[], value: (item: T) => number): T | null {
  let best: T | null = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const next = value(item);
    if (next > bestValue) {
      best = item;
      bestValue = next;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ CSV */

/** One CSV cell: quoted when needed, with a leading formula character neutralised. */
export function csvCell(value: string | number): string {
  let text = String(value);
  // A cell starting with = + - @ would run as a formula in a spreadsheet.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The monthly table as CSV text (header row first, CRLF line ends as spreadsheets expect). */
export function performanceCsv(points: readonly PerformancePoint[]): string {
  const rows = [["Month", "Revenue (INR)", "Orders"], ...points.map((p) => [p.label, p.revenue, p.orders])];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-09" → "September", for a spoken summary; anything else is returned as it came. */
export function monthName(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  const index = match ? Number(match[2]) - 1 : -1;
  return index >= 0 && index < 12 ? MONTH_NAMES[index] : month;
}
