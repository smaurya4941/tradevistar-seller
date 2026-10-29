/**
 * Phase 1 rules in the shared package: sign-in identifiers, phone and GSTIN checks, passwords,
 * registration (when a password is asked for, tickets), verified access and the list of writes an
 * unverified seller may make, and the endpoints against a fake server.
 */
import {
  ApiError,
  acceptTeamInvitation,
  configureApiClient,
  createMemoryTokenStore,
  forgotPassword,
  getMyAccess,
  getOnboardingInvitePrefill,
  getSiteNotices,
  identifierKind,
  isLinkingExisting,
  isMaintenancePaused,
  isValidEmail,
  isVerificationRequired,
  isViewOnly,
  isWriteAllowedWhileUnverified,
  kycStatusFromDetails,
  kycToState,
  loginWithOtp,
  maintenanceEndsAtOf,
  maskIdentifier,
  needsPassword,
  refusedKycStatus,
  refreshSession,
  registerSeller,
  requestOtp,
  resetApiClientConfig,
  resetClientState,
  resetPassword,
  resendTwoFactor,
  resolveAuthIdentifier,
  sanitizeGstin,
  sanitizePhone,
  setAccessToken,
  ticketExpired,
  toE164,
  UNVERIFIED_WRITE_AREAS,
  usableTicket,
  validateGstin,
  validatePassword,
  validatePhone,
  verificationState,
  verifyOtp,
  verifyTwoFactor,
  REGISTER_TICKET_TTL_MS,
  TICKET_MARGIN_MS,
  type AccountAccess,
} from "../index";
import { base64url } from "../testing/b64";

describe("resolveAuthIdentifier", () => {
  it("lower-cases a valid email and rejects a malformed one", () => {
    expect(resolveAuthIdentifier("  Seller@Example.COM ")).toBe("seller@example.com");
    expect(resolveAuthIdentifier("seller@example")).toBeNull();
    expect(resolveAuthIdentifier("@example.com")).toBeNull();
    expect(resolveAuthIdentifier("a b@example.com")).toBeNull();
  });

  it("strips spaces, punctuation and a leading 91 or 0 from a mobile", () => {
    expect(resolveAuthIdentifier("98765 43210")).toBe("9876543210");
    expect(resolveAuthIdentifier("(98765) 43-210")).toBe("9876543210");
    expect(resolveAuthIdentifier("919876543210")).toBe("9876543210");
    expect(resolveAuthIdentifier("09876543210")).toBe("9876543210");
    expect(resolveAuthIdentifier("+91 98765 43210")).toBe("9876543210");
  });

  it("requires an Indian mobile to start 6-9 and have ten digits", () => {
    expect(resolveAuthIdentifier("5876543210")).toBeNull();
    expect(resolveAuthIdentifier("987654321")).toBeNull();
    expect(resolveAuthIdentifier("98765432101")).toBeNull();
    expect(resolveAuthIdentifier("")).toBeNull();
  });

  it("checks another country's number against its own rules and returns E.164", () => {
    expect(resolveAuthIdentifier("+1 202 555 0123")).toBe("+12025550123");
    expect(resolveAuthIdentifier("+44 7911 123456")).toBe("+447911123456");
    expect(resolveAuthIdentifier("+1 202 555")).toBeNull();
  });

  it("tells the kind and masks for display", () => {
    expect(identifierKind("a@b.co")).toBe("email");
    expect(identifierKind("9876543210")).toBe("mobile");
    expect(maskIdentifier("9876543210")).toBe("••••••3210");
    expect(maskIdentifier("seller@example.com")).toBe("s••@example.com");
    expect(isValidEmail("x@y.zz")).toBe(true);
    expect(isValidEmail("x@y")).toBe(false);
  });
});

describe("phone rules the registration form uses", () => {
  it("accepts a +91 prefix as readily as a bare ten-digit number", () => {
    expect(validatePhone("9876543210", "IN")).toBeNull();
    expect(validatePhone("+919876543210", "IN")).toBeNull();
    expect(validatePhone("+91 98765 43210", "IN")).toBeNull();
  });

  it("rejects short, long and wrongly-started numbers", () => {
    expect(validatePhone("98765", "IN")).not.toBeNull();
    expect(validatePhone("5876543210", "IN")).not.toBeNull();
    expect(validatePhone("98765abcde", "IN")).not.toBeNull();
    expect(validatePhone("", "IN")).not.toBeNull();
  });

  it("converts to E.164", () => {
    expect(toE164("9876543210", "IN")).toBe("+919876543210");
    expect(toE164("123", "IN")).toBeNull();
  });

  it("cleans a phone as it is typed or pasted", () => {
    expect(sanitizePhone("98a76-54 3210")).toBe("9876543210");
    expect(sanitizePhone("09876543210")).toBe("9876543210");
    expect(sanitizePhone("919876543210")).toBe("+919876543210");
    expect(sanitizePhone("98765432109999")).toBe("9876543210");
  });
});

describe("GSTIN", () => {
  it("accepts a valid number and rejects a bad check digit or shape", () => {
    expect(validateGstin("27AAPFU0939F1ZV")).toBeNull();
    expect(validateGstin("27AAPFU0939F1ZX")).not.toBeNull();
    expect(validateGstin("27AAPFU0939F1Z")).not.toBeNull();
    expect(validateGstin("99ZZZZZ9999Z9Z9")).not.toBeNull();
  });

  it("is cleaned to upper-case letters and digits, 15 at most", () => {
    expect(sanitizeGstin("27aapfu0939f1zv")).toBe("27AAPFU0939F1ZV");
    expect(sanitizeGstin("27-AAPFU 0939F1ZV!")).toBe("27AAPFU0939F1ZV");
    expect(sanitizeGstin("27AAPFU0939F1ZVXYZ")).toBe("27AAPFU0939F1ZV");
  });
});

describe("password rule", () => {
  it("is 8 to 128 characters", () => {
    expect(validatePassword("1234567")).not.toBeNull();
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("x".repeat(128))).toBeNull();
    expect(validatePassword("x".repeat(129))).not.toBeNull();
    expect(validatePassword("")).not.toBeNull();
  });
});

describe("registration: when a password is asked for", () => {
  const linking = (extra = {}) => ({
    phoneExisting: false,
    emailExisting: false,
    accountHasPassword: false,
    ...extra,
  });

  it("asks for one for a brand new account", () => {
    expect(needsPassword(linking())).toBe(true);
    expect(isLinkingExisting(linking())).toBe(false);
  });

  it("asks for one when a buyer account has none yet", () => {
    expect(needsPassword(linking({ emailExisting: true }))).toBe(true);
    expect(isLinkingExisting(linking({ emailExisting: true }))).toBe(true);
  });

  it("does not ask when the account being joined already has one", () => {
    expect(needsPassword(linking({ phoneExisting: true, accountHasPassword: true }))).toBe(false);
  });
});

describe("registration tickets", () => {
  const now = Date.UTC(2026, 9, 20, 10, 0, 0);
  const ticket = (extra = {}) => ({ value: "t", identifier: "9876543210", issuedAt: now, ...extra });

  it("is usable for its own identifier shortly after it was issued", () => {
    expect(usableTicket(ticket(), "9876543210", now + 60_000)).toBe("t");
  });

  it("is not usable for another identifier", () => {
    expect(usableTicket(ticket(), "9123456789", now)).toBeNull();
    expect(ticketExpired(ticket(), "9123456789", now)).toBe(false);
  });

  it("stops being usable a margin before the 30-minute life ends", () => {
    const edge = now + REGISTER_TICKET_TTL_MS - TICKET_MARGIN_MS;
    expect(usableTicket(ticket(), "9876543210", edge - 1)).toBe("t");
    expect(usableTicket(ticket(), "9876543210", edge)).toBeNull();
    expect(ticketExpired(ticket(), "9876543210", edge)).toBe(true);
  });

  it("is nothing when there is no ticket", () => {
    expect(usableTicket(null, "x", now)).toBeNull();
    expect(ticketExpired(undefined, "x", now)).toBe(false);
  });
});

describe("verified access", () => {
  const access = (extra: Partial<AccountAccess> = {}): AccountAccess => ({
    role: "SELLER",
    verified: false,
    kycStatus: "PENDING",
    ...extra,
  });

  it("limits an unverified seller and nothing else", () => {
    expect(verificationState(access())).toBe("notStarted");
    expect(verificationState(access({ verified: true, kycStatus: "VERIFIED" }))).toBeNull();
    expect(verificationState(access({ role: null }))).toBeNull();
    expect(verificationState(undefined)).toBeNull();
  });

  it("tells apart documents under review and rejected ones", () => {
    expect(verificationState(access({ kycStatus: "SUBMITTED" }))).toBe("underReview");
    expect(verificationState(access({ kycStatus: "REJECTED" }))).toBe("rejected");
    expect(verificationState(access({ kycStatus: null }))).toBe("notStarted");
    expect(kycToState("PENDING")).toBe("notStarted");
  });

  it("is view-only exactly when a state applies", () => {
    expect(isViewOnly(access())).toBe(true);
    expect(isViewOnly(access({ verified: true }))).toBe(false);
    expect(isViewOnly(null)).toBe(false);
  });

  it("recognises refusals only by status and code", () => {
    const refusal = (status: number, code: string, details?: unknown) =>
      new ApiError(status, { code, message: "refused", details });
    expect(isVerificationRequired(refusal(403, "ACCOUNT_VERIFICATION_REQUIRED"))).toBe(true);
    expect(isVerificationRequired(refusal(403, "FORBIDDEN"))).toBe(false);
    expect(isMaintenancePaused(refusal(503, "MAINTENANCE_MODE"))).toBe(true);
    expect(isMaintenancePaused(refusal(403, "MAINTENANCE_MODE"))).toBe(false);
    expect(
      maintenanceEndsAtOf(refusal(503, "MAINTENANCE_MODE", { endsAt: "2026-10-20T10:00:00.000Z" })),
    ).toBe("2026-10-20T10:00:00.000Z");
    expect(maintenanceEndsAtOf(refusal(503, "MAINTENANCE_MODE", { endsAt: "soon" }))).toBeNull();
    expect(
      refusedKycStatus(refusal(403, "ACCOUNT_VERIFICATION_REQUIRED", { role: "SELLER", kycStatus: "SUBMITTED" })),
    ).toBe("SUBMITTED");
    expect(kycStatusFromDetails({ kycStatus: "WEIRD" })).toBeNull();
    expect(kycStatusFromDetails(null)).toBeNull();
  });
});

describe("writes an unverified seller may make", () => {
  it.each([
    "/auth/logout",
    "/seller/profile/documents",
    "/seller/profile/team/invitations/accept",
    "/seller/profile/account/password",
    "/me/kyc",
    "/me/kyc/documents",
    "/me/addresses",
    "/bank-verification/penny-drop",
    "/support/tickets",
    "/support/tickets/abc/messages",
    "/notifications/abc/read",
    "/notifications/read-all",
    "/media/uploads",
    "/organizations",
    "/conversations/c1/read",
    "/leads",
    "/support/tickets?x=1",
  ])("allows %s", (path) => {
    expect(isWriteAllowedWhileUnverified(path)).toBe(true);
  });

  it.each([
    "/products",
    "/products/p1",
    "/orders/o1/ship",
    "/conversations/c1/messages",
    "/rfqs/r1/quotes",
    "/wallet/withdraw",
    "/inventory/adjust",
    "/seller",
    "/sellers/profile",
    "/mean",
  ])("refuses %s", (path) => {
    expect(isWriteAllowedWhileUnverified(path)).toBe(false);
  });

  it("is the single list of areas, mirroring the backend", () => {
    // One entry per backend area marked @AllowUnverified for sellers; changing the backend means
    // changing this list and this count together.
    expect(UNVERIFIED_WRITE_AREAS).toHaveLength(10);
  });
});

// --- endpoints against a fake server ---------------------------------------------------------

interface Call {
  url: string;
  method: string;
  body: unknown;
  headers: Headers;
}

function setup(reply: (call: Call) => Response) {
  const calls: Call[] = [];
  const impl = jest.fn(async (url: string, init: RequestInit) => {
    const call: Call = {
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(init.body as string) : undefined,
      headers: new Headers(init.headers),
    };
    calls.push(call);
    return reply(call);
  });
  configureApiClient({
    baseUrl: "http://api.test",
    portal: "seller",
    clientKind: "mobile",
    tokenStore: createMemoryTokenStore(),
    refreshTransport: { kind: "native", getRefreshToken: async () => null, setRefreshToken: async () => undefined },
    randomId: () => "key-1",
    fetchImpl: impl as unknown as typeof fetch,
  });
  return calls;
}

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("phase 1 endpoints", () => {
  beforeEach(() => {
    resetApiClientConfig();
    resetClientState();
    setAccessToken(null);
  });

  it("requests a login code without a session or portal", async () => {
    const calls = setup(() => ok({ sent: true }));
    await requestOtp("9876543210", "LOGIN");
    expect(calls[0].url).toBe("http://api.test/api/v1/auth/otp/request");
    expect(calls[0].body).toEqual({ identifier: "9876543210", purpose: "LOGIN" });
    expect(calls[0].headers.get("Authorization")).toBeNull();
  });

  it("asks for the seller portal when registering", async () => {
    const calls = setup(() => ok({ verified: true, ticket: "t", existingAccount: true, passwordSet: false }));
    const result = await verifyOtp("a@b.co", "REGISTER", "123456", "seller");
    expect(calls[0].body).toEqual({ identifier: "a@b.co", purpose: "REGISTER", code: "123456", portal: "seller" });
    expect(result.existingAccount).toBe(true);
  });

  it("signs in with a code on the seller portal and remembers by default", async () => {
    const calls = setup(() => ok({ twoFactorRequired: true, challengeToken: "c".repeat(30), channel: "EMAIL", destination: "a***@b.co" }));
    await loginWithOtp({ identifier: "9876543210", code: "123456" });
    expect(calls[0].body).toEqual({ identifier: "9876543210", code: "123456", rememberMe: true, portal: "seller" });
  });

  it("posts the two-factor code and resend with the challenge token", async () => {
    const calls = setup(() => ok({ expiresInSeconds: 300, resendAfterSeconds: 30, sent: true }));
    await resendTwoFactor("c".repeat(30));
    expect(calls[0].url).toContain("/auth/login/two-factor/resend");
    expect(calls[0].body).toEqual({ challengeToken: "c".repeat(30) });
    await verifyTwoFactor("c".repeat(30), "123456");
    expect(calls[1].url).toContain("/auth/login/two-factor");
    expect(calls[1].body).toEqual({ challengeToken: "c".repeat(30), code: "123456" });
  });

  it("registers with an idempotency key and omits the password when not given", async () => {
    const calls = setup(() => ok({ registered: true, approvalStatus: "PENDING", linkedExistingAccount: true }));
    await registerSeller(
      {
        phone: "9876543210",
        email: "a@b.co",
        phoneTicket: "p",
        emailTicket: "e",
        companyName: "Acme",
        businessCountryCode: "IN",
      },
      "key-42",
    );
    expect(calls[0].headers.get("Idempotency-Key")).toBe("key-42");
    expect(calls[0].body).not.toHaveProperty("password");
  });

  it("resets a password with the code and the new password", async () => {
    const calls = setup(() => ok(undefined));
    await forgotPassword("a@b.co");
    await resetPassword("a@b.co", "123456", "newpassword1");
    expect(calls[1].body).toEqual({ identifier: "a@b.co", code: "123456", newPassword: "newpassword1" });
  });

  it("asks for the seller's notices and the invitation prefill without signing in", async () => {
    const calls = setup(() => ok({ serverTime: "2026-10-20T10:00:00.000Z", notices: [] }));
    await getSiteNotices();
    expect(calls[0].url).toBe("http://api.test/api/v1/platform/notices?audience=seller");
    await getOnboardingInvitePrefill("a b");
    expect(calls[1].url).toBe("http://api.test/api/v1/onboarding/invitations/prefill?token=a%20b");
    expect(calls[1].headers.get("Authorization")).toBeNull();
  });

  it("reads access and accepts an invitation with the session", async () => {
    const calls = setup(() => ok({ role: "SELLER", verified: false, kycStatus: "PENDING", organizationId: "o1" }));
    setAccessToken(`h.${base64url(JSON.stringify({ sub: "u", exp: 9_999_999_999 }))}.s`);
    await getMyAccess();
    await acceptTeamInvitation("tok");
    expect(calls[0].url).toBe("http://api.test/api/v1/me/access");
    expect(calls[1].url).toBe("http://api.test/api/v1/seller/profile/team/invitations/accept");
    expect(calls[1].body).toEqual({ token: "tok" });
  });
});

describe("a refresh the server refuses because approval changed", () => {
  beforeEach(() => {
    resetApiClientConfig();
    resetClientState();
    setAccessToken(null);
  });

  it.each([
    ["SELLER_APPROVAL_PENDING", "approval_pending", "Your seller account is pending approval."],
    ["SELLER_REJECTED", "approval_rejected", "Your seller registration was not approved: documents unclear"],
  ])("%s ends the session as %s and wipes the stored token", async (code, reason, message) => {
    let stored: string | null = "old-token";
    const onSessionEnded = jest.fn();
    const impl = jest.fn(
      async () =>
        new Response(JSON.stringify({ success: false, error: { code, message } }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
    );
    configureApiClient({
      baseUrl: "http://api.test",
      portal: "seller",
      clientKind: "mobile",
      tokenStore: createMemoryTokenStore(),
      refreshTransport: {
        kind: "native",
        getRefreshToken: async () => stored,
        setRefreshToken: async (token) => {
          stored = token;
        },
      },
      randomId: () => "k",
      onSessionEnded,
      fetchImpl: impl as unknown as typeof fetch,
    });

    await expect(refreshSession()).rejects.toMatchObject({ statusCode: 403, code });

    expect(stored).toBeNull();
    expect(onSessionEnded).toHaveBeenCalledWith(reason, { code, message });
  });
});
