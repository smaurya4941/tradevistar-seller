/**
 * GST rules: the state-code table, GSTIN autofill, the GSTIN/PAN/state cross-checks and the list of
 * "protected" fields that need confirmation to change once the GST details are verified.
 */
import { validateGstin, validatePan, validateForeignTaxId } from "./countryRules";
import type { TaxDetailView, TaxPatch } from "../endpoints/tax";

/** GST state codes: the first two digits of a GSTIN. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (before 2014)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

export const GST_STATE_OPTIONS = Object.entries(GST_STATES).map(([code, name]) => ({ code, name }));

export const normalizeGstin = (value: string): string => (value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
export const normalizePan = (value: string): string => (value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 10);

export interface GstinAutofill {
  stateCode: string;
  stateName: string;
  /** Only set when the PAN field was empty. */
  pan?: string;
}

/**
 * What a full, valid GSTIN fills in: the state code and name from its first two digits, and the
 * PAN from characters 3–12 when the PAN is still empty. Nothing for a half-typed or invalid GSTIN.
 */
export function gstinAutofill(gstin: string, currentPan: string | null | undefined): GstinAutofill | null {
  const value = normalizeGstin(gstin);
  if (validateGstin(value) !== null) return null;
  const stateCode = value.slice(0, 2);
  const result: GstinAutofill = { stateCode, stateName: GST_STATES[stateCode] ?? "" };
  if (!(currentPan ?? "").trim()) result.pan = value.slice(2, 12);
  return result;
}

export interface TaxFormValues {
  gstin: string;
  pan: string;
  stateCode: string;
  taxIdentificationNumber: string;
  taxResidencyCountryCode: string;
  exemptionReason: string;
  isTaxExempt: boolean;
  exportsUnderLut: boolean;
  lutNumber: string;
  exemptionCertNumber: string;
}

export type TaxFieldErrors = Partial<Record<keyof TaxFormValues, string>>;

/** Client-side validation that mirrors the web form, including the GSTIN/PAN/state cross-checks. */
export function validateTaxForm(values: TaxFormValues): TaxFieldErrors {
  const errors: TaxFieldErrors = {};
  const gstin = normalizeGstin(values.gstin);
  const pan = normalizePan(values.pan);
  if (gstin) {
    const problem = validateGstin(gstin);
    if (problem) errors.gstin = problem;
  }
  if (pan) {
    const problem = validatePan(pan);
    if (problem) errors.pan = problem;
    else if (gstin && !errors.gstin && pan !== gstin.slice(2, 12)) {
      errors.pan = "PAN must match the PAN inside the GSTIN.";
    }
  }
  const stateCode = values.stateCode.trim();
  if (stateCode) {
    if (!/^\d{2}$/.test(stateCode)) errors.stateCode = "State code is two digits.";
    else if (gstin && !errors.gstin && stateCode !== gstin.slice(0, 2)) {
      errors.stateCode = "State code must match the first two digits of the GSTIN.";
    }
  }
  const residency = values.taxResidencyCountryCode.trim();
  if (!/^[A-Za-z]{2}$/.test(residency)) errors.taxResidencyCountryCode = "Use a two-letter country code.";
  if (values.taxIdentificationNumber.trim()) {
    const problem = validateForeignTaxId(values.taxIdentificationNumber);
    if (problem) errors.taxIdentificationNumber = problem;
    else if (values.taxIdentificationNumber.trim().length > 50) errors.taxIdentificationNumber = "At most 50 characters.";
  }
  if (values.isTaxExempt) {
    if (values.exemptionReason.length > 500) errors.exemptionReason = "At most 500 characters.";
    if (values.exemptionCertNumber.length > 100) errors.exemptionCertNumber = "At most 100 characters.";
  }
  if (values.exportsUnderLut && values.lutNumber.length > 100) errors.lutNumber = "At most 100 characters.";
  return errors;
}

/** Fields that replace verified GST details; changing one needs `confirmVerifiedChange`. */
export const PROTECTED_TAX_FIELDS = [
  "gstin",
  "registrationType",
  "legalName",
  "tradeName",
  "stateName",
  "stateCode",
  "pan",
] as const satisfies readonly (keyof TaxDetailView)[];

export type ProtectedTaxField = (typeof PROTECTED_TAX_FIELDS)[number];

/** Which protected fields a patch changes. Empty unless the GST state is verified. */
export function protectedFieldsChanged(
  verificationState: TaxDetailView["verificationState"],
  patch: Partial<TaxPatch>,
): ProtectedTaxField[] {
  if (verificationState !== "VERIFIED") return [];
  return PROTECTED_TAX_FIELDS.filter((field) => field in patch);
}

/** The server's list of fields from a `VERIFIED_CHANGE_NEEDS_CONFIRMATION` error, if it sent one. */
export function fieldsFromConfirmationError(details: unknown): string[] {
  if (Array.isArray(details)) return details.filter((line): line is string => typeof line === "string");
  if (details && typeof details === "object") {
    const fields = (details as { fields?: unknown }).fields;
    if (Array.isArray(fields)) return fields.filter((line): line is string => typeof line === "string");
  }
  return [];
}

/* ------------------------------------------------------------------ GST ownership card */

export type GstOwnershipView =
  | { kind: "hidden" }
  | { kind: "manual"; reason: "otpUnavailable" | "contactUnavailable" }
  | { kind: "start" }
  | { kind: "codes"; emailDone: boolean; mobileDone: boolean }
  | { kind: "expired" }
  | { kind: "failed"; message: string }
  | { kind: "verified" };

export interface GstOwnershipInputs {
  hasGstin: boolean;
  taxState: TaxDetailView["verificationState"];
  hasUnsavedEdits: boolean;
  otpAvailable: boolean | undefined;
  challenge: {
    status: "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED" | "CANCELLED";
    emailVerified: boolean;
    mobileVerified: boolean;
    failureCode: string | null;
    failureMessage: string | null;
  } | null;
}

/** Codes that mean the provider has no usable contact for the GSTIN: the manual path takes over. */
export const GST_MANUAL_FALLBACK_CODES = ["GST_CONTACT_UNAVAILABLE", "GST_CONTACT_UNSUPPORTED"];

/**
 * What the GST ownership card shows. The card exists when a GSTIN is saved, the state is not
 * verified and the form has no unsaved edits (the codes belong to the saved GSTIN).
 */
export function gstOwnershipView(input: GstOwnershipInputs): GstOwnershipView {
  if (!input.hasGstin || input.hasUnsavedEdits) return { kind: "hidden" };
  if (input.taxState === "VERIFIED") return { kind: "verified" };
  if (input.otpAvailable === false) return { kind: "manual", reason: "otpUnavailable" };
  const challenge = input.challenge;
  if (!challenge) return { kind: "start" };
  if (challenge.status === "VERIFIED") return { kind: "verified" };
  if (challenge.failureCode && GST_MANUAL_FALLBACK_CODES.includes(challenge.failureCode)) {
    return { kind: "manual", reason: "contactUnavailable" };
  }
  if (challenge.status === "EXPIRED") return { kind: "expired" };
  if (challenge.status === "FAILED" || challenge.status === "CANCELLED") {
    return { kind: "failed", message: challenge.failureMessage ?? "Verification did not complete." };
  }
  return { kind: "codes", emailDone: challenge.emailVerified, mobileDone: challenge.mobileVerified };
}

/** Seconds from now until an ISO time, never negative. */
export function secondsUntil(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const target = Date.parse(iso);
  return Number.isFinite(target) ? Math.max(0, Math.ceil((target - now) / 1000)) : 0;
}

export const GST_LIMITS = { tradeName: 200, exemptionReason: 500, certNumber: 100, lutNumber: 100, foreignTaxId: 50 } as const;
