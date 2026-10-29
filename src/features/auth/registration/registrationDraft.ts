/**
 * The seller registration form while the seller moves between its steps, or leaves the app for a
 * while.
 *
 * - Identifiers and business fields are saved on the device (MMKV) so a restart does not make the
 *   seller retype them.
 * - The password, the confirmation and the verification tickets live in memory only. A ticket is
 *   proof of a verified code; it is never written to storage, and neither is the password.
 * - A ticket is usable only for the identifier it was issued for and for a while after (see
 *   `usableTicket`); an edited number or email therefore always needs a new code.
 */
import {
  needsPassword,
  usableTicket,
  type AccountLinking,
  type VerificationTicket,
} from '@tradevistar/seller-api';
import { createStore, useStore } from '@/core/store';
import {
  deviceStorage,
  DeviceKeys,
  readJson,
  writeJson,
} from '@/core/storage/kv';

/** What is written to the device. No password, no tickets, no codes. */
export interface PersistedDraft {
  mobile: string;
  email: string;
  companyName: string;
  gstin: string;
  countryCode: string;
  countryName: string;
  categoryCode: string;
  categoryName: string;
}

export interface RegistrationDraft extends PersistedDraft {
  password: string;
  confirmPassword: string;
  phoneTicket: VerificationTicket | null;
  emailTicket: VerificationTicket | null;
  phoneExisting: boolean;
  emailExisting: boolean;
  /** The account behind this identifier already has a password its owner set. */
  phonePasswordSet: boolean;
  emailPasswordSet: boolean;
  /** Device clock when a code was last sent; drives the resend countdown across screens. */
  phoneCodeSentAt: number | null;
  emailCodeSentAt: number | null;
  /** Errors from a failed submit, shown on the step that owns the field. */
  serverErrors: { mobile?: string; email?: string };
  /** One key per distinct payload, so a retry of the same registration is de-duplicated. */
  submitKey: { fingerprint: string; key: string } | null;
}

export const EMPTY_DRAFT: RegistrationDraft = {
  mobile: '',
  email: '',
  companyName: '',
  gstin: '',
  // Registration needs an Indian mobile number, so India is the starting point.
  countryCode: 'IN',
  countryName: 'India',
  categoryCode: '',
  categoryName: '',
  password: '',
  confirmPassword: '',
  phoneTicket: null,
  emailTicket: null,
  phoneExisting: false,
  emailExisting: false,
  phonePasswordSet: false,
  emailPasswordSet: false,
  phoneCodeSentAt: null,
  emailCodeSentAt: null,
  serverErrors: {},
  submitKey: null,
};

const PERSISTED_KEYS: (keyof PersistedDraft)[] = [
  'mobile',
  'email',
  'companyName',
  'gstin',
  'countryCode',
  'countryName',
  'categoryCode',
  'categoryName',
];

/** The only fields that may reach storage. */
export function persistedFields(draft: RegistrationDraft): PersistedDraft {
  const out = {} as PersistedDraft;
  for (const key of PERSISTED_KEYS) out[key] = draft[key];
  return out;
}

function load(): RegistrationDraft {
  try {
    const saved = readJson<Partial<PersistedDraft>>(
      deviceStorage,
      DeviceKeys.registrationDraft,
    );
    if (!saved || typeof saved !== 'object') return EMPTY_DRAFT;
    const draft = { ...EMPTY_DRAFT };
    for (const key of PERSISTED_KEYS) {
      if (typeof saved[key] === 'string') draft[key] = saved[key] as string;
    }
    return draft;
  } catch {
    return EMPTY_DRAFT;
  }
}

export const registrationDraft = createStore<RegistrationDraft>(load());

registrationDraft.subscribe(() => {
  try {
    writeJson(
      deviceStorage,
      DeviceKeys.registrationDraft,
      persistedFields(registrationDraft.get()),
    );
  } catch {
    // Without the saved copy the seller retypes after a restart; not worth interrupting for.
  }
});

export function updateDraft(patch: Partial<RegistrationDraft>): void {
  registrationDraft.set(previous => ({ ...previous, ...patch }));
}

export function clearDraft(): void {
  registrationDraft.set(EMPTY_DRAFT);
  try {
    deviceStorage.remove(DeviceKeys.registrationDraft);
  } catch {
    // Nothing to clear.
  }
}

export function useDraft(): RegistrationDraft {
  return useStore(registrationDraft);
}

export const linkingOf = (draft: RegistrationDraft): AccountLinking => ({
  phoneExisting: draft.phoneExisting,
  emailExisting: draft.emailExisting,
  accountHasPassword: draft.phonePasswordSet || draft.emailPasswordSet,
});

export const draftNeedsPassword = (draft: RegistrationDraft): boolean =>
  needsPassword(linkingOf(draft));

export const phoneVerified = (
  draft: RegistrationDraft,
  now: number = Date.now(),
): boolean => usableTicket(draft.phoneTicket, draft.mobile, now) !== null;

export const emailVerified = (
  draft: RegistrationDraft,
  now: number = Date.now(),
): boolean => usableTicket(draft.emailTicket, draft.email, now) !== null;
