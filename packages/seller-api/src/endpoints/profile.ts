/**
 * The company profile (`/seller/profile/*`): overview, account, business, registrations,
 * addresses, location helpers, account manager and the account-closure preflight.
 *
 * Every route here is open to an unverified seller, so none of them needs the verified-write guard.
 * Account and business share one profile `version` on the server.
 */
import { api } from "../http/client";

export type ProfileVerification = "PENDING" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED";

export type MarketplaceState = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export type RegistrationType = "GSTIN" | "PAN" | "IEC" | "CIN" | "TAN" | "UDYAM" | "FSSAI" | "EXPORT_LICENSE" | "OTHER";

export type AddressPurpose = "REGISTERED" | "OPERATING" | "BILLING" | "PICKUP" | "WAREHOUSE" | "RETURN";

export type ContactMethod = "EMAIL" | "PHONE" | "WHATSAPP" | "IN_APP";

export type PinSource = "GPS" | "MAP_PIN" | "GEOCODED";

export interface ProfileRequirement {
  key: string;
  label: string;
  description: string;
  href: string;
  blocking: boolean;
  complete: boolean;
}

export interface ProfileCompletion {
  percent: number;
  completedCount: number;
  totalCount: number;
  requirements: ProfileRequirement[];
  missing: ProfileRequirement[];
}

export interface ProfileOverview {
  company: {
    organizationId: string;
    displayName: string | null;
    legalName: string | null;
    logoUrl: string | null;
    primaryContactName: string | null;
    memberSince: string;
  };
  contact: {
    mobileNumber: string | null;
    mobileVerified: boolean;
    emailAddress: string | null;
    emailVerified: boolean;
  };
  status: {
    account: string;
    businessVerification: ProfileVerification;
    gstVerification: ProfileVerification | "NOT_PROVIDED";
    bankVerification: string | "NOT_PROVIDED";
    kyc: string;
    marketplace: MarketplaceState;
  };
  completion: ProfileCompletion;
  subscription: unknown;
  accountManager: unknown;
  quickLinks: { key: string; label: string; href: string }[];
}

export const getProfileOverview = (signal?: AbortSignal) =>
  api.get<ProfileOverview>("/seller/profile/overview", { requireAuth: true, signal });

/* ------------------------------------------------------------------ account */

export interface AccountView {
  displayName: string | null;
  businessDescription: string | null;
  primaryContactName: string | null;
  mobileNumber: string | null;
  mobileVerified: boolean;
  emailAddress: string | null;
  emailVerified: boolean;
  businessEmail: string | null;
  businessPhone: string | null;
  website: string | null;
  preferredLanguage: string;
  preferredContactMethod: ContactMethod;
  timezone: string;
  logo: { mediaId: string; url: string | null } | null;
  version: number;
}

/** What `PATCH /seller/profile/account` takes: only changed fields, plus the version. */
export interface AccountPatch {
  displayName?: string | null;
  businessDescription?: string | null;
  primaryContactName?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  website?: string | null;
  preferredLanguage?: string;
  preferredContactMethod?: ContactMethod;
  timezone?: string;
  version: number;
}

export const getAccount = (signal?: AbortSignal) =>
  api.get<AccountView>("/seller/profile/account", { requireAuth: true, signal });

export const updateAccount = (patch: AccountPatch) =>
  api.patch<AccountView>("/seller/profile/account", patch, { requireAuth: true });

export const changePassword = (body: { currentPassword: string; newPassword: string }) =>
  api.post<{ otherSessionsRevoked: number }>("/seller/profile/account/password", body, { requireAuth: true });

export const requestContactChange = (identifier: string) =>
  api.post<{ sent: true; expiresInSeconds?: number; resendAfterSeconds?: number }>(
    "/seller/profile/account/contact/request",
    { identifier },
    { requireAuth: true },
  );

export const confirmContactChange = (identifier: string, code: string) =>
  api.post<{ emailAddress: string | null; mobileNumber: string | null }>(
    "/seller/profile/account/contact/confirm",
    { identifier, code },
    { requireAuth: true },
  );

export interface DeletionPreflight {
  canRequest: boolean;
  blockers: { key: string; label: string; count: number }[];
  gracePeriodDays: number;
}

export const getDeletionPreflight = (signal?: AbortSignal) =>
  api.get<DeletionPreflight>("/seller/profile/account/deletion/preflight", { requireAuth: true, signal });

/* ------------------------------------------------------------------ business */

export interface RegistrationView {
  id: string;
  registrationType: RegistrationType;
  label: string | null;
  number: string;
  issuedOn: string | null;
  expiresOn: string | null;
  verificationState: ProfileVerification;
  verifiedAt: string | null;
  rejectionReason: string | null;
  version: number;
}

export interface BusinessDetailsView {
  legalName: string | null;
  displayName: string | null;
  businessType: string | null;
  ownershipType: string | null;
  yearEstablished: number | null;
  description: string | null;
  industry: string | null;
  primaryCategoryCode: string | null;
  secondaryCategoryCodes: string[];
  employeesBucket: string | null;
  turnoverBucket: string | null;
  factorySize: string | null;
  certificates: string[];
  exportCountryCodes: string[];
  website: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  countryCode: string;
  businessVerification: ProfileVerification;
  businessRejectionReason: string | null;
  marketplaceState: MarketplaceState;
  version: number;
  registrations: RegistrationView[];
  requiredRegistrations: RegistrationType[];
}

export type BusinessPatch = Partial<
  Pick<
    BusinessDetailsView,
    | "legalName"
    | "displayName"
    | "businessType"
    | "ownershipType"
    | "yearEstablished"
    | "description"
    | "industry"
    | "primaryCategoryCode"
    | "secondaryCategoryCodes"
    | "employeesBucket"
    | "turnoverBucket"
    | "factorySize"
    | "certificates"
    | "exportCountryCodes"
    | "website"
    | "businessEmail"
    | "businessPhone"
  >
> & { version: number };

export const getBusinessDetails = (signal?: AbortSignal) =>
  api.get<BusinessDetailsView>("/seller/profile/business", { requireAuth: true, signal });

export const updateBusinessDetails = (patch: BusinessPatch) =>
  api.patch<BusinessDetailsView>("/seller/profile/business", patch, { requireAuth: true });

export interface RegistrationInput {
  registrationType: RegistrationType;
  number: string;
  label?: string;
  issuedOn?: string;
  expiresOn?: string;
  /** The row's version when updating an existing registration. */
  version?: number;
}

export const upsertRegistration = (body: RegistrationInput) =>
  api.put<RegistrationView>("/seller/profile/registrations", body, { requireAuth: true });

export const removeRegistration = (registrationType: RegistrationType) =>
  api.delete<{ removed: true }>(`/seller/profile/registrations/${encodeURIComponent(registrationType)}`, {
    requireAuth: true,
  });

/* ------------------------------------------------------------------ addresses */

export interface CompanyAddressView {
  id: string;
  purpose: AddressPurpose;
  label: string | null;
  contactName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  stateCode: string | null;
  zip: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  /** How the pin was set; null when the address has no confirmed pin. */
  locationSource: PinSource | null;
  isDefault: boolean;
  isActive: boolean;
  version: number;
}

export interface CompanyAddressInput {
  purpose: AddressPurpose;
  label?: string;
  contactName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  stateCode?: string;
  zip: string;
  countryCode: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Only for a pin the seller just set; omitted, the stored pin is kept or re-derived. */
  locationSource?: "GPS" | "MAP_PIN";
  isDefault?: boolean;
  version?: number;
}

export const listCompanyAddresses = (purpose?: AddressPurpose, signal?: AbortSignal) =>
  api.get<CompanyAddressView[]>(`/seller/profile/addresses${purpose ? `?purpose=${purpose}` : ""}`, {
    requireAuth: true,
    signal,
  });

export const createCompanyAddress = (body: CompanyAddressInput) =>
  api.post<CompanyAddressView>("/seller/profile/addresses", body, { requireAuth: true });

export const updateCompanyAddress = (id: string, body: Partial<CompanyAddressInput>) =>
  api.patch<CompanyAddressView>(`/seller/profile/addresses/${encodeURIComponent(id)}`, body, { requireAuth: true });

export const deleteCompanyAddress = (id: string) =>
  api.delete<{ removed: true }>(`/seller/profile/addresses/${encodeURIComponent(id)}`, { requireAuth: true });

/* ------------------------------------------------------------------ location helpers */

/** The Google Maps *browser* key; the Android SDK needs its own key (see BACKEND_GAPS). */
export const getMapConfig = (signal?: AbortSignal) =>
  api.get<{ browserKey: string | null }>("/location/map-config", { requireAuth: true, signal });

export interface ReverseGeocoded {
  line1: string;
  city: string;
  state: string;
  zip: string;
  countryCode: string;
}

export const reverseGeocodeLocation = (lat: number, lng: number, signal?: AbortSignal) =>
  api.get<ReverseGeocoded>(`/location/reverse-geocode?lat=${lat}&lng=${lng}`, { requireAuth: true, signal });

export interface GeocodeQuery {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  zip?: string;
  countryCode?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** EXACT = the building was matched; APPROXIMATE = only the area, never offered as a pin. */
  precision: "EXACT" | "APPROXIMATE";
}

export const geocodeAddress = (address: GeocodeQuery, signal?: AbortSignal) => {
  const params: string[] = [];
  for (const [key, value] of Object.entries(address)) {
    if (typeof value === "string" && value.trim()) {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.trim())}`);
    }
  }
  return api.get<GeocodeResult>(`/location/geocode?${params.join("&")}`, { requireAuth: true, signal });
};

/* ------------------------------------------------------------------ reference lists */

export interface RefOption {
  code: string;
  name: string;
}

export const getLocationStates = (countryCode: string, signal?: AbortSignal) =>
  api.get<RefOption[]>(`/reference/locations/states?countryCode=${encodeURIComponent(countryCode)}`, {
    skipAuth: true,
    signal,
  });

export const getLocationCities = (countryCode: string, stateCode: string, signal?: AbortSignal) =>
  api.get<{ name: string }[]>(
    `/reference/locations/cities?countryCode=${encodeURIComponent(countryCode)}&stateCode=${encodeURIComponent(stateCode)}`,
    { skipAuth: true, signal },
  );

/* ------------------------------------------------------------------ account manager */

export interface AccountManagerView {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  workingHours: string | null;
  supportedCategories: string[];
  supportedRegions: string[];
  status: string;
  assignedSince: string;
}

/** `null` when none is assigned; FEATURE_NOT_AVAILABLE (403) when the plan does not include one. */
export const getAccountManager = (signal?: AbortSignal) =>
  api.get<AccountManagerView | null>("/seller/profile/account-manager", { requireAuth: true, signal });

/* ------------------------------------------------------------------ avatar */

export const removeAvatar = () => api.delete<unknown>("/media/avatar", { requireAuth: true });
