/**
 * Country- and document-aware validation rules for structured fields.
 *
 * This file is dependency-free on purpose: the SAME source is copied verbatim to
 * Buyer/, Seller/ and Admin/ at `src/lib/validation/countryRules.ts` so the browser and the
 * API apply identical rules. A backend spec fails if the copies drift — edit here, then copy.
 *
 * Every validator returns `null` when the value is acceptable, otherwise a message that is
 * safe to show inline. Free-text fields (names, addresses, descriptions) are NOT handled
 * here; they get length/character limits at their DTO.
 */

export interface PhoneRule {
  /** International dialling prefix, with the leading "+". */
  dial: string;
  /** Allowed length of the national number (digits after the dial code). */
  min: number;
  max: number;
  /** Extra shape check on the national number, when the numbering plan is strict. */
  pattern?: RegExp;
  example: string;
}

const rule = (dial: string, min: number, max: number, example: string, pattern?: RegExp): PhoneRule => ({
  dial,
  min,
  max,
  example,
  pattern,
});

export const PHONE_RULES: Record<string, PhoneRule> = {
  IN: rule('+91', 10, 10, '9876543210', /^[6-9]\d{9}$/),
  US: rule('+1', 10, 10, '2025550123', /^[2-9]\d{2}[2-9]\d{6}$/),
  CA: rule('+1', 10, 10, '4165550123', /^[2-9]\d{2}[2-9]\d{6}$/),
  GB: rule('+44', 10, 10, '7911123456', /^[1-9]\d{9}$/),
  AE: rule('+971', 9, 9, '501234567', /^[2-9]\d{8}$/),
  SA: rule('+966', 9, 9, '512345678', /^[1-9]\d{8}$/),
  SG: rule('+65', 8, 8, '81234567', /^[3689]\d{7}$/),
  AU: rule('+61', 9, 9, '412345678', /^[2-478]\d{8}$/),
  NZ: rule('+64', 8, 10, '211234567'),
  DE: rule('+49', 10, 11, '15123456789'),
  FR: rule('+33', 9, 9, '612345678', /^[1-9]\d{8}$/),
  IT: rule('+39', 9, 11, '3123456789'),
  ES: rule('+34', 9, 9, '612345678', /^[6-9]\d{8}$/),
  NL: rule('+31', 9, 9, '612345678', /^[1-9]\d{8}$/),
  CN: rule('+86', 11, 11, '13812345678', /^1[3-9]\d{9}$/),
  JP: rule('+81', 10, 10, '9012345678', /^[1-9]\d{9}$/),
  KR: rule('+82', 9, 10, '1012345678'),
  HK: rule('+852', 8, 8, '51234567', /^[2-9]\d{7}$/),
  MY: rule('+60', 9, 10, '123456789'),
  ID: rule('+62', 9, 12, '81234567890'),
  TH: rule('+66', 9, 9, '812345678', /^[2-9]\d{8}$/),
  VN: rule('+84', 9, 10, '912345678'),
  PH: rule('+63', 10, 10, '9171234567', /^9\d{9}$/),
  BD: rule('+880', 10, 10, '1712345678', /^1[3-9]\d{8}$/),
  NP: rule('+977', 10, 10, '9812345678', /^9[78]\d{8}$/),
  LK: rule('+94', 9, 9, '712345678', /^[1-9]\d{8}$/),
  PK: rule('+92', 10, 10, '3012345678', /^3\d{9}$/),
  ZA: rule('+27', 9, 9, '821234567', /^[1-9]\d{8}$/),
  NG: rule('+234', 10, 10, '8012345678'),
  KE: rule('+254', 9, 9, '712345678', /^[17]\d{8}$/),
  EG: rule('+20', 10, 10, '1001234567', /^1\d{9}$/),
  BR: rule('+55', 10, 11, '11912345678'),
  MX: rule('+52', 10, 10, '5512345678', /^[1-9]\d{9}$/),
  RU: rule('+7', 10, 10, '9123456789', /^[3489]\d{9}$/),
  TR: rule('+90', 10, 10, '5321234567', /^5\d{9}$/),
};

/** E.164 allows at most 15 digits including the country code; this is the safe fallback. */
const GENERIC_PHONE = { min: 6, max: 14 };

const digitsOf = (value: string): string => value.replace(/\D/g, '');

/** Country of an E.164 number, by longest matching dial prefix. Ambiguous "+1" resolves to US. */
export function countryFromDial(e164: string): string | null {
  const digits = digitsOf(e164);
  let best: string | null = null;
  let bestLength = 0;
  for (const [code, r] of Object.entries(PHONE_RULES)) {
    const dial = r.dial.slice(1);
    if (digits.startsWith(dial) && dial.length > bestLength) {
      best = code;
      bestLength = dial.length;
    }
  }
  return best;
}

/**
 * Splits a phone value into its national digits. Accepts "+91 98765 43210" or bare national
 * digits (when a country is known). Returns the country it resolved to.
 */
export function splitPhone(
  value: string,
  countryCode?: string | null,
): { country: string | null; national: string } {
  const trimmed = value.trim();
  const digits = digitsOf(trimmed);
  const hinted = countryCode ? PHONE_RULES[countryCode.toUpperCase()] : undefined;
  if (trimmed.startsWith('+')) {
    if (hinted && digits.startsWith(hinted.dial.slice(1))) {
      return { country: countryCode!.toUpperCase(), national: digits.slice(hinted.dial.length - 1) };
    }
    const resolved = countryFromDial(trimmed);
    if (resolved) {
      return { country: resolved, national: digits.slice(PHONE_RULES[resolved].dial.length - 1) };
    }
    return { country: null, national: digits };
  }
  return { country: hinted ? countryCode!.toUpperCase() : null, national: digits };
}

/** Phone check that follows the selected country's numbering plan. */
export function validatePhone(value: string, countryCode?: string | null): string | null {
  if (!value || !value.trim()) return 'Enter a phone number.';
  if (/[^\d+\s().-]/.test(value)) return 'Phone number can only contain digits.';
  const { country, national } = splitPhone(value, countryCode);
  const r = country ? PHONE_RULES[country] : undefined;
  const min = r?.min ?? GENERIC_PHONE.min;
  const max = r?.max ?? GENERIC_PHONE.max;
  if (national.length < min || national.length > max) {
    const expected = min === max ? `${min}` : `${min}–${max}`;
    return `Enter a ${expected}-digit phone number${country ? ` for ${country}` : ''}.`;
  }
  if (r?.pattern && !r.pattern.test(national)) {
    return `Enter a valid ${country} phone number, e.g. ${r.example}.`;
  }
  return null;
}

/** Digits allowed in the national-number input right now: stops "extra digits" while typing. */
export function phoneMaxDigits(countryCode?: string | null): number {
  return (countryCode && PHONE_RULES[countryCode.toUpperCase()]?.max) || GENERIC_PHONE.max;
}

/** Canonical E.164 form for storage, or null when the value is invalid for the country. */
export function toE164(value: string, countryCode?: string | null): string | null {
  if (validatePhone(value, countryCode)) return null;
  const { country, national } = splitPhone(value, countryCode);
  const dial = country ? PHONE_RULES[country].dial : null;
  return dial ? `${dial}${national}` : `+${national}`;
}

// ── Postal codes ────────────────────────────────────────────────────────────

const POSTAL: Record<string, { pattern: RegExp; example: string }> = {
  IN: { pattern: /^[1-9]\d{5}$/, example: '400001' },
  US: { pattern: /^\d{5}(-\d{4})?$/, example: '10001' },
  CA: { pattern: /^[ABCEGHJ-NPRSTVXY]\d[A-Z] ?\d[A-Z]\d$/i, example: 'K1A 0B1' },
  GB: { pattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, example: 'SW1A 1AA' },
  AU: { pattern: /^\d{4}$/, example: '2000' },
  NZ: { pattern: /^\d{4}$/, example: '6011' },
  DE: { pattern: /^\d{5}$/, example: '10115' },
  FR: { pattern: /^\d{5}$/, example: '75001' },
  IT: { pattern: /^\d{5}$/, example: '00100' },
  ES: { pattern: /^\d{5}$/, example: '28001' },
  NL: { pattern: /^\d{4} ?[A-Z]{2}$/i, example: '1012 AB' },
  SG: { pattern: /^\d{6}$/, example: '018956' },
  CN: { pattern: /^\d{6}$/, example: '100000' },
  JP: { pattern: /^\d{3}-?\d{4}$/, example: '100-0001' },
  BD: { pattern: /^\d{4}$/, example: '1207' },
  NP: { pattern: /^\d{5}$/, example: '44600' },
  LK: { pattern: /^\d{5}$/, example: '00100' },
  PK: { pattern: /^\d{5}$/, example: '44000' },
  BR: { pattern: /^\d{5}-?\d{3}$/, example: '01310-100' },
  MX: { pattern: /^\d{5}$/, example: '06000' },
  RU: { pattern: /^\d{6}$/, example: '101000' },
  TR: { pattern: /^\d{5}$/, example: '34000' },
  ZA: { pattern: /^\d{4}$/, example: '2000' },
};
/** Countries without a rule here accept a short alphanumeric code but nothing malformed. */
const GENERIC_POSTAL = /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/;

export function validatePostal(value: string, countryCode?: string | null): string | null {
  const v = (value ?? '').trim();
  if (!v) return 'Enter a PIN / ZIP code.';
  const r = countryCode ? POSTAL[countryCode.toUpperCase()] : undefined;
  if (r) {
    return r.pattern.test(v)
      ? null
      : `Enter a valid ${countryCode!.toUpperCase() === 'IN' ? '6-digit PIN code' : 'postal code'}, e.g. ${r.example}.`;
  }
  return GENERIC_POSTAL.test(v) ? null : 'Enter a valid postal code (2–10 letters, digits, space or hyphen).';
}

// ── India identity / tax / bank documents ───────────────────────────────────

const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GST_STATE_CODES = new Set([
  ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')),
  '97',
  '99',
]);

export const PAN_REGEX = /^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/;

function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const product = B36.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return B36[(36 - (sum % 36)) % 36];
}

export function validateGstin(value: string): string | null {
  const v = (value ?? '').trim().toUpperCase();
  if (v.length !== 15) return 'A GSTIN is exactly 15 characters.';
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) {
    return 'Enter a valid GSTIN, e.g. 27AAPFU0939F1ZV.';
  }
  if (!GST_STATE_CODES.has(v.slice(0, 2))) return 'GSTIN starts with an invalid state code.';
  if (!PAN_REGEX.test(v.slice(2, 12))) return 'The PAN inside this GSTIN is not valid.';
  if (gstinCheckChar(v.slice(0, 14)) !== v[14]) return 'This GSTIN fails its check-digit test.';
  return null;
}

export const validatePan = (value: string): string | null =>
  PAN_REGEX.test((value ?? '').trim().toUpperCase()) ? null : 'Enter a valid 10-character PAN, e.g. ABCPE1234F.';

// Verhoeff tables, used by UIDAI for the Aadhaar check digit.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function validateAadhaar(value: string): string | null {
  const v = (value ?? '').replace(/\s/g, '');
  if (!/^[2-9]\d{11}$/.test(v)) return 'Aadhaar is 12 digits and cannot start with 0 or 1.';
  let c = 0;
  [...v].reverse().forEach((ch, i) => {
    c = D[c][P[i % 8][Number(ch)]];
  });
  return c === 0 ? null : 'This Aadhaar number is not valid.';
}

export const validateIfsc = (value: string): string | null =>
  /^[A-Z]{4}0[A-Z0-9]{6}$/.test((value ?? '').trim().toUpperCase())
    ? null
    : 'Enter a valid 11-character IFSC, e.g. HDFC0001234.';

/** Indian accounts are 9–18 digits; elsewhere IBAN/BBAN styles run 6–34 letters and digits. */
export function validateBankAccount(value: string, countryCode?: string | null): string | null {
  const v = (value ?? '').replace(/\s/g, '');
  if ((countryCode ?? 'IN').toUpperCase() === 'IN') {
    return /^\d{9,18}$/.test(v) ? null : 'An Indian bank account number is 9 to 18 digits.';
  }
  return /^[A-Za-z0-9]{6,34}$/.test(v) ? null : 'Account number / IBAN must be 6–34 letters or digits.';
}

export type RegistrationKind =
  | 'GSTIN'
  | 'PAN'
  | 'IEC'
  | 'CIN'
  | 'TAN'
  | 'UDYAM'
  | 'FSSAI'
  | 'EXPORT_LICENSE'
  | 'OTHER';

const REGISTRATION: Record<Exclude<RegistrationKind, 'GSTIN' | 'PAN' | 'OTHER'>, { pattern: RegExp; message: string }> = {
  IEC: { pattern: /^[A-Z0-9]{10}$/, message: 'An IEC is 10 letters/digits.' },
  CIN: {
    pattern: /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/,
    message: 'Enter a valid 21-character CIN, e.g. U12345MH2020PTC123456.',
  },
  TAN: { pattern: /^[A-Z]{4}\d{5}[A-Z]$/, message: 'Enter a valid TAN, e.g. ABCD12345E.' },
  UDYAM: {
    pattern: /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/,
    message: 'Enter a valid Udyam number, e.g. UDYAM-MH-12-1234567.',
  },
  FSSAI: { pattern: /^\d{14}$/, message: 'An FSSAI licence number is 14 digits.' },
  EXPORT_LICENSE: {
    pattern: /^[A-Z0-9][A-Z0-9/.-]{4,29}$/,
    message: 'Licence number must be 5–30 letters, digits, "/", "." or "-".',
  },
};

/** Registration/licence number, validated against the selected document type. */
export function validateRegistrationNumber(kind: RegistrationKind, value: string): string | null {
  const v = (value ?? '').trim().toUpperCase();
  if (!v) return 'Enter the registration number.';
  if (kind === 'GSTIN') return validateGstin(v);
  if (kind === 'PAN') return validatePan(v);
  if (kind === 'OTHER') {
    return /^[A-Z0-9][A-Z0-9 /.-]{2,49}$/.test(v)
      ? null
      : 'Registration number must be 3–50 letters, digits, space, "/", "." or "-".';
  }
  const r = REGISTRATION[kind];
  return r.pattern.test(v) ? null : r.message;
}

/** Tax identifier outside India (VAT / EIN / TIN…): alphanumeric, 4–30 characters. */
export const validateForeignTaxId = (value: string): string | null =>
  /^[A-Za-z0-9][A-Za-z0-9 ./-]{3,29}$/.test((value ?? '').trim())
    ? null
    : 'Tax ID must be 4–30 letters, digits, space, ".", "/" or "-".';

/** Tax ID that follows the selected country: India takes a GSTIN or PAN, elsewhere a foreign ID. */
export function validateTaxId(value: string, countryCode?: string | null): string | null {
  const v = (value ?? '').trim();
  if ((countryCode ?? 'IN').toUpperCase() !== 'IN') return validateForeignTaxId(v);
  return v.length === 15 ? validateGstin(v) : validatePan(v);
}
