/**
 * The HTTP client every endpoint module goes through.
 *
 * Behaviour carried over unchanged from the web client:
 * - an Idempotency-Key on every POST, PUT, PATCH and DELETE;
 * - a refresh 30 s before the access token expires;
 * - one refresh in flight at a time, shared by every caller;
 * - on a 401, one retry after a refresh, then the session is cleared;
 * - the path rule that decides which requests need a signed-in user.
 *
 * What changed is only *where* those rules get their inputs: the base URL, the token store, the
 * refresh-token transport and the id generator all come from `configureApiClient`.
 */
import { emitSellerEvent } from "../events/sellerEvents";
import {
  getApiClientConfig,
  type ApiClientConfig,
  type SessionEndDetail,
  type SessionEndReason,
} from "./config";
import { tokenExpiresAt } from "./jwt";
import { parseSetCookie, refreshCookieName } from "./refreshCookie";
import { getAccessToken, setAccessToken } from "./tokenStore";

export const API_PREFIX = "/api/v1";

/**
 * Names this app on every request so the API reads and writes this portal's own session cookie.
 * Cookies ignore the port, so without it the seller and admin apps on localhost would share one
 * session with the storefront and sign each other out.
 */
const PORTAL_HEADER = "x-tv-portal";
/** Mobile declares itself so the API can return the refresh token in the body instead of a cookie. */
const CLIENT_HEADER = "x-tv-client";

const REFRESH_AHEAD_MS = 30_000;

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = body.code;
    this.details = body.details;
  }

  /** The request never reached the server (offline, DNS, TLS, timeout). */
  get isNetworkError(): boolean {
    return this.statusCode === 0 && this.code === "NETWORK_ERROR";
  }
}

/**
 * A message worth showing a user, pulled out of whatever the API returned.
 *
 * Validation failures arrive as a generic "Request validation failed" with the per-field
 * complaints in `details`, so showing `message` alone tells the user nothing about which
 * field they got wrong. This prefers the specific reasons and falls back to the summary.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  const details = error.details;
  if (Array.isArray(details) && details.length > 0) {
    const lines = details.filter((line): line is string => typeof line === "string");
    if (lines.length > 0) {
      return lines.join(" ");
    }
  }
  return error.message || fallback;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: unknown;
  statusCode?: number;
  error?: ApiErrorBody;
}

export interface ApiResult<T> {
  data: T;
  meta: unknown;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  rawBody?: RequestBody;
  skipAuth?: boolean;
  /** Reject protected requests locally when no session is available. */
  requireAuth?: boolean;
  /** Pin a stable key so retrying the same action de-duplicates server-side. */
  idempotencyKey?: string;
}

/** Whatever `fetch` accepts as a body on the current platform. */
type RequestBody = NonNullable<RequestInit["body"]>;

interface RefreshSession {
  accessToken: string;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Routes that open a session; on native the refresh token they issue must be captured. The
 * two-factor route is one of them: without it the token from a 2FA sign-in would be lost.
 */
const SESSION_ISSUING = /^\/auth\/(login|login\/otp|login\/two-factor)(?:\?|$)/;

/**
 * The only paths a signed-out seller app may call. Almost everything else in the seller API needs
 * a session, so the rule is inverted from the buyer client: anything not listed here is protected.
 */
const PUBLIC_PATHS = new RegExp(
  "^/(?:" +
    [
      "auth/(?:login(?:/otp|/two-factor(?:/resend)?)?|otp/(?:request|verify)|register/seller|forgot-password|reset-password|refresh|gstin/verify)",
      "categories",
      "home-metrics",
      "home-feed",
      "home-banners",
      "cms-banners(?:/[^/?]+/(?:impression|click))?",
      "footer(?:/.*)?",
      "platform/(?:notices|config)",
      "leads",
      "reference/.*",
      "support/(?:categories|faqs(?:/[^/?]+/(?:view|helpful))?|announcements)",
      "onboarding/invitations/prefill",
    ].join("|") +
    ")(?:\\?.*)?$",
);

/** True for a path a signed-out user may call. */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.test(path);
}

const ROLE_NOT_ALLOWED: ApiErrorBody = {
  code: "ROLE_NOT_ALLOWED",
  message: "This account is not a TradeVistar seller account.",
};

const NETWORK_ERROR: ApiErrorBody = {
  code: "NETWORK_ERROR",
  message: "We couldn't reach TradeVistar. Check your connection and try again.",
};

function cfg(): ApiClientConfig {
  return getApiClientConfig();
}

function now(): number {
  return (cfg().now ?? Date.now)();
}

function fetchImpl(): typeof fetch {
  return cfg().fetchImpl ?? fetch;
}

/** Absolute URL for a versioned API path (`/orders` → `<base>/api/v1/orders`). */
export function apiUrl(path: string): string {
  return `${cfg().baseUrl}${API_PREFIX}${path}`;
}

/** Absolute URL for an unversioned server path such as `/health`. */
export function serverUrl(path: string): string {
  return `${cfg().baseUrl}${path}`;
}

/** The headers every request carries: portal, client kind and the app's defaults. */
export function baseHeaders(): Record<string, string> {
  const config = cfg();
  const headers: Record<string, string> = { ...(config.defaultHeaders ?? {}) };
  headers[PORTAL_HEADER] = config.portal;
  if (config.clientKind === "mobile") {
    headers[CLIENT_HEADER] = "mobile";
  }
  return headers;
}

export function newIdempotencyKey(): string {
  return cfg().randomId();
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl()(url, init);
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
}

async function readEnvelope<T>(res: Response): Promise<Envelope<T> | null> {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!isJson) return null;
  try {
    return (await res.json()) as Envelope<T>;
  } catch {
    return null;
  }
}

/**
 * The error for a failed response that carried no API error envelope. A proxy or gateway answers
 * in its own words (an HTML page, a bare 413 for an oversized upload), so the status decides.
 */
function fallbackErrorBody(res: Response, hadEnvelope: boolean): ApiErrorBody {
  if (res.status === 413) {
    return { code: "UPLOAD_TOO_LARGE", message: "That file is too large to upload." };
  }
  if (!hadEnvelope && res.status >= 500) {
    return { code: "GATEWAY_ERROR", message: res.statusText || "The server is unavailable" };
  }
  return { code: "REQUEST_FAILED", message: res.statusText || "Request failed" };
}

/**
 * Stores a refresh token the server just issued or rotated. It must be persisted before the
 * caller continues: if the app died holding only the old token, presenting it again would look
 * like token theft and the server would revoke the whole session family.
 */
async function captureRefreshToken(res: Response, data: unknown): Promise<void> {
  const transport = cfg().refreshTransport;
  if (transport.kind !== "native") return;
  const fromBody =
    data && typeof data === "object" && typeof (data as { refreshToken?: unknown }).refreshToken === "string"
      ? (data as { refreshToken: string }).refreshToken
      : undefined;
  if (fromBody) {
    await transport.setRefreshToken(fromBody);
    return;
  }
  const cookie = parseSetCookie(res.headers.get("set-cookie"), refreshCookieName(cfg().portal));
  if (cookie?.value) {
    await transport.setRefreshToken(cookie.value);
  }
}

/** Keeps the refresh token out of what screens receive; only the transport ever holds it. */
function stripRefreshToken<T>(data: T): T {
  if (data && typeof data === "object" && "refreshToken" in data) {
    const { refreshToken: _token, refreshExpiresAt: _expires, ...rest } = data as Record<string, unknown>;
    return rest as T;
  }
  return data;
}

function endSession(reason: SessionEndReason, detail?: SessionEndDetail): void {
  setAccessToken(null);
  const notify = cfg().onSessionEnded;
  if (detail) notify?.(reason, detail);
  else notify?.(reason);
}

/** A rejected refresh is an approval problem, not an expiry, when the server names it. */
function refreshRejectionReason(code: string): SessionEndReason {
  if (code === "SELLER_APPROVAL_PENDING") return "approval_pending";
  if (code === "SELLER_REJECTED") return "approval_rejected";
  return "refresh_rejected";
}

/** True when a sign-in or refresh payload describes a user without the SELLER role. */
function lacksSellerRole(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const user = (data as { user?: { roles?: unknown } }).user;
  if (!user || !Array.isArray(user.roles)) return false;
  return !user.roles.includes("SELLER");
}

/**
 * A sign-in for the wrong kind of account has already created a server session. Closing it is
 * best-effort: the caller is rejected either way, and the token is never kept locally.
 */
async function revokeRejectedSession(data: unknown): Promise<void> {
  const accessToken = (data as { accessToken?: unknown } | null)?.accessToken;
  if (typeof accessToken !== "string") return;
  try {
    await send(apiUrl("/auth/logout"), {
      method: "POST",
      headers: {
        ...baseHeaders(),
        Authorization: `Bearer ${accessToken}`,
        "Idempotency-Key": newIdempotencyKey(),
      },
      credentials: "omit",
    });
  } catch {
    // The session expires on its own; nothing more to do.
  }
}

let refreshPromise: Promise<RefreshSession> | null = null;
let refreshRequests = 0;

/** How many /auth/refresh requests this launch has sent; Diagnostics uses it to prove single-flight. */
export function refreshRequestCount(): number {
  return refreshRequests;
}

async function performRefresh<T extends RefreshSession>(): Promise<T> {
  const config = cfg();
  const transport = config.refreshTransport;
  const headers: Record<string, string> = baseHeaders();
  let init: RequestInit;

  if (transport.kind === "native") {
    const refreshToken = await transport.getRefreshToken();
    if (!refreshToken) {
      setAccessToken(null);
      throw new ApiError(401, { code: "NO_REFRESH_TOKEN", message: "Please sign in to continue" });
    }
    headers["Content-Type"] = "application/json";
    headers.Cookie = `${refreshCookieName(config.portal)}=${refreshToken}`;
    headers["x-refresh-token"] = refreshToken;
    // `omit` keeps the platform cookie jar out of it, so exactly this token is presented.
    init = { method: "POST", headers, body: JSON.stringify({ refreshToken }), credentials: "omit" };
  } else {
    init = { method: "POST", headers, credentials: "include" };
  }

  let res: Response;
  try {
    refreshRequests += 1;
    res = await send(apiUrl("/auth/refresh"), init);
  } catch (error) {
    // Offline is not signed out: the stored refresh token stays for the next attempt.
    setAccessToken(null);
    throw error;
  }
  const payload = await readEnvelope<T>(res);

  if (!res.ok || !payload?.success || !payload.data?.accessToken) {
    const errorBody: ApiErrorBody = payload?.error ?? {
      code: "SESSION_REFRESH_FAILED",
      message: res.statusText || "Session refresh failed",
    };
    // 401/403 mean the server rejected the token for good; 429 and 5xx are worth retrying later.
    if (res.status === 401 || res.status === 403) {
      if (transport.kind === "native") await transport.setRefreshToken(null);
      endSession(refreshRejectionReason(errorBody.code), {
        code: errorBody.code,
        message: errorBody.message,
      });
    } else {
      setAccessToken(null);
    }
    throw new ApiError(res.status, errorBody);
  }

  // The cookie jar is shared by hosts, not portals: a refresh can hand back another role's session.
  if (lacksSellerRole(payload.data)) {
    if (transport.kind === "native") await transport.setRefreshToken(null);
    await revokeRejectedSession(payload.data);
    endSession("role_mismatch");
    throw new ApiError(403, ROLE_NOT_ALLOWED);
  }

  await captureRefreshToken(res, payload.data);
  const data = stripRefreshToken(payload.data);
  setAccessToken(data.accessToken);
  return data;
}

/** Trades the refresh token for a new access token. Concurrent callers share one request. */
export async function refreshSession<T extends RefreshSession>(): Promise<T> {
  if (!refreshPromise) {
    refreshPromise = performRefresh<T>().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise as Promise<T>;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
}

/** True while a refresh request is outstanding. */
export function isRefreshing(): boolean {
  return refreshPromise !== null;
}

/**
 * Makes sure a usable access token is held: waits for a refresh already in flight, and refreshes
 * ahead of expiry. `aheadMs` lets the app use a wider margin when it returns to the foreground.
 */
export async function ensureFreshAccessToken(aheadMs = REFRESH_AHEAD_MS): Promise<string | null> {
  if (refreshPromise) {
    try {
      await refreshPromise;
    } catch {
      // The caller decides what a missing token means for it.
    }
  }
  const token = getAccessToken();
  if (token) {
    const expiresAt = tokenExpiresAt(token);
    if (expiresAt !== undefined && expiresAt <= now() + aheadMs) {
      await refreshSession();
    }
  }
  return getAccessToken();
}

async function doFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const headers = new Headers(options.headers);
  for (const [name, value] of Object.entries(baseHeaders())) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const method = (options.method ?? "GET").toUpperCase();
  if (MUTATING.has(method) && !headers.has("Idempotency-Key")) {
    headers.set("Idempotency-Key", options.idempotencyKey ?? newIdempotencyKey());
  }

  let body: RequestBody | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const { skipAuth: _skip, requireAuth: _require, idempotencyKey: _key, rawBody: _raw, body: _body, ...init } =
    options;
  return send(apiUrl(path), {
    ...init,
    headers,
    body,
    // Native apps authenticate with the Bearer token only; the platform cookie jar stays out.
    credentials: cfg().refreshTransport.kind === "native" ? "omit" : "include",
  });
}

/**
 * Two refusals change what the app should show everywhere, not just where the call was made: the
 * account is still view-only (so the banner must appear), or a maintenance window has started
 * (so the notice must be fetched now rather than at the next poll).
 */
function announceRefusal(status: number, body: ApiErrorBody): void {
  if (status === 403 && body.code === "ACCOUNT_VERIFICATION_REQUIRED") emitSellerEvent("access:verification-required", body);
  if (status === 503 && body.code === "MAINTENANCE_MODE") emitSellerEvent("notices:maintenance-paused", body);
}

export async function apiRequest<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const protectedRequest = options.requireAuth ?? !isPublicPath(path);
  const method = (options.method ?? "GET").toUpperCase();
  const requestOptions: ApiFetchOptions = {
    ...options,
    // Minted once, so the retry after a refresh is recognised as the same action.
    idempotencyKey: options.idempotencyKey ?? (MUTATING.has(method) ? newIdempotencyKey() : undefined),
  };
  if (!options.skipAuth) {
    // Session restoration and concurrent requests share one refresh operation.
    try {
      await ensureFreshAccessToken();
    } catch (error) {
      if (protectedRequest) throw error;
    }
    if (protectedRequest && !getAccessToken()) {
      throw new ApiError(401, { code: "SESSION_REQUIRED", message: "Please sign in to continue" });
    }
  }
  const sentToken = getAccessToken();
  let res = await doFetch(path, requestOptions);

  if (res.status === 401 && !options.skipAuth) {
    // A late response may belong to the token another request already replaced.
    const currentToken = getAccessToken();
    const refreshed =
      sentToken && !currentToken
        ? false
        : currentToken && currentToken !== sentToken
          ? true
          : await refreshAccessToken();
    if (refreshed) {
      const retryToken = getAccessToken();
      res = await doFetch(path, requestOptions);
      if (res.status === 401 && getAccessToken() === retryToken) endSession("unauthorized");
    }
  }

  const payload = await readEnvelope<T>(res);

  if (!res.ok || (payload && payload.success === false)) {
    const errorBody: ApiErrorBody = payload?.error ?? fallbackErrorBody(res, payload !== null);
    announceRefusal(res.status, errorBody);
    throw new ApiError(res.status, errorBody);
  }

  let data = (payload?.data as T) ?? (undefined as T);
  if (SESSION_ISSUING.test(path)) {
    // Checked before the refresh token is captured, so a rejected account leaves nothing stored.
    if (lacksSellerRole(data)) {
      await revokeRejectedSession(data);
      setAccessToken(null);
      throw new ApiError(403, ROLE_NOT_ALLOWED);
    }
    await captureRefreshToken(res, data);
    data = stripRefreshToken(data);
  }
  return { data, meta: payload?.meta };
}

/**
 * The URL and headers for a request the app performs itself — a file download, an image with
 * auth, a CSV export — after making sure the access token is fresh.
 */
export async function authorizedRequest(path: string): Promise<{ url: string; headers: Record<string, string> }> {
  const token = await ensureFreshAccessToken().catch(() => getAccessToken());
  const headers = baseHeaders();
  if (token) headers.Authorization = `Bearer ${token}`;
  return { url: apiUrl(path), headers };
}

export const api = {
  get: <T>(path: string, options?: ApiFetchOptions) =>
    apiRequest<T>(path, { ...options, method: "GET" }).then((r) => r.data),
  getResult: <T>(path: string, options?: ApiFetchOptions) => apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiRequest<T>(path, { ...options, method: "POST", body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }).then((r) => r.data),
  delete: <T>(path: string, options?: ApiFetchOptions) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }).then((r) => r.data),
};

export { refreshAccessToken };

/** Test-only: drops a refresh left in flight by a failed case. */
export function resetClientState(): void {
  refreshPromise = null;
}

/**
 * GET against an unversioned, unwrapped server route such as `/health`, which answers with plain
 * JSON instead of the `{ success, data }` envelope. Never sends credentials.
 */
export async function serverGet<T>(path: string): Promise<T> {
  const res = await send(serverUrl(path), { method: "GET", headers: baseHeaders(), credentials: "omit" });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!isJson) {
    throw new ApiError(res.status, { code: "NON_JSON_RESPONSE", message: res.statusText || "Unexpected response" });
  }
  const body = (await res.json()) as T;
  if (!res.ok) {
    throw new ApiError(res.status, { code: "REQUEST_FAILED", message: res.statusText || "Request failed" });
  }
  return body;
}
