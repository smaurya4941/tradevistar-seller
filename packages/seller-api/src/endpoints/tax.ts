/**
 * Tax and GST (`/seller/profile/tax*`): the tax record, its change history, GST ownership by OTP
 * and the manual certificate path.
 */
import { api } from "../http/client";
import { getPage, qs, type Page } from "./paged";
import type { ProfileVerification } from "./profile";

export type GstRegistrationType =
  | "REGULAR"
  | "COMPOSITION"
  | "CASUAL_TAXABLE"
  | "NON_RESIDENT"
  | "SEZ_UNIT"
  | "SEZ_DEVELOPER"
  | "EXPORT_ORIENTED"
  | "UNREGISTERED";

export interface TaxDetailView {
  gstin: string | null;
  legalName: string | null;
  tradeName: string | null;
  registrationType: GstRegistrationType | null;
  stateName: string | null;
  stateCode: string | null;
  pan: string | null;
  taxIdentificationNumber: string | null;
  taxResidencyCountryCode: string;
  defaultTaxRate: { id: string; ratePercent: string; taxType: string } | null;
  isTaxExempt: boolean;
  exemptionReason: string | null;
  exemptionCertNumber: string | null;
  exemptionValidUntil: string | null;
  exportsUnderLut: boolean;
  lutNumber: string | null;
  lutValidUntil: string | null;
  verificationState: ProfileVerification;
  verifiedAt: string | null;
  rejectionReason: string | null;
  version: number;
}

/** The editable tax fields; `confirmVerifiedChange` accepts replacing verified GST details. */
export type TaxPatch = Partial<
  Pick<
    TaxDetailView,
    | "gstin"
    | "legalName"
    | "tradeName"
    | "registrationType"
    | "stateName"
    | "stateCode"
    | "pan"
    | "taxIdentificationNumber"
    | "taxResidencyCountryCode"
    | "isTaxExempt"
    | "exemptionReason"
    | "exemptionCertNumber"
    | "exemptionValidUntil"
    | "exportsUnderLut"
    | "lutNumber"
    | "lutValidUntil"
  >
> & { version: number; confirmVerifiedChange?: boolean };

export const getTaxDetail = (signal?: AbortSignal) =>
  api.get<TaxDetailView>("/seller/profile/tax", { requireAuth: true, signal });

export const updateTaxDetail = (patch: TaxPatch) =>
  api.patch<TaxDetailView>("/seller/profile/tax", patch, { requireAuth: true });

export type TaxHistoryField =
  | "gstin"
  | "registrationType"
  | "legalName"
  | "tradeName"
  | "stateName"
  | "stateCode"
  | "pan"
  | "taxIdentificationNumber"
  | "taxResidencyCountryCode"
  | "isTaxExempt"
  | "exemptionReason"
  | "exemptionCertNumber"
  | "exportsUnderLut"
  | "lutNumber"
  | "verificationState";

export interface TaxHistoryEntry {
  id: string;
  at: string;
  action: string;
  summary: string | null;
  status: ProfileVerification | null;
  changes: { field: TaxHistoryField; from: string | boolean | null; to: string | boolean | null }[];
  /** Null for system changes (imports, registry and verification results). */
  actor: { id: string; name: string } | null;
}

export const TAX_HISTORY_PAGE_SIZE = 10;

export const getTaxHistory = (page = 1, signal?: AbortSignal): Promise<Page<TaxHistoryEntry>> =>
  getPage<TaxHistoryEntry>(`/seller/profile/tax/history${qs({ page, limit: TAX_HISTORY_PAGE_SIZE })}`, {
    requireAuth: true,
    signal,
  });

/* ------------------------------------------------------------------ GST ownership */

export interface GstOwnershipChallenge {
  id: string;
  gstin: string;
  status: "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED" | "CANCELLED";
  emailMasked: string | null;
  mobileMasked: string | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  attemptsRemaining: number;
  expiresAt: string;
  resendAvailableAt: string;
  failureCode: string | null;
  failureMessage: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const getGstOwnership = (signal?: AbortSignal) =>
  api.get<GstOwnershipChallenge | null>("/seller/profile/tax/gst-verification", { requireAuth: true, signal });

/** False when the provider cannot confirm ownership by OTP and the manual path is the only one. */
export const getGstVerificationMode = (signal?: AbortSignal) =>
  api.get<{ otpAvailable: boolean }>("/seller/profile/tax/gst-verification/mode", { requireAuth: true, signal });

export const sendGstOwnershipOtp = () =>
  api.post<GstOwnershipChallenge>("/seller/profile/tax/gst-verification/send", undefined, { requireAuth: true });

export const verifyGstOwnershipOtp = (body: { challengeId: string; emailCode?: string; mobileCode?: string }) =>
  api.post<GstOwnershipChallenge>("/seller/profile/tax/gst-verification/verify", body, { requireAuth: true });

export interface GstManualVerificationCase {
  id: string;
  gstin: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  mediaAssetId: string;
  notes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const getGstManualVerification = (signal?: AbortSignal) =>
  api.get<GstManualVerificationCase | null>("/seller/profile/tax/gst-verification/manual", {
    requireAuth: true,
    signal,
  });

export const submitGstManualVerification = (body: { mediaAssetId: string; notes?: string }) =>
  api.post<GstManualVerificationCase>("/seller/profile/tax/gst-verification/manual", body, { requireAuth: true });
