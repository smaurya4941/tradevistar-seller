/**
 * The last step of registration: POST /auth/register/seller with both verification tickets.
 *
 * Split out of the screen so the rules are tested alone:
 * - a ticket that has expired locally sends the seller back to that verification before anything
 *   is sent;
 * - the password is sent only when the account being joined has none (the server refuses a new
 *   one for an account whose owner already set it);
 * - the idempotency key is minted once per distinct payload, so a retry of the same registration
 *   is recognised, while an edited one is a new request;
 * - a rejected ticket, or a conflict, returns the seller to the step that owns the problem.
 */
import {
  usableTicket,
  validateGstin,
  type SellerRegistrationInput,
  type SellerRegistrationResult,
} from '@tradevistar/seller-api';
import { mapError, type MappedError } from '@/core/errors/errorMapper';
import type { Translate } from '@/i18n';
import {
  clearDraft,
  draftNeedsPassword,
  updateDraft,
  type RegistrationDraft,
} from './registrationDraft';

export type RegistrationStep = 'mobile' | 'email' | 'password' | 'business';

export type RegistrationOutcome =
  | { kind: 'done'; linked: boolean }
  /** Go back to this step and verify again; the message says why. */
  | { kind: 'verify'; step: 'mobile' | 'email'; message: string }
  /** Fix this on the business step. */
  | {
      kind: 'businessError';
      message: string;
      fieldErrors?: Record<string, string>;
    }
  /** An account already uses this mobile number or email. */
  | { kind: 'conflict'; step: 'mobile' | 'email'; message: string }
  | { kind: 'failed'; error: MappedError };

export interface RegistrationApi {
  registerSeller(
    input: SellerRegistrationInput,
    idempotencyKey?: string,
  ): Promise<SellerRegistrationResult>;
}

/** The first step that still needs a verified code, or null when both are good. */
export function firstUnverifiedStep(
  draft: RegistrationDraft,
  now: number = Date.now(),
): 'mobile' | 'email' | null {
  if (!usableTicket(draft.phoneTicket, draft.mobile, now)) return 'mobile';
  if (!usableTicket(draft.emailTicket, draft.email, now)) return 'email';
  return null;
}

/** The request body for a draft whose tickets are good; the caller checks that first. */
export function buildRegistrationInput(
  draft: RegistrationDraft,
  now: number = Date.now(),
): SellerRegistrationInput | null {
  const phoneTicket = usableTicket(draft.phoneTicket, draft.mobile, now);
  const emailTicket = usableTicket(draft.emailTicket, draft.email, now);
  if (!phoneTicket || !emailTicket) return null;
  const category = draft.categoryCode.trim();
  return {
    phone: draft.mobile,
    email: draft.email,
    ...(draftNeedsPassword(draft) ? { password: draft.password } : {}),
    phoneTicket,
    emailTicket,
    companyName: draft.companyName.trim(),
    ...(draft.gstin ? { gstin: draft.gstin } : {}),
    ...(category ? { categoryCode: category } : {}),
    businessCountryCode: draft.countryCode,
  };
}

/** Same payload, same key; any change mints a new one. The password is part of the payload. */
export function idempotencyKeyFor(
  draft: RegistrationDraft,
  input: SellerRegistrationInput,
  newKey: () => string,
): string {
  const fingerprint = JSON.stringify(input);
  if (draft.submitKey?.fingerprint === fingerprint) return draft.submitKey.key;
  const key = newKey();
  updateDraft({ submitKey: { fingerprint, key } });
  return key;
}

/** Validates the business step. Returns field errors, or an empty object. */
export function businessErrors(
  draft: Pick<RegistrationDraft, 'companyName' | 'gstin' | 'countryCode'>,
  t: Translate,
): { companyName?: string; gstin?: string; country?: string } {
  const errors: { companyName?: string; gstin?: string; country?: string } = {};
  if (!draft.companyName.trim()) {
    errors.companyName = t('register.business.companyRequired');
  }
  const gstinProblem = draft.gstin ? validateGstin(draft.gstin) : null;
  if (gstinProblem) errors.gstin = gstinProblem;
  if (!draft.countryCode.trim()) {
    errors.country = t('register.business.countryRequired');
  }
  return errors;
}

export async function submitRegistration(
  api: RegistrationApi,
  draft: RegistrationDraft,
  newKey: () => string,
  t: Translate,
  now: number = Date.now(),
): Promise<RegistrationOutcome> {
  const unverified = firstUnverifiedStep(draft, now);
  if (unverified) {
    return {
      kind: 'verify',
      step: unverified,
      message:
        unverified === 'mobile'
          ? t('register.ticketExpired.mobile')
          : t('register.ticketExpired.email'),
    };
  }
  const input = buildRegistrationInput(draft, now);
  if (!input)
    return {
      kind: 'verify',
      step: 'mobile',
      message: t('register.ticketRejected'),
    };

  try {
    const result = await api.registerSeller(
      input,
      idempotencyKeyFor(draft, input, newKey),
    );
    clearDraft();
    return { kind: 'done', linked: result.linkedExistingAccount };
  } catch (caught) {
    const mapped = mapError(caught, 'register', t);
    if (mapped.kind === 'ticket') {
      // The server does not say which proof was refused: both are cleared and verified again.
      updateDraft({ phoneTicket: null, emailTicket: null });
      return { kind: 'verify', step: 'mobile', message: mapped.message };
    }
    if (mapped.kind === 'conflict') {
      const step = /e-?mail/i.test(mapped.message) ? 'email' : 'mobile';
      return { kind: 'conflict', step, message: mapped.message };
    }
    if (mapped.kind === 'validation') {
      return {
        kind: 'businessError',
        message: mapped.message,
        fieldErrors: mapped.fieldErrors,
      };
    }
    return { kind: 'failed', error: mapped };
  }
}
