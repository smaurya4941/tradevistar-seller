/**
 * One-time client setup, made at app start with `configureApiClient`.
 *
 * A single global configuration, rather than a client object passed around, keeps every endpoint
 * module (and the ~150 call sites that use them) unchanged: they import `api` and it already
 * knows where to send requests and how to keep the session alive.
 */
import { createMemoryTokenStore, type TokenStore } from "./memoryTokenStore";

export type PortalKey = "seller";
export type ClientKind = "web" | "mobile";

/**
 * How the long-lived refresh token travels.
 *
 * - `cookie`: the browser holds it as an httpOnly cookie and sends it with `credentials: include`.
 *   Script can never read it, which is why browsers must keep using this.
 * - `native`: the app holds it itself (in the Keychain) and presents it explicitly. It is sent both
 *   as the portal's refresh cookie header, which the current API reads, and in the request body,
 *   which the mobile auth contract reads once `x-tv-client: mobile` is honoured server-side. A
 *   rotated token is read back from the response body when present, else from `Set-Cookie`.
 */
export type RefreshTransport =
  | { kind: "cookie" }
  | {
      kind: "native";
      getRefreshToken: () => Promise<string | null>;
      setRefreshToken: (token: string | null) => Promise<void>;
    };

/**
 * Why the client gave up on a session; lets the app wipe what it stored and say why.
 *
 * `approval_pending` and `approval_rejected` are a refresh the server refused because the seller's
 * approval was withdrawn (SELLER_APPROVAL_PENDING / SELLER_REJECTED, both 403): they are not an
 * ordinary expiry, so the app shows the approval screen instead of "please sign in again".
 */
export type SessionEndReason =
  | "refresh_rejected"
  | "unauthorized"
  | "role_mismatch"
  | "approval_pending"
  | "approval_rejected";

/** What the server said when it ended the session; the approval screens show `message` as sent. */
export interface SessionEndDetail {
  code?: string;
  message?: string;
}

export interface ApiClientConfig {
  /** "" on web (Next's rewrite proxies `/api`); the absolute API origin on mobile. */
  baseUrl: string;
  portal: PortalKey;
  clientKind: ClientKind;
  /** Sent on every request, e.g. a descriptive User-Agent on mobile. */
  defaultHeaders?: Record<string, string>;
  tokenStore: TokenStore;
  refreshTransport: RefreshTransport;
  /** Mints idempotency keys; must be collision-safe (a UUID v4). */
  randomId: () => string;
  /** Called once when the server has definitively ended the session. */
  onSessionEnded?: (reason: SessionEndReason, detail?: SessionEndDetail) => void;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to `Date.now`. */
  now?: () => number;
}

function fallbackRandomId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Web defaults, so the package behaves exactly like the old client if never configured. */
function defaults(): ApiClientConfig {
  return {
    baseUrl: "",
    portal: "seller",
    clientKind: "web",
    tokenStore: createMemoryTokenStore(),
    refreshTransport: { kind: "cookie" },
    randomId: fallbackRandomId,
  };
}

let current: ApiClientConfig = defaults();

export function configureApiClient(config: ApiClientConfig): void {
  current = { ...config, baseUrl: config.baseUrl.replace(/\/+$/, "") };
}

export function getApiClientConfig(): ApiClientConfig {
  return current;
}

/** Test-only: restores the web defaults between cases. */
export function resetApiClientConfig(): void {
  current = defaults();
}
