import { base64url } from "../testing/b64";
import {
  api,
  ApiError,
  configureApiClient,
  createMemoryTokenStore,
  getAccessToken,
  getHealth,
  isPublicPath,
  onSellerEvent,
  loginWithPassword,
  refreshSession,
  resetApiClientConfig,
  resetClientState,
  setAccessToken,
  type ApiClientConfig,
  type RefreshTransport,
} from "../index";

const NOW = Date.UTC(2026, 8, 29, 10, 0, 0);

function jwt(expSecondsFromNow: number): string {
  const payload = base64url(JSON.stringify({ sub: "u1", exp: Math.floor(NOW / 1000) + expSecondsFromNow }));
  return `h.${payload}.s`;
}

interface Call {
  url: string;
  init: RequestInit;
  headers: Headers;
  body: unknown;
}

type Handler = (call: Call) => Response | Promise<Response>;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const ok = (data: unknown, headers?: Record<string, string>) =>
  json(200, { success: true, data }, headers);

function fakeFetch(handler: Handler) {
  const calls: Call[] = [];
  const impl = jest.fn(async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers as Record<string, string>);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    const call = { url, init, headers, body };
    calls.push(call);
    return handler(call);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function nativeTransport(initial: string | null) {
  let stored = initial;
  const transport: RefreshTransport & { kind: "native" } = {
    kind: "native",
    getRefreshToken: jest.fn(async () => stored),
    setRefreshToken: jest.fn(async (token: string | null) => {
      stored = token;
    }),
  };
  return { transport, stored: () => stored };
}

let counter = 0;

function setup(overrides: Partial<ApiClientConfig> & { fetchImpl: typeof fetch }) {
  const onSessionEnded = jest.fn();
  configureApiClient({
    baseUrl: "https://api.example.com/",
    portal: "seller",
    clientKind: "mobile",
    tokenStore: createMemoryTokenStore(),
    refreshTransport: { kind: "cookie" },
    randomId: () => `id-${++counter}`,
    onSessionEnded,
    now: () => NOW,
    ...overrides,
  });
  return { onSessionEnded };
}

beforeEach(() => {
  counter = 0;
  resetClientState();
  resetApiClientConfig();
});

describe("request basics", () => {
  it("builds absolute URLs and sends portal, client and default headers", async () => {
    const { impl, calls } = fakeFetch(() => ok([]));
    setup({ fetchImpl: impl, defaultHeaders: { "User-Agent": "TradeVistarSeller/1.0.0" } });

    await api.get("/categories");

    expect(calls[0].url).toBe("https://api.example.com/api/v1/categories");
    expect(calls[0].headers.get("x-tv-portal")).toBe("seller");
    expect(calls[0].headers.get("x-tv-client")).toBe("mobile");
    expect(calls[0].headers.get("user-agent")).toBe("TradeVistarSeller/1.0.0");
  });

  it("rejects a protected request locally when signed out", async () => {
    const { impl, calls } = fakeFetch(() => ok({}));
    setup({ fetchImpl: impl });

    await expect(api.get("/seller/profile")).rejects.toMatchObject({ code: "SESSION_REQUIRED", statusCode: 401 });
    expect(calls).toHaveLength(0);
  });

  it("wraps a transport failure in a NETWORK_ERROR ApiError", async () => {
    const impl = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    setup({ fetchImpl: impl });

    const error = await api.get("/categories").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetworkError).toBe(true);
  });

  it("surfaces the API's error envelope", async () => {
    const { impl } = fakeFetch(() =>
      json(422, { success: false, error: { code: "VALIDATION_FAILED", message: "Bad", details: ["qty must be > 0"] } }),
    );
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await expect(api.post("/seller/products", {})).rejects.toMatchObject({ statusCode: 422, code: "VALIDATION_FAILED" });
  });
});

describe("idempotency keys", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("mints one for %s", async (method) => {
    const { impl, calls } = fakeFetch(() => ok({}));
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await api[method.toLowerCase() as "post" | "put" | "patch" | "delete"]("/seller/products");

    expect(calls[0].headers.get("Idempotency-Key")).toBe("id-1");
  });

  it("never sends one on GET", async () => {
    const { impl, calls } = fakeFetch(() => ok({}));
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await api.get("/seller/products");

    expect(calls[0].headers.has("Idempotency-Key")).toBe(false);
  });

  it("honours a caller-pinned key", async () => {
    const { impl, calls } = fakeFetch(() => ok({}));
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await api.post("/orders", {}, { idempotencyKey: "checkout-42" });

    expect(calls[0].headers.get("Idempotency-Key")).toBe("checkout-42");
  });

  it("reuses the same key for the retry after a refresh", async () => {
    let attempts = 0;
    const { impl, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/auth/refresh")) return ok({ accessToken: jwt(900) });
      attempts += 1;
      return attempts === 1 ? json(401, { success: false, error: { code: "UNAUTHORIZED", message: "x" } }) : ok({});
    });
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));
    setAccessToken(jwt(900));

    await api.post("/orders", {});

    const orderCalls = calls.filter((c) => c.url.endsWith("/orders"));
    expect(orderCalls).toHaveLength(2);
    expect(orderCalls[0].headers.get("Idempotency-Key")).toBe(orderCalls[1].headers.get("Idempotency-Key"));
  });
});

describe("refresh", () => {
  it("refreshes 30 s ahead of expiry", async () => {
    const fresh = jwt(900);
    const { impl, calls } = fakeFetch((call) =>
      call.url.endsWith("/auth/refresh") ? ok({ accessToken: fresh }) : ok({}),
    );
    setup({ fetchImpl: impl });
    setAccessToken(jwt(20));

    await api.get("/seller/profile");

    expect(calls.map((c) => c.url.replace("https://api.example.com/api/v1", ""))).toEqual([
      "/auth/refresh",
      "/seller/profile",
    ]);
    expect(calls[1].headers.get("Authorization")).toBe(`Bearer ${fresh}`);
  });

  it("keeps only one refresh in flight for concurrent callers", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { impl, calls } = fakeFetch(async (call) => {
      if (call.url.endsWith("/auth/refresh")) {
        await gate;
        return ok({ accessToken: jwt(900) });
      }
      return ok({});
    });
    setup({ fetchImpl: impl });
    setAccessToken(jwt(5));

    const pending = [api.get("/seller/a"), api.get("/seller/b"), api.get("/seller/c"), refreshSession()];
    release();
    await Promise.all(pending);

    expect(calls.filter((c) => c.url.endsWith("/auth/refresh"))).toHaveLength(1);
    expect(calls.filter((c) => !c.url.endsWith("/auth/refresh"))).toHaveLength(3);
  });

  it("retries a 401 once after refreshing", async () => {
    let first = true;
    const { impl, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/auth/refresh")) return ok({ accessToken: jwt(900) });
      if (first) {
        first = false;
        return json(401, { success: false, error: { code: "UNAUTHORIZED", message: "expired" } });
      }
      return ok({ id: "o1" });
    });
    const { onSessionEnded } = setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await expect(api.get("/orders/o1")).resolves.toEqual({ id: "o1" });
    expect(calls).toHaveLength(3);
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it("clears the session when the retry is still unauthorized", async () => {
    const { impl } = fakeFetch((call) =>
      call.url.endsWith("/auth/refresh")
        ? ok({ accessToken: jwt(900) })
        : json(401, { success: false, error: { code: "UNAUTHORIZED", message: "nope" } }),
    );
    const { onSessionEnded } = setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await expect(api.get("/orders/o1")).rejects.toMatchObject({ statusCode: 401 });
    expect(getAccessToken()).toBeNull();
    expect(onSessionEnded).toHaveBeenCalledWith("unauthorized");
  });
});

describe("refresh transports", () => {
  it("cookie: lets the browser send its httpOnly cookie and sends no token itself", async () => {
    const { impl, calls } = fakeFetch(() => ok({ accessToken: jwt(900) }));
    setup({ fetchImpl: impl, clientKind: "web", refreshTransport: { kind: "cookie" } });

    await refreshSession();

    expect(calls[0].init.credentials).toBe("include");
    expect(calls[0].headers.has("Cookie")).toBe(false);
    expect(calls[0].body).toBeUndefined();
    expect(calls[0].headers.has("x-tv-client")).toBe(false);
  });

  it("native: presents the stored token as cookie header and body, with the cookie jar off", async () => {
    const { transport } = nativeTransport("old-token");
    const { impl, calls } = fakeFetch(() => ok({ accessToken: jwt(900) }));
    setup({ fetchImpl: impl, refreshTransport: transport });

    await refreshSession();

    expect(calls[0].init.credentials).toBe("omit");
    expect(calls[0].headers.get("Cookie")).toBe("tv_refresh_seller=old-token");
    expect(calls[0].headers.get("x-refresh-token")).toBe("old-token");
    expect(calls[0].body).toEqual({ refreshToken: "old-token" });
  });

  it("native: persists the rotated token from Set-Cookie before resolving", async () => {
    const { transport, stored } = nativeTransport("old-token");
    const { impl } = fakeFetch(() =>
      ok(
        { accessToken: jwt(900) },
        {
          "set-cookie":
            "tv_refresh_seller=new-token; Max-Age=2592000; Path=/api/v1/auth; Expires=Wed, 29 Oct 2026 10:00:00 GMT; HttpOnly; SameSite=Lax",
        },
      ),
    );
    setup({ fetchImpl: impl, refreshTransport: transport });

    await refreshSession();

    expect(stored()).toBe("new-token");
  });

  it("native: prefers a token returned in the body, and never hands it to the caller", async () => {
    const { transport, stored } = nativeTransport("old-token");
    const { impl } = fakeFetch(() =>
      ok(
        { accessToken: jwt(900), refreshToken: "body-token", refreshExpiresAt: "2026-10-29" },
        { "set-cookie": "tv_refresh_seller=cookie-token; Path=/" },
      ),
    );
    setup({ fetchImpl: impl, refreshTransport: transport });

    const session = await refreshSession<{ accessToken: string; refreshToken?: string }>();

    expect(stored()).toBe("body-token");
    expect(session.refreshToken).toBeUndefined();
  });

  it("native: a rejected token is wiped and the session ended", async () => {
    const { transport, stored } = nativeTransport("revoked");
    const { impl } = fakeFetch(() =>
      json(401, { success: false, error: { code: "INVALID_REFRESH", message: "Session expired" } }),
    );
    const { onSessionEnded } = setup({ fetchImpl: impl, refreshTransport: transport });

    await expect(refreshSession()).rejects.toMatchObject({ statusCode: 401 });
    expect(stored()).toBeNull();
    expect(onSessionEnded).toHaveBeenCalledWith("refresh_rejected", expect.objectContaining({ code: "INVALID_REFRESH" }));
  });

  it("native: being offline keeps the stored token for later", async () => {
    const { transport, stored } = nativeTransport("keep-me");
    const impl = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const { onSessionEnded } = setup({ fetchImpl: impl, refreshTransport: transport });

    await expect(refreshSession()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(stored()).toBe("keep-me");
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it("native: a server error keeps the stored token for later", async () => {
    const { transport, stored } = nativeTransport("keep-me");
    const { impl } = fakeFetch(() => json(503, { success: false, error: { code: "UNAVAILABLE", message: "down" } }));
    const { onSessionEnded } = setup({ fetchImpl: impl, refreshTransport: transport });

    await expect(refreshSession()).rejects.toMatchObject({ statusCode: 503 });
    expect(stored()).toBe("keep-me");
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it("native: sign-in captures the issued token and strips it from the response", async () => {
    const { transport, stored } = nativeTransport(null);
    const user = { id: "u1", roles: ["SELLER"] };
    const { impl, calls } = fakeFetch(() =>
      ok({ accessToken: jwt(900), activeRole: "SELLER", user }, { "set-cookie": "tv_refresh_seller=issued; Path=/api/v1/auth; HttpOnly" }),
    );
    setup({ fetchImpl: impl, refreshTransport: transport });

    const res = await loginWithPassword({ identifier: "seller@example.com", password: "secret-pass" });

    expect(stored()).toBe("issued");
    expect(calls[0].body).toMatchObject({ portal: "seller", rememberMe: true, identifier: "seller@example.com" });
    expect(calls[0].headers.has("Authorization")).toBe(false);
    expect(res).toMatchObject({ user });
  });

  it("native: without a stored token, refresh fails without a network call", async () => {
    const { transport } = nativeTransport(null);
    const { impl, calls } = fakeFetch(() => ok({}));
    setup({ fetchImpl: impl, refreshTransport: transport });

    await expect(refreshSession()).rejects.toMatchObject({ code: "NO_REFRESH_TOKEN" });
    expect(calls).toHaveLength(0);
  });
});

describe("protected and public paths", () => {
  it.each(["/auth/login", "/auth/login/two-factor", "/auth/otp/request", "/auth/forgot-password", "/categories", "/home-metrics", "/footer/links", "/platform/notices", "/leads", "/reference/locations/countries", "/support/faqs", "/onboarding/invitations/prefill?token=abc"])(
    "treats %s as public",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    },
  );

  it.each(["/seller/products", "/orders", "/auth/me", "/auth/logout", "/me/access", "/conversations", "/notifications", "/support/tickets", "/categoriesx"])(
    "treats %s as protected",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );

  it("rejects an unlisted path locally when signed out", async () => {
    const { impl, calls } = fakeFetch(() => ok({}));
    setup({ fetchImpl: impl });

    await expect(api.get("/seller/orders")).rejects.toMatchObject({ code: "SESSION_REQUIRED", statusCode: 401 });
    expect(calls).toHaveLength(0);
  });

  it("lets a public read through without a session", async () => {
    const { impl, calls } = fakeFetch(() => ok([]));
    setup({ fetchImpl: impl });

    await api.get("/categories");

    expect(calls).toHaveLength(1);
    expect(calls[0].headers.has("Authorization")).toBe(false);
  });
});

describe("seller session rules", () => {
  const sellerUser = { id: "u1", roles: ["SELLER"] };
  const buyerUser = { id: "u2", roles: ["BUYER"] };

  it("native: captures the refresh token from a two-factor sign-in", async () => {
    const { transport, stored } = nativeTransport(null);
    const { impl } = fakeFetch(() =>
      ok(
        { accessToken: jwt(900), activeRole: "SELLER", user: sellerUser },
        { "set-cookie": "tv_refresh_seller=from-2fa; Path=/api/v1/auth; HttpOnly" },
      ),
    );
    setup({ fetchImpl: impl, refreshTransport: transport });

    await api.post("/auth/login/two-factor", { challengeToken: "c", code: "123456" }, { skipAuth: true });

    expect(stored()).toBe("from-2fa");
  });

  it("native: a buyer-only sign-in is rejected, stores nothing and closes the server session", async () => {
    const { transport, stored } = nativeTransport(null);
    const { impl, calls } = fakeFetch((call) =>
      call.url.endsWith("/auth/login")
        ? ok(
            { accessToken: jwt(900), activeRole: "BUYER", user: buyerUser },
            { "set-cookie": "tv_refresh_seller=buyer-token; Path=/api/v1/auth; HttpOnly" },
          )
        : new Response(null, { status: 204 }),
    );
    setup({ fetchImpl: impl, refreshTransport: transport });

    await expect(loginWithPassword({ identifier: "buyer@example.com", password: "x" })).rejects.toMatchObject({
      code: "ROLE_NOT_ALLOWED",
      statusCode: 403,
    });

    expect(stored()).toBeNull();
    expect(transport.setRefreshToken).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    const logout = calls.find((c) => c.url.endsWith("/auth/logout"));
    expect(logout?.headers.get("Authorization")).toBe(`Bearer ${jwt(900)}`);
  });

  it("native: a refresh that returns a non-seller user wipes the token and ends the session", async () => {
    const { transport, stored } = nativeTransport("shared-host-token");
    const { impl } = fakeFetch((call) =>
      call.url.endsWith("/auth/refresh")
        ? ok({ accessToken: jwt(900), activeRole: "BUYER", user: buyerUser })
        : new Response(null, { status: 204 }),
    );
    const { onSessionEnded } = setup({ fetchImpl: impl, refreshTransport: transport });

    await expect(refreshSession()).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });

    expect(stored()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(onSessionEnded).toHaveBeenCalledWith("role_mismatch");
  });

  it("native: a seller with extra roles is accepted", async () => {
    const { transport, stored } = nativeTransport(null);
    const { impl } = fakeFetch(() =>
      ok(
        { accessToken: jwt(900), activeRole: "SELLER", user: { id: "u3", roles: ["BUYER", "SELLER"] } },
        { "set-cookie": "tv_refresh_seller=dual; Path=/" },
      ),
    );
    setup({ fetchImpl: impl, refreshTransport: transport });

    await loginWithPassword({ identifier: "both@example.com", password: "x" });

    expect(stored()).toBe("dual");
  });

  it("strips the refresh token fields before data reaches screens", async () => {
    const { transport } = nativeTransport(null);
    const { impl } = fakeFetch(() =>
      ok({ accessToken: jwt(900), activeRole: "SELLER", user: sellerUser, refreshToken: "t", refreshExpiresAt: "x" }),
    );
    setup({ fetchImpl: impl, refreshTransport: transport });

    const res = await loginWithPassword({ identifier: "s@example.com", password: "x" });

    expect(res).not.toHaveProperty("refreshToken");
    expect(res).not.toHaveProperty("refreshExpiresAt");
  });

  it("sends rememberMe by default so the session survives a restart", async () => {
    const { impl, calls } = fakeFetch(() => ok({ accessToken: jwt(900), activeRole: "SELLER", user: sellerUser }));
    setup({ fetchImpl: impl, refreshTransport: nativeTransport(null).transport });

    await loginWithPassword({ identifier: "s@example.com", password: "x" });

    expect(calls[0].body).toMatchObject({ portal: "seller", rememberMe: true });
  });
});

describe("server routes", () => {
  it("reads /health without the envelope or credentials", async () => {
    const { impl, calls } = fakeFetch(() => json(200, { status: "ok", database: "up" }));
    setup({ fetchImpl: impl });

    await expect(getHealth()).resolves.toEqual({ status: "ok", database: "up" });
    expect(calls[0].url).toBe("https://api.example.com/health");
    expect(calls[0].init.credentials).toBe("omit");
  });

  it("maps a gateway page to an ApiError", async () => {
    const { impl } = fakeFetch(() => new Response("<html>502</html>", { status: 502, headers: { "content-type": "text/html" } }));
    setup({ fetchImpl: impl });

    await expect(getHealth()).rejects.toMatchObject({ statusCode: 502, code: "NON_JSON_RESPONSE" });
  });
});

describe("responses without an API envelope", () => {
  it("maps a bare 413 to UPLOAD_TOO_LARGE", async () => {
    const { impl } = fakeFetch(() => new Response("Payload Too Large", { status: 413, headers: { "content-type": "text/plain" } }));
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await expect(api.post("/seller/media", {})).rejects.toMatchObject({ statusCode: 413, code: "UPLOAD_TOO_LARGE" });
  });

  it("maps an HTML gateway page to GATEWAY_ERROR", async () => {
    const { impl } = fakeFetch(() => new Response("<html>Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await expect(api.get("/seller/orders")).rejects.toMatchObject({ statusCode: 502, code: "GATEWAY_ERROR" });
  });

  it("keeps the API's own code when an envelope is present", async () => {
    const { impl } = fakeFetch(() =>
      json(503, { success: false, error: { code: "MAINTENANCE_MODE", message: "Paused", details: { endsAt: null } } }),
    );
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await expect(api.post("/seller/products", {})).rejects.toMatchObject({ statusCode: 503, code: "MAINTENANCE_MODE" });
  });

  it("announces a maintenance refusal so the app can show its screen", async () => {
    const seen: unknown[] = [];
    const stop = onSellerEvent("notices:maintenance-paused", (detail) => seen.push(detail));
    const { impl } = fakeFetch(() =>
      json(503, { success: false, error: { code: "MAINTENANCE_MODE", message: "Paused", details: { endsAt: "2026-10-20T10:00:00.000Z" } } }),
    );
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await api.post("/seller/products", {}).catch(() => undefined);

    expect(seen).toEqual([{ code: "MAINTENANCE_MODE", message: "Paused", details: { endsAt: "2026-10-20T10:00:00.000Z" } }]);
    stop();
  });

  it("announces a view-only refusal", async () => {
    const seen: unknown[] = [];
    const stop = onSellerEvent("access:verification-required", () => seen.push(true));
    const { impl } = fakeFetch(() =>
      json(403, { success: false, error: { code: "ACCOUNT_VERIFICATION_REQUIRED", message: "KYC" } }),
    );
    setup({ fetchImpl: impl });
    setAccessToken(jwt(900));

    await api.post("/seller/products", {}).catch(() => undefined);

    expect(seen).toHaveLength(1);
    stop();
  });
});
