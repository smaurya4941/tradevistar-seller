/**
 * "View only until verified" and "paused for maintenance": the two ways the API refuses a write
 * for a reason other than the request being wrong.
 *
 * - `ACCOUNT_VERIFICATION_REQUIRED` (403): the seller's KYC is not verified yet. Every write
 *   outside `UNVERIFIED_WRITE_AREAS` is refused.
 * - `MAINTENANCE_MODE` (503): an admin-scheduled window pauses that kind of write; reads work.
 */
import type { AccountAccess, KycStatus } from "../endpoints/access";
import { ApiError } from "../http/client";

export const VERIFICATION_REQUIRED_CODE = "ACCOUNT_VERIFICATION_REQUIRED";
export const MAINTENANCE_MODE_CODE = "MAINTENANCE_MODE";

/**
 * API paths (after `/api/v1`) whose writes work for an unverified seller. This is the one list the
 * app consults; it mirrors the backend routes marked `@AllowUnverified()`: auth, My Profile
 * (`seller/profile/*`, `me/*` including KYC), bank verification, support and leads, notifications,
 * media uploads, organizations, and marking a conversation read.
 */
export const UNVERIFIED_WRITE_AREAS: readonly RegExp[] = [
  /^\/auth\//,
  /^\/seller\/profile(?:\/|$)/,
  /^\/me(?:\/|$)/,
  /^\/bank-verification(?:\/|$)/,
  /^\/support(?:\/|$)/,
  /^\/leads(?:\/|$)/,
  /^\/notifications(?:\/|$)/,
  /^\/media(?:\/|$)/,
  /^\/organizations(?:\/|$)/,
  /^\/conversations\/[^/]+\/read$/,
];

/** Whether a write to this API path works while the seller is not verified. */
export function isWriteAllowedWhileUnverified(path: string): boolean {
  const clean = path.replace(/[?#].*$/, "");
  return UNVERIFIED_WRITE_AREAS.some((area) => area.test(clean));
}

export const isVerificationRequired = (error: unknown): boolean =>
  error instanceof ApiError && error.statusCode === 403 && error.code === VERIFICATION_REQUIRED_CODE;

export const isMaintenancePaused = (error: unknown): boolean =>
  error instanceof ApiError && error.statusCode === 503 && error.code === MAINTENANCE_MODE_CODE;

function detailsOf(error: ApiError): Record<string, unknown> {
  const details = error.details;
  return details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

/** When the maintenance that refused the request is due to end; null when open-ended. */
export function maintenanceEndsAtOf(error: ApiError): string | null {
  const endsAt = detailsOf(error).endsAt;
  return typeof endsAt === "string" && Number.isFinite(Date.parse(endsAt)) ? endsAt : null;
}

const KYC_STATUSES: readonly KycStatus[] = ["PENDING", "SUBMITTED", "VERIFIED", "REJECTED"];

/** The KYC status in a refusal's `details`, if it reported a readable one. */
export function kycStatusFromDetails(details: unknown): KycStatus | null {
  const status =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>).kycStatus
      : undefined;
  return KYC_STATUSES.find((known) => known === status) ?? null;
}

/** The KYC status a refusal reported, if it reported a readable one. */
export function refusedKycStatus(error: ApiError): KycStatus | null {
  return kycStatusFromDetails(error.details);
}

/** Where the seller stands while access is limited. */
export type VerificationState = "notStarted" | "underReview" | "rejected";

export function kycToState(status: KycStatus | null | undefined): VerificationState {
  if (status === "SUBMITTED") return "underReview";
  if (status === "REJECTED") return "rejected";
  return "notStarted";
}

/**
 * Null when nothing limits the seller: verified, no role (nothing to gate), or the answer has not
 * loaded. A `verified: true` answer is writable, including sellers exempt from verification.
 */
export function verificationState(access: AccountAccess | null | undefined): VerificationState | null {
  if (!access || access.verified || !access.role) return null;
  return kycToState(access.kycStatus);
}

/** True when the seller can look but the API will refuse their writes. */
export const isViewOnly = (access: AccountAccess | null | undefined): boolean =>
  verificationState(access) !== null;
