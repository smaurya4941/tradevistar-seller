/**
 * The read models the Home and Analytics screens need. Each belongs to a later phase (orders,
 * RFQs, shipments, wallet, subscription, products); only the fields Phase 2 reads are described
 * here, in this one file, and those phases extend their own endpoint files. Nothing here writes.
 *
 * Every list endpoint answers `{ items, meta }`; see `getPage`.
 */
import { api } from "../http/client";
import { getPage, qs, type Page } from "./paged";

/* ------------------------------------------------------------------ dashboard */

export type ApprovalStatus = string;

export interface DashboardKpis {
  totalProducts: number;
  verifiedBuyers: number;
  /** RFQs opened in the last 7 days that this seller can quote. */
  newRfqs: number;
  pendingQuotations: number;
  orders: number;
  /** Escrow released to the wallet, after commission. */
  revenue: number;
  countriesServed: number;
  /** 0–100, the same checklist as My Profile. */
  profileCompletion: number;
}

export interface MonthAmount {
  /** `YYYY-MM`. */
  month: string;
  amount: number;
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface TopProduct {
  name: string;
  orders: number;
  quantity: number;
  revenue: number;
}

export interface AiInsights {
  trendingProducts: string[];
  recommendedCategories: string[];
  priceOptimization: string;
  demandForecast: string;
}

export interface SellerDashboard {
  approvalStatus: ApprovalStatus;
  kpis: DashboardKpis;
  /** A rolling 12 months, whatever the plan: only the web hides them when `insightsLocked`. */
  revenueByMonth: MonthAmount[];
  ordersByMonth: MonthCount[];
  /** Empty unless the plan includes Insights & Analytics. */
  topProducts: TopProduct[];
  /** Null unless the plan includes Insights & Analytics. */
  aiInsights: AiInsights | null;
  insightsLocked: boolean;
  commissionPercent: number;
}

export const getSellerDashboard = (signal?: AbortSignal) =>
  api.get<SellerDashboard>("/seller/dashboard", { requireAuth: true, signal });

/* ------------------------------------------------------------------ orders */

/** `{ PENDING: 3, …, total: 12 }`: a count per delivery status and the total. */
export type OrderStatusCounts = Record<string, number>;

export const getOrderStatusCounts = (signal?: AbortSignal) =>
  api.get<OrderStatusCounts>("/seller/orders/status-counts", { requireAuth: true, signal });

export interface RecentOrder {
  id: string;
  orderNumber: string;
  buyer: string;
  amount: number;
  currency?: string;
  deliveryStatus: string;
}

export const listRecentOrders = (limit = 5, signal?: AbortSignal): Promise<Page<RecentOrder>> =>
  getPage<RecentOrder>(`/seller/orders${qs({ limit })}`, { requireAuth: true, signal });

/* ------------------------------------------------------------------ inquiries and shipments */

export interface InquirySummary {
  id: string;
  title: string;
  productName: string;
  quantity: number;
  unit: string;
  urgent: boolean;
  createdAt: string;
}

export const listInquirySummaries = (limit = 8, signal?: AbortSignal): Promise<Page<InquirySummary>> =>
  getPage<InquirySummary>(`/seller/inquiries${qs({ limit })}`, { requireAuth: true, signal });

export interface ShipmentSummary {
  id: string;
  orderNumber: string;
  buyer: string;
  route: string;
  /** Null until a carrier gives one. */
  eta: string | null;
  status: string;
}

export const listShipmentSummaries = (limit = 8, signal?: AbortSignal): Promise<Page<ShipmentSummary>> =>
  getPage<ShipmentSummary>(`/seller/shipments${qs({ limit })}`, { requireAuth: true, signal });

/* ------------------------------------------------------------------ wallet */

export interface WalletSummary {
  withdrawableBalance: number;
  walletBalance: number;
  pendingWithdraw: number;
  totalCommission: number;
  /** Sellers see no commission figures while the admin has commission switched off. */
  commissionEnabled: boolean;
  alreadyWithdrawn: number;
  /** The seller's share still held in escrow ("pending release"). */
  escrowHeld: number;
  currency?: string;
}

export const getWalletSummary = (signal?: AbortSignal) =>
  api.get<WalletSummary>("/seller/wallet", { requireAuth: true, signal });

/* ------------------------------------------------------------------ plan, catalog, quotes */

export interface UsageItem {
  featureKey: string;
  included: boolean;
  label?: string;
}

export const getSubscriptionUsage = (signal?: AbortSignal) =>
  api.get<UsageItem[]>("/seller/subscription/usage", { requireAuth: true, signal });

/** The legacy product list the web analytics page reads; only the category is needed. */
export interface CatalogProduct {
  id?: string;
  category: string | null;
}

export const listCatalogProducts = (
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<CatalogProduct>> =>
  getPage<CatalogProduct>(`/seller/products${qs({ page: params.page ?? 1, limit: params.limit ?? 100 })}`, {
    requireAuth: true,
    signal,
  });

export type QuoteStatus = "SUBMITTED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN" | (string & {});

export interface QuoteRecord {
  id?: string;
  status: QuoteStatus;
  createdAt: string;
}

export const listQuoteRecords = (
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<QuoteRecord>> =>
  getPage<QuoteRecord>(`/seller/quotes${qs({ page: params.page ?? 1, limit: params.limit ?? 100 })}`, {
    requireAuth: true,
    signal,
  });

/* ------------------------------------------------------------------ business name */

/** The saved business profile; Home greets the seller by `companyName`. */
export interface BusinessName {
  companyName: string | null;
}

export const getBusinessName = (signal?: AbortSignal) =>
  api.get<BusinessName>("/sellers/me/business-info", { requireAuth: true, signal });
