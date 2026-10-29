/**
 * Profile display rules: verification states and their tones, humanized labels, and the label
 * tables the profile screens share. Ported from the web portal's `lib/profile-data.ts` so a state
 * reads and is coloured the same on the phone.
 */
import type { StatusTone } from "./statusLabel";
import type {
  AddressPurpose,
  MarketplaceState,
  PinSource,
  ProfileVerification,
  RegistrationType,
} from "../endpoints/profile";
import type { BankAccountStatus } from "../endpoints/bank";
import type { GstRegistrationType, TaxHistoryField } from "../endpoints/tax";

export const VERIFICATION_TONE: Record<string, StatusTone> = {
  VERIFIED: "green",
  APPROVED: "green",
  ACTIVE: "green",
  UNDER_REVIEW: "blue",
  SUBMITTED: "blue",
  PENDING_APPROVAL: "orange",
  PENDING: "orange",
  PENDING_VERIFICATION: "orange",
  VERIFICATION_REQUIRED: "orange",
  DRAFT: "gray",
  NOT_PROVIDED: "gray",
  NOT_STARTED: "gray",
  REJECTED: "red",
  EXPIRED: "red",
  FAILED: "red",
  SUSPENDED: "red",
  DISABLED: "gray",
};

/** The tone of a state string; unknown states are neutral rather than alarming. */
export const toneForState = (state: string | null | undefined): StatusTone =>
  (state && VERIFICATION_TONE[state]) || "gray";

/** `PENDING_APPROVAL` to "Pending Approval". */
export const humanizeState = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const MARKETPLACE_LABEL: Record<MarketplaceState, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const REGISTRATION_LABELS: Record<RegistrationType, string> = {
  GSTIN: "GSTIN",
  PAN: "PAN",
  IEC: "Import Export Code (IEC)",
  CIN: "Corporate Identity Number (CIN)",
  TAN: "TAN",
  UDYAM: "Udyam Registration",
  FSSAI: "FSSAI Licence",
  EXPORT_LICENSE: "Export Licence",
  OTHER: "Other registration",
};

export const REGISTRATION_TYPES = Object.keys(REGISTRATION_LABELS) as RegistrationType[];

export const ADDRESS_PURPOSE_LABELS: Record<AddressPurpose, string> = {
  REGISTERED: "Registered address",
  OPERATING: "Operating address",
  BILLING: "Billing address",
  PICKUP: "Pickup address",
  WAREHOUSE: "Warehouse address",
  RETURN: "Return address",
};

export const ADDRESS_PURPOSES = Object.keys(ADDRESS_PURPOSE_LABELS) as AddressPurpose[];

/** Purposes a courier collects from; these need an exact pin. */
export const PICKUP_PURPOSES: readonly AddressPurpose[] = ["PICKUP", "WAREHOUSE", "REGISTERED"];

export const BANK_STATUS_LABEL: Record<BankAccountStatus, string> = {
  PENDING_VERIFICATION: "Pending verification",
  VERIFICATION_REQUIRED: "Verification required",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  FAILED: "Verification failed",
  SUSPENDED: "Suspended",
  DISABLED: "Disabled",
};

export const BANK_ACCOUNT_TYPE_LABEL = {
  CURRENT: "Current",
  SAVINGS: "Savings",
  CASH_CREDIT: "Cash credit",
  OVERDRAFT: "Overdraft",
} as const;

export const GST_REGISTRATION_LABELS: Record<GstRegistrationType, string> = {
  REGULAR: "Regular",
  COMPOSITION: "Composition scheme",
  CASUAL_TAXABLE: "Casual taxable person",
  NON_RESIDENT: "Non-resident taxable person",
  SEZ_UNIT: "SEZ unit",
  SEZ_DEVELOPER: "SEZ developer",
  EXPORT_ORIENTED: "Export oriented unit",
  UNREGISTERED: "Unregistered",
};

export const TAX_FIELD_LABELS: Record<TaxHistoryField, string> = {
  gstin: "GSTIN",
  registrationType: "Registration type",
  legalName: "Legal name",
  tradeName: "Trade name",
  stateName: "State",
  stateCode: "State code",
  pan: "PAN",
  taxIdentificationNumber: "Foreign tax ID",
  taxResidencyCountryCode: "Tax residency",
  isTaxExempt: "Tax exempt",
  exemptionReason: "Exemption reason",
  exemptionCertNumber: "Exemption certificate",
  exportsUnderLut: "Exports under LUT",
  lutNumber: "LUT number",
  verificationState: "Verification",
};

/** A readable value in the tax history's from/to table. */
export function formatTaxHistoryValue(value: string | boolean | null): string {
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

export const BUSINESS_OWNERSHIP_TYPES = [
  { value: "PROPRIETORSHIP", label: "Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "LLP", label: "LLP" },
  { value: "PRIVATE_LIMITED", label: "Private limited" },
  { value: "PUBLIC_LIMITED", label: "Public limited" },
  { value: "HUF", label: "HUF" },
  { value: "TRUST", label: "Trust" },
  { value: "SOCIETY", label: "Society" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "OTHER", label: "Other" },
] as const;

export const PREFERRED_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "gu", label: "Gujarati" },
  { value: "ta", label: "Tamil" },
  { value: "bn", label: "Bengali" },
] as const;

export const CONTACT_METHODS = [
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "IN_APP", label: "In-app" },
] as const;

export const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "America/New_York", label: "New York (ET)" },
] as const;

/** What a pin was captured by, in words; `null` means there is no exact pin. */
export function pinStatusKey(source: PinSource | null | undefined): "gps" | "map" | "geocoded" | "none" {
  if (source === "GPS") return "gps";
  if (source === "MAP_PIN") return "map";
  if (source === "GEOCODED") return "geocoded";
  return "none";
}

/** Whether a verification state counts as finished for the checklist rows. */
export const isVerified = (state: ProfileVerification | string | null | undefined): boolean => state === "VERIFIED";

/** The web "Open in Google Maps" link for a saved pin. */
export function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
