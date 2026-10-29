/**
 * Words for the profile area's error codes (documents, GST, bank, team, calendar, security).
 * Anything with no mapping is shown the way the error mapper shows it — the server's own text —
 * and throttle messages (GST sends per hour and day) are never paraphrased.
 */
import { ApiError } from '@tradevistar/seller-api';
import { mapError } from '@/core/errors/errorMapper';
import { t as translateNow, type Translate, type TranslationKey } from '@/i18n';

const CODE_KEYS: Record<string, TranslationKey> = {
  // Documents
  DOCUMENT_VERIFIED_LOCKED: 'error.documentLocked',
  MEDIA_NOT_CLEAN: 'error.mediaNotClean',
  // GST
  VERIFIED_CHANGE_NEEDS_CONFIRMATION: 'error.verifiedChange',
  GST_CONTACT_UNAVAILABLE: 'error.gstContactUnavailable',
  GST_CONTACT_UNSUPPORTED: 'error.gstContactUnsupported',
  // Bank
  ACCOUNT_NUMBER_MISMATCH: 'error.bank.mismatch',
  BANK_ACCOUNT_ALREADY_ADDED: 'error.bank.duplicate',
  BANK_ACCOUNT_NOT_VERIFIED: 'error.bank.notVerified',
  NO_VERIFIED_SETTLEMENT_ACCOUNT: 'error.bank.noVerified',
  AUTOMATIC_PAYOUTS_UNAVAILABLE: 'error.bank.payoutsUnavailable',
  BANK_ACCOUNT_IN_USE: 'error.bank.inUse',
  // Team
  ALREADY_A_MEMBER: 'error.team.alreadyMember',
  INVITATION_ALREADY_SENT: 'error.team.alreadySent',
  INVITATION_NOT_RESENDABLE: 'error.team.notResendable',
  INVITATION_ALREADY_ACCEPTED: 'error.team.alreadyAccepted',
  INVITATION_INVALID: 'error.team.invalid',
  INVITATION_EXPIRED: 'error.team.expired',
  INVITATION_EMAIL_MISMATCH: 'error.team.emailMismatch',
  ROLE_REQUIRED: 'error.team.roleRequired',
  OWNER_ROLES_IMMUTABLE: 'error.team.ownerRoles',
  OWNER_ROLE_NOT_ASSIGNABLE: 'error.team.ownerNotAssignable',
  OWNER_REQUIRED_FOR_ADMIN: 'error.team.ownerForAdmin',
  OWNER_PROTECTED: 'error.team.ownerProtected',
  SELF_ACTION_FORBIDDEN: 'error.team.self',
  TEAM_ADMIN_REQUIRED: 'error.team.adminRequired',
  MEMBER_NOT_FOUND: 'error.team.notFound',
  MEMBER_REMOVED: 'error.team.removed',
  MEMBER_STATUS_INVALID: 'error.team.statusInvalid',
  TARGET_NOT_ACTIVE: 'error.team.targetNotActive',
  ALREADY_OWNER: 'error.team.alreadyOwner',
};

export function profileErrorMessage(
  error: unknown,
  t: Translate = translateNow,
): string {
  if (error instanceof ApiError) {
    const key = CODE_KEYS[error.code];
    if (key) return t(key);
    // A plan limit on team seats or document storage.
    if (error.code === 'FEATURE_LIMIT_REACHED') return t('error.limitReached');
  }
  return mapError(error, 'generic', t).message;
}

export const isLimitReached = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'FEATURE_LIMIT_REACHED';

/** The server asked the seller to confirm replacing verified GST details. */
export const needsVerifiedConfirmation = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.code === 'VERIFIED_CHANGE_NEEDS_CONFIRMATION';
