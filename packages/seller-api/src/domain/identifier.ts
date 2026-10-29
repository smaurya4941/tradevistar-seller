/**
 * Sign-in identifiers: an email address or a mobile number.
 *
 * Mirrors the seller web portal's `resolveAuthIdentifier` so the app and the web accept the same
 * spellings: an email is lower-cased and must look like one; a mobile has spaces and punctuation
 * and a leading 91 or 0 stripped and must then be a 10-digit Indian number starting 6–9; a number
 * that starts with "+" is checked against its own country's rules and returned in E.164.
 */
import { toE164, validatePhone } from "./countryRules";

export type IdentifierKind = "email" | "mobile";

/** The message shown for anything that is neither. */
export const IDENTIFIER_ERROR = "Enter a valid email address or mobile number.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A syntactically valid email address. */
export function isValidEmail(raw: string): boolean {
  return EMAIL.test(raw.trim().toLowerCase());
}

/** The lower-cased email, bare 10-digit mobile or E.164 number to send, or null. */
export function resolveAuthIdentifier(raw: string): string | null {
  const value = (raw ?? "").trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL.test(email) ? email : null;
  }

  const digits = value.replace(/[\s()+-]/g, "").replace(/^(?:91|0)(?=[6-9]\d{9}$)/, "");
  if (/^[6-9]\d{9}$/.test(digits)) return digits;

  return value.startsWith("+") && !validatePhone(value) ? toE164(value) : null;
}

export function identifierKind(identifier: string): IdentifierKind {
  return identifier.includes("@") ? "email" : "mobile";
}

/**
 * A privacy-preserving label for where a code went: "••••••3210" for a mobile, "a••@company.com"
 * for an email. Safe to show on screen; never used for analytics.
 */
export function maskIdentifier(identifier: string): string {
  if (identifier.includes("@")) {
    const [local, domain] = identifier.split("@");
    return `${local.slice(0, 1)}••@${domain}`;
  }
  return identifier.length > 4 ? `••••••${identifier.slice(-4)}` : identifier;
}
