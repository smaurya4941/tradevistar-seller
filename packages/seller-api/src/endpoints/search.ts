/**
 * Universal search over the seller's own records (`GET /seller/search?q=`).
 *
 * The server returns at most five rows per type, scopes every row to the signed-in seller, answers
 * an empty list for fewer than two characters, and rejects a term longer than 80. Each row carries
 * a web `href`, which `searchRoute` turns into an app destination.
 */
import { api } from "../http/client";
import { qs } from "./paged";

export type SellerSearchType =
  | "ORDER"
  | "PRODUCT"
  | "BUYER"
  | "PAYMENT"
  | "RFQ"
  | "QUOTATION"
  | "SAMPLE"
  | "WALLET"
  | "PAYOUT";

export interface SellerSearchResult {
  type: SellerSearchType;
  id: string;
  title: string;
  subtitle: string | null;
  /** A seller-portal path with a query, e.g. `/seller/dashboard/orders?order=<id>`. */
  href: string;
}

export const searchSellerRecords = (q: string, signal?: AbortSignal) =>
  api.get<SellerSearchResult[]>(`/seller/search${qs({ q })}`, { requireAuth: true, signal });
