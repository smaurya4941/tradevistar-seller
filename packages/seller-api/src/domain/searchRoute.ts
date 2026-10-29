/**
 * Search results carry web links (`/seller/dashboard/orders?order=<id>`). This reads one into a
 * portal path and its query parameters, which the app maps to a screen and passes along so the
 * target (Phases 5–8) can open the right record:
 *
 *   orders?order=<id>     the order detail          orders?buyer=<id>   orders for one buyer
 *   products?q=<name>     products filtered         inquiries?rfq=<id>  one inquiry
 *   quotations?q=<title>  quotations filtered       rfqs?q=<text>       RFQs filtered
 *   wallet?txn=<id>       one wallet transaction    payments            the payments list
 *
 * A link that is not a plain `/seller/` path is refused, so a crafted result cannot navigate the
 * app anywhere else; the screen then offers "Open on web" instead.
 */
import { safePortalPath } from "./notificationRoute";

export interface SearchDestination {
  /** `/seller/dashboard/orders`, without query or fragment. */
  path: string;
  /** Decoded query parameters; the last value wins when one repeats. */
  query: Record<string, string>;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** `a=1&b=x%20y` as `{ a: "1", b: "x y" }`. Empty values are dropped. */
export function parseQuery(search: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const pair of search.replace(/^\?/, "").split("&")) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split("=");
    const key = decode(rawKey);
    const value = decode(rest.join("="));
    if (key && value) query[key] = value;
  }
  return query;
}

/** A web link to a destination; null for anything that is not a portal path. */
export function searchRoute(href: string | null | undefined): SearchDestination | null {
  const path = safePortalPath(href);
  if (!path) return null;
  const hashAt = path.indexOf("#");
  const withoutHash = hashAt === -1 ? path : path.slice(0, hashAt);
  const queryAt = withoutHash.indexOf("?");
  const pathname = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const search = queryAt === -1 ? "" : withoutHash.slice(queryAt + 1);
  return { path: pathname.replace(/\/+$/, "") || pathname, query: parseQuery(search) };
}
