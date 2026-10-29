/**
 * Sign-in and session endpoints for the seller portal.
 *
 * Every call here that opens a session goes through `apiRequest`, which captures the refresh
 * token for native apps and strips it from what the caller receives, so no screen ever holds it.
 *
 * Observed contract (Backend authController, `x-tv-portal: seller`):
 * - `POST /auth/login` → `{ accessToken, activeRole, user }`, or a `TwoFactorChallenge` when the
 *   account has two-factor sign-in on. The refresh token is NOT in the body: it is set as the
 *   `tv_refresh_seller` cookie, which the client reads from `Set-Cookie`.
 * - `POST /auth/refresh` rotates the refresh token the same way and returns the same shape.
 * - `POST /auth/logout` answers 204 and revokes the session the access token belongs to.
 */
import { api, refreshSession } from "../http/client";

export type Role = "BUYER" | "SELLER" | "ADMIN" | "SUPER_ADMIN";

export interface AuthUser {
  id: string;
  publicId: string | null;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  roles: Role[];
  status: string;
  hasBuyerProfile: boolean;
  hasSellerProfile: boolean;
}

export interface AuthResponse {
  accessToken: string;
  activeRole: Role;
  user: AuthUser;
  /** Only ever present inside the client; it is captured and stripped before callers see data. */
  refreshToken?: string;
  refreshExpiresAt?: string;
}

/** Sent instead of tokens when the account has two-factor sign-in on. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
  channel: "SMS" | "EMAIL";
  destination: string | null;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
}

export type SignInResponse = AuthResponse | TwoFactorChallenge;

export function isTwoFactorChallenge(response: SignInResponse): response is TwoFactorChallenge {
  return "twoFactorRequired" in response && response.twoFactorRequired === true;
}

export interface PasswordLoginInput {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

/** The seller app always signs in to the seller portal. */
const PORTAL = "seller" as const;

export const loginWithPassword = (input: PasswordLoginInput) =>
  api.post<SignInResponse>("/auth/login", { rememberMe: true, ...input, portal: PORTAL }, { skipAuth: true });

export interface OtpLoginInput {
  identifier: string;
  code: string;
  rememberMe?: boolean;
}

/** Signs in with a LOGIN code; the account may still ask for a different second factor. */
export const loginWithOtp = (input: OtpLoginInput) =>
  api.post<SignInResponse>("/auth/login/otp", { rememberMe: true, ...input, portal: PORTAL }, { skipAuth: true });

/** How long a code lives and when the next one may be requested (seconds). */
export interface CodeTiming {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** Completes a sign-in that stopped at a two-factor challenge. */
export const verifyTwoFactor = (challengeToken: string, code: string) =>
  api.post<AuthResponse>("/auth/login/two-factor", { challengeToken, code }, { skipAuth: true });

export const resendTwoFactor = (challengeToken: string) =>
  api.post<CodeTiming & { sent?: boolean }>("/auth/login/two-factor/resend", { challengeToken }, { skipAuth: true });

export type OtpPurpose = "REGISTER" | "LOGIN" | "PASSWORD_RESET";

/**
 * Asks for a six-digit code. The server throttles it (3 a minute per client, 3 a minute and 10 an
 * hour per identifier) and answers the same whether or not the account exists.
 */
export const requestOtp = (identifier: string, purpose: OtpPurpose, portal?: "seller") =>
  api.post<{ sent: boolean }>(
    "/auth/otp/request",
    { identifier, purpose, ...(portal ? { portal } : {}) },
    { skipAuth: true },
  );

export interface OtpVerifyResult {
  verified: boolean;
  /** Proof of the verified identifier, valid for 30 minutes; registration presents it. */
  ticket?: string;
  /** Seller registration: the code proved ownership of an account seller access can join. */
  existingAccount?: boolean;
  /** That account already has a password its owner set, so a new one is refused. */
  passwordSet?: boolean;
}

export const verifyOtp = (identifier: string, purpose: OtpPurpose, code: string, portal?: "seller") =>
  api.post<OtpVerifyResult>(
    "/auth/otp/verify",
    { identifier, purpose, code, ...(portal ? { portal } : {}) },
    { skipAuth: true },
  );

/** A registration ticket stays valid this long after the code is verified. */
export const REGISTER_TICKET_TTL_MS = 30 * 60_000;

export interface SellerRegistrationInput {
  phone: string;
  email: string;
  /** Omitted when the verified account already has a password; the server refuses a new one then. */
  password?: string;
  phoneTicket: string;
  emailTicket: string;
  companyName: string;
  gstin?: string;
  categoryCode?: string;
  businessCountryCode: string;
}

/** Seller registration does not sign in: the portal opens once an admin approves it. */
export interface SellerRegistrationResult {
  registered: true;
  approvalStatus: "PENDING";
  linkedExistingAccount: boolean;
}

export const registerSeller = (input: SellerRegistrationInput, idempotencyKey?: string) =>
  api.post<SellerRegistrationResult>("/auth/register/seller", input, { skipAuth: true, idempotencyKey });

export const forgotPassword = (identifier: string) =>
  api.post<{ sent: boolean }>("/auth/forgot-password", { identifier }, { skipAuth: true });

/** Sets a new password; the server checks the code here and revokes every session (204). */
export const resetPassword = (identifier: string, code: string, newPassword: string) =>
  api.post<void>("/auth/reset-password", { identifier, code, newPassword }, { skipAuth: true });

/** Revokes this session server-side. */
export const logout = () => api.post<void>("/auth/logout");

export const getMe = () => api.get<AuthUser>("/auth/me", { requireAuth: true });

/** Trades the stored refresh token for a new session. */
export const refresh = () => refreshSession<AuthResponse>();

export function hasSellerRole(user: Pick<AuthUser, "roles">): boolean {
  return user.roles.includes("SELLER");
}
