/**
 * Seller registration rules that do not depend on any screen: when a password is asked for, how
 * long a verification ticket stays usable, and how the form's fields are cleaned.
 */
import { REGISTER_TICKET_TTL_MS } from "../endpoints/auth";

/** The email pattern the web register form uses before it sends a code. */
export const REGISTER_EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export const COMPANY_NAME_MAX = 200;
export const CATEGORY_CODE_MAX = 100;
export const GSTIN_LENGTH = 15;

/** What the two verifications said about the accounts behind the mobile and the email. */
export interface AccountLinking {
  phoneExisting: boolean;
  emailExisting: boolean;
  /** Either account already has a password its owner set. */
  accountHasPassword: boolean;
}

/** An existing account (a buyer, say) gets seller access added instead of a second account. */
export const isLinkingExisting = (linking: AccountLinking): boolean =>
  linking.phoneExisting || linking.emailExisting;

/**
 * A password is asked for unless the account being joined already has one: the server refuses a
 * new password for such an account ("leave the password empty"), so the app must omit it.
 */
export const needsPassword = (linking: AccountLinking): boolean =>
  !isLinkingExisting(linking) || !linking.accountHasPassword;

/** GSTIN as typed: upper case, only 0–9 and A–Z, at most 15 characters. */
export const sanitizeGstin = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, GSTIN_LENGTH);

export interface VerificationTicket {
  value: string;
  /** The identifier the ticket proves, in the form it was sent. */
  identifier: string;
  /** Device clock when the code was verified. */
  issuedAt: number;
}

/** A little margin so a ticket is never presented seconds before it expires. */
export const TICKET_MARGIN_MS = 60_000;

/** The ticket's value if it is for this identifier and still comfortably valid, else null. */
export function usableTicket(
  ticket: VerificationTicket | null | undefined,
  identifier: string,
  now: number = Date.now(),
): string | null {
  if (!ticket || ticket.identifier !== identifier) return null;
  return now - ticket.issuedAt < REGISTER_TICKET_TTL_MS - TICKET_MARGIN_MS ? ticket.value : null;
}

/** True when a ticket exists for the identifier but has aged out. */
export function ticketExpired(
  ticket: VerificationTicket | null | undefined,
  identifier: string,
  now: number = Date.now(),
): boolean {
  return Boolean(ticket && ticket.identifier === identifier && usableTicket(ticket, identifier, now) === null);
}
