/**
 * Verified access (`GET /me/access`). A seller whose KYC is not verified can sign in and use
 * profile, KYC, support and notifications, but every other write is refused with
 * `ACCOUNT_VERIFICATION_REQUIRED` until TradeVistar verifies the documents.
 */
import { api } from "../http/client";

export type KycStatus = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";

export interface AccountAccess {
  /** The portal the session acts in; null for accounts with no buyer or seller profile. */
  role: "BUYER" | "SELLER" | null;
  /** True when every action is available. */
  verified: boolean;
  kycStatus: KycStatus | null;
}

export const getMyAccess = (signal?: AbortSignal) =>
  api.get<AccountAccess>("/me/access", { requireAuth: true, signal });
