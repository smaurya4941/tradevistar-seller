/**
 * Shared helpers for list endpoints. The API's envelope carries a list in `data` and the page
 * description in `meta`; callers here get both as one `{ items, meta }` value.
 */
import { apiRequest, type ApiFetchOptions } from "../http/client";

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

type QueryValue = string | number | boolean | undefined | null;

/** `?a=1&b=two` from the defined, non-empty values; an empty string when there are none. */
export function qs(params: Record<string, QueryValue>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export function pageMetaOf(raw: unknown, fallbackLength: number): PageMeta {
  const meta = (raw ?? {}) as Partial<PageMeta>;
  return {
    page: meta.page ?? 1,
    limit: meta.limit ?? fallbackLength,
    total: meta.total ?? fallbackLength,
    totalPages: meta.totalPages ?? 1,
  };
}

export async function getPage<T>(path: string, options: ApiFetchOptions = {}): Promise<Page<T>> {
  const result = await apiRequest<T[]>(path, { ...options, method: "GET" });
  const items = Array.isArray(result.data) ? result.data : [];
  return { items, meta: pageMetaOf(result.meta, items.length) };
}
