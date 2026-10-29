/**
 * Rules for the record-search box and the list the screen builds from the answer. The server
 * refuses a term over 80 characters (`@MaxLength(80)`) and returns nothing under two.
 */
import type { SellerSearchResult, SellerSearchType } from "../endpoints/search";

export const SEARCH_LIMITS = {
  minLength: 2,
  maxLength: 80,
  debounceMs: 300,
  recentMax: 10,
} as const;

/** The groups' order, which is also the order the server builds them. */
export const SEARCH_TYPES: readonly SellerSearchType[] = [
  "ORDER",
  "PRODUCT",
  "BUYER",
  "PAYMENT",
  "RFQ",
  "QUOTATION",
  "SAMPLE",
  "WALLET",
  "PAYOUT",
];

export const SEARCH_TYPE_ICON: Record<SellerSearchType, string> = {
  ORDER: "shopping_bag",
  PRODUCT: "inventory_2",
  BUYER: "person",
  PAYMENT: "payments",
  RFQ: "request_quote",
  QUOTATION: "description",
  SAMPLE: "science",
  WALLET: "account_balance_wallet",
  PAYOUT: "account_balance",
};

/** The text to type into the box: control characters removed and cut to the server's limit. */
export function clampSearchInput(raw: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is removed
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, SEARCH_LIMITS.maxLength);
}

/** The term to send (trimmed, spaces collapsed), or null while it is too short to search. */
export function searchableTerm(raw: string): string | null {
  const term = raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_LIMITS.maxLength).trim();
  return term.length >= SEARCH_LIMITS.minLength ? term : null;
}

export interface SearchGroup {
  type: SellerSearchType;
  results: SellerSearchResult[];
}

/** Results grouped by type in the fixed order, empty groups left out, duplicates dropped. */
export function groupSearchResults(results: readonly SellerSearchResult[]): SearchGroup[] {
  const byType = new Map<SellerSearchType, SellerSearchResult[]>();
  const seen = new Set<string>();
  for (const result of results) {
    const key = `${result.type}:${result.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byType.get(result.type) ?? [];
    list.push(result);
    byType.set(result.type, list);
  }
  return SEARCH_TYPES.filter((type) => byType.has(type)).map((type) => ({ type, results: byType.get(type)! }));
}

/** The recent-search list after using `term`: newest first, case-insensitively unique, capped. */
export function rememberSearch(recent: readonly string[], term: string): string[] {
  const value = term.trim();
  if (!value) return [...recent];
  return [value, ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(
    0,
    SEARCH_LIMITS.recentMax,
  );
}
