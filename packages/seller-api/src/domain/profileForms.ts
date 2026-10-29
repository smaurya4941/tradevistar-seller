/**
 * Validation for the account, business, registration and contact-change forms, with the server's
 * limits. Messages are plain sentences the screens show under the field.
 */
import { validatePhone, validateRegistrationNumber, type RegistrationKind } from "./countryRules";
import { identifierKind, isValidEmail, resolveAuthIdentifier } from "./identifier";
import type { RegistrationType } from "../endpoints/profile";
import { isCalendarDate } from "./calendarRules";

export const ACCOUNT_LIMITS = {
  displayName: 200,
  description: 4000,
  contactName: 150,
  email: 255,
  website: 300,
  timezone: 64,
  languageMin: 2,
  languageMax: 10,
} as const;

export interface AccountForm {
  displayName: string;
  primaryContactName: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  preferredLanguage: string;
  preferredContactMethod: string;
  timezone: string;
  businessDescription: string;
}

export type AccountErrors = Partial<Record<keyof AccountForm, string>>;

/** The web rule: a website must start with http:// or https://. */
export const isValidWebsite = (value: string): boolean => /^https?:\/\/\S+$/i.test(value.trim());

export function validateAccount(form: AccountForm, countryCode: string = "IN"): AccountErrors {
  const errors: AccountErrors = {};
  const name = form.displayName.trim();
  if (!name) errors.displayName = "Enter your company display name.";
  else if (name.length > ACCOUNT_LIMITS.displayName) errors.displayName = `At most ${ACCOUNT_LIMITS.displayName} characters.`;
  if (form.primaryContactName.trim().length > ACCOUNT_LIMITS.contactName) {
    errors.primaryContactName = `At most ${ACCOUNT_LIMITS.contactName} characters.`;
  }
  const email = form.businessEmail.trim();
  if (email) {
    if (email.length > ACCOUNT_LIMITS.email) errors.businessEmail = `At most ${ACCOUNT_LIMITS.email} characters.`;
    else if (!isValidEmail(email)) errors.businessEmail = "Enter a valid email address.";
  }
  if (form.businessPhone.trim()) {
    const problem = validatePhone(form.businessPhone, countryCode);
    if (problem) errors.businessPhone = problem;
  }
  const website = form.website.trim();
  if (website) {
    if (website.length > ACCOUNT_LIMITS.website) errors.website = `At most ${ACCOUNT_LIMITS.website} characters.`;
    else if (!isValidWebsite(website)) errors.website = "A website must start with http:// or https://.";
  }
  const language = form.preferredLanguage.trim();
  if (language.length < ACCOUNT_LIMITS.languageMin || language.length > ACCOUNT_LIMITS.languageMax) {
    errors.preferredLanguage = "Choose a language.";
  }
  if (!form.timezone.trim() || form.timezone.length > ACCOUNT_LIMITS.timezone) errors.timezone = "Choose a timezone.";
  if (form.businessDescription.length > ACCOUNT_LIMITS.description) {
    errors.businessDescription = `At most ${ACCOUNT_LIMITS.description} characters.`;
  }
  return errors;
}

/* ------------------------------------------------------------------ business */

export const BUSINESS_LIMITS = {
  name: 200,
  type: 100,
  description: 4000,
  bucket: 50,
  facility: 100,
  yearMin: 1800,
  secondaryCategories: 20,
  certificates: 50,
  exportCountries: 200,
} as const;

export interface BusinessForm {
  legalName: string;
  displayName: string;
  businessType: string;
  ownershipType: string;
  yearEstablished: string;
  industry: string;
  primaryCategoryCode: string;
  employeesBucket: string;
  turnoverBucket: string;
  factorySize: string;
  description: string;
  secondaryCategoryCodes: string[];
  certificates: string[];
  exportCountryCodes: string[];
}

export type BusinessErrors = Partial<Record<keyof BusinessForm, string>>;

export function validateBusiness(form: BusinessForm, now: Date = new Date()): BusinessErrors {
  const errors: BusinessErrors = {};
  const legal = form.legalName.trim();
  if (!legal) errors.legalName = "Enter the legal name.";
  else if (legal.length > BUSINESS_LIMITS.name) errors.legalName = `At most ${BUSINESS_LIMITS.name} characters.`;
  if (form.displayName.trim().length > BUSINESS_LIMITS.name) errors.displayName = `At most ${BUSINESS_LIMITS.name} characters.`;
  if (form.businessType.trim().length > BUSINESS_LIMITS.type) errors.businessType = `At most ${BUSINESS_LIMITS.type} characters.`;
  if (form.yearEstablished.trim()) {
    const year = Number(form.yearEstablished);
    const maxYear = now.getFullYear();
    if (!Number.isInteger(year) || year < BUSINESS_LIMITS.yearMin || year > maxYear) {
      errors.yearEstablished = `Enter a year from ${BUSINESS_LIMITS.yearMin} to ${maxYear}.`;
    }
  }
  if (form.factorySize.trim().length > BUSINESS_LIMITS.facility) errors.factorySize = `At most ${BUSINESS_LIMITS.facility} characters.`;
  if (form.description.length > BUSINESS_LIMITS.description) errors.description = `At most ${BUSINESS_LIMITS.description} characters.`;
  if (form.secondaryCategoryCodes.length > BUSINESS_LIMITS.secondaryCategories) {
    errors.secondaryCategoryCodes = `Choose at most ${BUSINESS_LIMITS.secondaryCategories} categories.`;
  }
  if (form.certificates.length > BUSINESS_LIMITS.certificates) {
    errors.certificates = `Add at most ${BUSINESS_LIMITS.certificates} certificates.`;
  }
  if (form.exportCountryCodes.length > BUSINESS_LIMITS.exportCountries) {
    errors.exportCountryCodes = `Choose at most ${BUSINESS_LIMITS.exportCountries} countries.`;
  }
  return errors;
}

/** Employee and turnover buckets: the same values registration offers. */
export const EMPLOYEE_BUCKETS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;
export const TURNOVER_BUCKETS = ["Below 25 Lakh", "25 Lakh - 1 Cr", "1 Cr - 5 Cr", "5 Cr - 25 Cr", "25 Cr - 100 Cr", "Above 100 Cr"] as const;

/* ------------------------------------------------------------------ registrations */

export interface RegistrationForm {
  type: RegistrationType;
  number: string;
  issuedOn: string;
  expiresOn: string;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationForm, string>>;

export const normalizeRegistrationNumber = (value: string): string => (value ?? "").toUpperCase().replace(/\s+/g, " ").trim();

export function validateRegistration(form: RegistrationForm): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const number = normalizeRegistrationNumber(form.number);
  const problem = validateRegistrationNumber(form.type as RegistrationKind, number);
  if (problem) errors.number = problem;
  else if (number.length < 3 || number.length > 50) errors.number = "A registration number is 3–50 characters.";
  if (form.issuedOn.trim() && !isCalendarDate(form.issuedOn.trim())) errors.issuedOn = "Enter a date as YYYY-MM-DD.";
  if (form.expiresOn.trim()) {
    if (!isCalendarDate(form.expiresOn.trim())) errors.expiresOn = "Enter a date as YYYY-MM-DD.";
    else if (form.issuedOn.trim() && isCalendarDate(form.issuedOn.trim()) && form.expiresOn.trim() < form.issuedOn.trim()) {
      errors.expiresOn = "Expiry cannot be before the issue date.";
    }
  }
  return errors;
}

/* ------------------------------------------------------------------ login contact + misc */

export const CONTACT_CODE_LENGTH = 6;

/** The identifier the contact-change endpoints take (5–255 characters), or an error to show. */
export function normalizeContactIdentifier(raw: string): { identifier: string | null; error: string | null } {
  const value = raw.trim();
  if (value.length < 5 || value.length > 255) return { identifier: null, error: "Enter a valid email address or mobile number." };
  const identifier = resolveAuthIdentifier(value);
  return identifier
    ? { identifier, error: null }
    : { identifier: null, error: "Enter a valid email address or mobile number." };
}

export const contactKind = (identifier: string) => identifierKind(identifier);

export function validateChangeReason(reason: string): string | null {
  const length = reason.trim().length;
  if (length < 5) return "Tell us why in at least 5 characters.";
  if (length > 1000) return "At most 1,000 characters.";
  return null;
}

export function validateDocumentFields(fields: { number: string; label: string; expiresOn: string }): {
  number?: string;
  label?: string;
  expiresOn?: string;
} {
  const errors: { number?: string; label?: string; expiresOn?: string } = {};
  if (fields.number.trim().length > 100) errors.number = "At most 100 characters.";
  if (fields.label.trim().length > 150) errors.label = "At most 150 characters.";
  if (fields.expiresOn.trim() && !isCalendarDate(fields.expiresOn.trim())) errors.expiresOn = "Enter a date as YYYY-MM-DD.";
  return errors;
}
