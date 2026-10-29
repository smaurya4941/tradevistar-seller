/**
 * Keystroke-level helpers for phone and postal inputs, built on countryRules.ts (which stays
 * the single source of the validation rules — these only stop impossible characters and extra
 * length while typing). Identical copies live in Buyer/, Seller/ and Admin/ at
 * `src/lib/validation/fieldInput.ts` — edit one, copy to the others.
 *
 * Phones work in two modes:
 *  - A known country (the form has a Country field): the input holds national digits only,
 *    capped at that country's maximum length.
 *  - No country (sign-in, registration, contact fields): the country is picked up from what is
 *    typed. A leading "+" plus a dial code selects that country; bare digits are a number in
 *    `fallback` (India by default), so existing 10-digit entry keeps working.
 */
import { PHONE_RULES, countryFromDial, phoneMaxDigits } from "./countryRules";

/** E.164: at most 15 digits after the "+". */
const E164_MAX_DIGITS = 15;

const digitsOf = (value: string): string => value.replace(/\D/g, "");

/** Country a typed phone value belongs to: its "+" dial code, else the fallback. */
export function phoneCountryOf(value: string, fallback: string = "IN"): string | null {
  if (value.trim().startsWith("+")) return countryFromDial(value);
  return fallback;
}

/** Label for a phone prefix chip: "+91" for national entry, the ISO code once a "+" code is typed. */
export function phonePrefixLabel(value: string, fallback: string = "IN"): string {
  if (!value.trim().startsWith("+")) return PHONE_RULES[fallback]?.dial ?? "+";
  return countryFromDial(value) ?? "+";
}

/** An example national number for the country, for placeholders. */
export function phonePlaceholder(countryCode?: string | null): string {
  return (countryCode && PHONE_RULES[countryCode.toUpperCase()]?.example) || "Phone number";
}

/**
 * Cleans a phone value on every keystroke or paste so it can never hold letters or extra
 * digits. With `countryCode` the result is national digits; without it, see the module note.
 */
export function sanitizePhone(raw: string, countryCode?: string | null, fallback: string = "IN"): string {
  const trimmed = raw.trim();
  let digits = digitsOf(trimmed);

  if (countryCode) {
    const rule = PHONE_RULES[countryCode.toUpperCase()];
    const max = phoneMaxDigits(countryCode);
    const dial = rule?.dial.slice(1);
    // A pasted "+91 98765 43210" (or "919876543210") keeps only the national part.
    if (dial && digits.length > max && digits.startsWith(dial)) digits = digits.slice(dial.length);
    if (digits.length > max) digits = digits.replace(/^0+/, "");
    return digits.slice(0, max);
  }

  if (trimmed.startsWith("+")) {
    const country = countryFromDial(trimmed);
    const rule = country ? PHONE_RULES[country] : undefined;
    const cap = rule ? rule.dial.length - 1 + rule.max : E164_MAX_DIGITS;
    return `+${digits.slice(0, Math.min(cap, E164_MAX_DIGITS))}`;
  }

  const rule = PHONE_RULES[fallback];
  const max = phoneMaxDigits(fallback);
  const dial = rule?.dial.slice(1);
  // A pasted international number without its "+" ("919876543210") is read as one.
  if (dial && digits.length > max && digits.startsWith(dial)) {
    return `+${digits.slice(0, dial.length + max)}`;
  }
  if (digits.length > max) digits = digits.replace(/^0+/, "");
  return digits.slice(0, max);
}

/** Moves a phone value to another country, keeping the national digits the user typed. */
export function rehomePhone(value: string, fromCountry: string | null | undefined, toCountry: string): string {
  return sanitizePhone(fromCountry ? sanitizePhone(value, fromCountry) : value, toCountry);
}

// ── Postal codes ────────────────────────────────────────────────────────────

/** Countries whose postal code is digits only, with its exact length (see countryRules POSTAL). */
const NUMERIC_POSTAL: Record<string, number> = {
  IN: 6, AU: 4, NZ: 4, DE: 5, FR: 5, IT: 5, ES: 5, SG: 6, CN: 6, BD: 4, NP: 5, LK: 5, PK: 5,
  MX: 5, RU: 6, TR: 5, ZA: 4,
};
/** Digits with an optional hyphen: US ZIP+4, Japan, Brazil. */
const HYPHEN_POSTAL: Record<string, number> = { US: 10, JP: 8, BR: 9 };

/** Longest postal code the country allows, for the input's maxLength. */
export function postalMaxLength(countryCode?: string | null): number {
  const code = (countryCode ?? "").toUpperCase();
  return NUMERIC_POSTAL[code] ?? HYPHEN_POSTAL[code] ?? 10;
}

/** Strips characters the country's postal code can never contain and caps its length. */
export function sanitizePostal(raw: string, countryCode?: string | null): string {
  const code = (countryCode ?? "").toUpperCase();
  const max = postalMaxLength(code);
  if (NUMERIC_POSTAL[code]) return digitsOf(raw).slice(0, max);
  if (HYPHEN_POSTAL[code]) return raw.replace(/[^\d-]/g, "").slice(0, max);
  return raw.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, max);
}

/** Placeholder for the postal input: "PIN code" for India, a generic hint elsewhere. */
export function postalPlaceholder(countryCode?: string | null): string {
  const code = (countryCode ?? "").toUpperCase();
  if (code === "IN") return "6-digit PIN code";
  return NUMERIC_POSTAL[code] ? `${NUMERIC_POSTAL[code]}-digit postal code` : "Postal / ZIP code";
}
