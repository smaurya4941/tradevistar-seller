/**
 * Security and privacy (`/seller/profile/security*`): contact verification, two-factor sign-in,
 * sessions, login history and the security activity log. Codes are six digits; every send carries
 * `expiresInSeconds` and `resendAfterSeconds`, which drive the code panel's timers.
 */
import { api } from "../http/client";
import { getPage, qs, type Page } from "./paged";

export type SecurityChannel = "SMS" | "EMAIL";

export interface SecurityOverview {
  /** Masked, e.g. "in**************@gmail.com". */
  email: string | null;
  /** Masked, e.g. "*********0492". */
  mobile: string | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  twoFactor: { enabled: boolean; channel: SecurityChannel };
  activeSessionCount: number;
  lastPasswordChangeAt: string | null;
}

export interface SessionView {
  id: string;
  current: boolean;
  device: string;
  portal: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

export interface CodeSentView {
  sent: true;
  channel: SecurityChannel;
  destination: string | null;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface LoginAttemptView {
  id: string;
  successful: boolean;
  ipAddress: string | null;
  createdAt: string;
}

export interface SecurityEventView {
  id: string;
  eventType: string;
  summary: string;
  ipAddress: string | null;
  createdAt: string;
}

export const SECURITY_LIST_LIMIT = 20;

export const getSecurityOverview = (signal?: AbortSignal) =>
  api.get<SecurityOverview>("/seller/profile/security", { requireAuth: true, signal });

export const listSecuritySessions = (signal?: AbortSignal) =>
  api.get<SessionView[]>("/seller/profile/security/sessions", { requireAuth: true, signal });

export const revokeSecuritySession = (id: string) =>
  api.delete<{ revoked: true }>(`/seller/profile/security/sessions/${encodeURIComponent(id)}`, {
    requireAuth: true,
  });

/** Signs out every other session at once (the buyer app has to loop; the seller API does not). */
export const revokeOtherSessions = () =>
  api.post<{ revoked: number }>("/seller/profile/security/sessions/revoke-others", undefined, {
    requireAuth: true,
  });

export const getLoginHistory = (signal?: AbortSignal): Promise<Page<LoginAttemptView>> =>
  getPage<LoginAttemptView>(`/seller/profile/security/login-history${qs({ limit: SECURITY_LIST_LIMIT })}`, {
    requireAuth: true,
    signal,
  });

export const getSecurityActivity = (signal?: AbortSignal): Promise<Page<SecurityEventView>> =>
  getPage<SecurityEventView>(`/seller/profile/security/activity${qs({ limit: SECURITY_LIST_LIMIT })}`, {
    requireAuth: true,
    signal,
  });

export const requestContactVerification = (channel: SecurityChannel) =>
  api.post<CodeSentView>("/seller/profile/security/verify/request", { channel }, { requireAuth: true });

export const confirmContactVerification = (channel: SecurityChannel, code: string) =>
  api.post<{ verified: true }>("/seller/profile/security/verify/confirm", { channel, code }, { requireAuth: true });

export const requestTwoFactor = (channel: SecurityChannel) =>
  api.post<CodeSentView>("/seller/profile/security/two-factor/request", { channel }, { requireAuth: true });

export const confirmTwoFactor = (channel: SecurityChannel, code: string) =>
  api.post<{ enabled: true }>("/seller/profile/security/two-factor/confirm", { channel, code }, { requireAuth: true });

export const requestTwoFactorDisable = () =>
  api.post<CodeSentView>("/seller/profile/security/two-factor/disable/request", undefined, { requireAuth: true });

export const disableTwoFactor = (code: string) =>
  api.post<{ enabled: false }>("/seller/profile/security/two-factor/disable", { code }, { requireAuth: true });
