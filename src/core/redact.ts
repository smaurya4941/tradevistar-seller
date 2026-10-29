/**
 * Redaction primitives shared by logging, analytics and crash reports. Depends on nothing else in
 * the app, so the logger can use it without an import cycle.
 */
export const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
export const PHONE = /(?:\+?\d[\s-]?){10,}/;
export const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/i;

export const REDACTED = '[redacted]';

/** Words that make a property name sensitive: `authToken`, `otp_code`, `phone`; not `status_code`. */
const SENSITIVE_WORDS = new Set([
  'authorization',
  'cookie',
  'cookies',
  'token',
  'tokens',
  'jwt',
  'bearer',
  'password',
  'passwd',
  'secret',
  'otp',
  'ticket',
  'challenge',
  'email',
  'phone',
  'mobile',
  'gstin',
  'gst',
  'pan',
  'aadhaar',
  'identifier',
  'address',
  'account',
  'accountnumber',
  'ifsc',
  'upi',
  'invitation',
]);

/**
 * Names that are sensitive only as a whole (`documentNumber` holds a licence or certificate number,
 * `documentType` does not), so they are matched after the separators are removed.
 */
const SENSITIVE_COMPOUND = new Set([
  'documentnumber',
  'exemptioncertnumber',
  'lutnumber',
  'taxidentificationnumber',
  'registrationnumber',
  'signedurl',
  'fileurl',
  'verificationtoken',
  'confirmaccountnumber',
  'emailcode',
  'mobilecode',
  'currentpassword',
  'newpassword',
  'invitationtoken',
]);

/** Whether a property name says it holds something private. Matches whole words only. */
export function isSensitiveKey(key: string): boolean {
  if (key.toLowerCase() === 'code') return true;
  if (SENSITIVE_COMPOUND.has(key.toLowerCase().replace(/[^a-z0-9]/g, '')))
    return true;
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some(word => SENSITIVE_WORDS.has(word));
}

const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
/** Header-like values: `Bearer abc`, and the refresh cookie `tv_refresh_seller=abc`. */
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;
const REFRESH_COOKIE = /\btv_refresh_[a-z]+=[^\s;,]+/gi;
/** A JWT: three base64url segments, the first two starting with `eyJ`. */
const JWT = /\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g;
/** A bank account number: a run of 9 to 18 digits, possibly grouped by spaces or dashes. */
const ACCOUNT_NUMBER = /\b\d(?:[ -]?\d){8,17}\b/g;
/** A signed link to a private file: a query string carrying a token or signature. */
const SIGNED_URL =
  /https?:\/\/[^\s"']+[?&](?:token|signature|sig|X-Amz-Signature)=[^\s"']+/gi;
/** An invitation link: the token travels in the query string. */
const INVITE_LINK = /\/seller\/invitations\/accept\?token=[^\s"'&]+/gi;

/** Replaces tokens, emails, phone numbers, GSTINs, PANs and account numbers inside free text. */
export function redactText(text: string): string {
  return text
    .replace(SIGNED_URL, REDACTED)
    .replace(INVITE_LINK, REDACTED)
    .replace(BEARER, REDACTED)
    .replace(JWT, REDACTED)
    .replace(REFRESH_COOKIE, REDACTED)
    .replace(new RegExp(EMAIL.source, 'g'), REDACTED)
    .replace(new RegExp(GSTIN.source, 'gi'), REDACTED)
    .replace(PAN, REDACTED)
    .replace(new RegExp(PHONE.source, 'g'), REDACTED)
    .replace(ACCOUNT_NUMBER, REDACTED);
}
