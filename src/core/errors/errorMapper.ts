/**
 * Turns API failures into text a seller can act on.
 *
 * - The error code decides the kind where the API sends one (SELLER_APPROVAL_PENDING,
 *   ACCOUNT_VERIFICATION_REQUIRED, MAINTENANCE_MODE, FEATURE_NOT_AVAILABLE, upload limits);
 *   otherwise the status does (401, 403, 423, 429, network, server).
 * - Anything the API says that has no mapping is shown exactly as the server wrote it; throttle
 *   messages especially must not be paraphrased.
 * - Validation failures prefer the per-field reasons in `details` and are also returned per field
 *   so forms can highlight the right input.
 * - Sign-in never reveals whether an account exists: a 401 on password sign-in is always
 *   "Invalid credentials".
 */
import { ApiError } from '@tradevistar/seller-api';
import { t as translateNow, type Translate } from '@/i18n';

/**
 * Where the failure happened. The sign-in family never reveals whether an account exists, and the
 * code contexts turn the server's "wrong or expired code" into one fixed sentence.
 */
export type ErrorContext =
  | 'passwordLogin'
  | 'otpLogin'
  | 'otpRequest'
  | 'otpVerify'
  | 'twoFactor'
  | 'register'
  | 'reset'
  | 'generic';

const CODE_CONTEXTS: readonly ErrorContext[] = [
  'otpLogin',
  'otpVerify',
  'twoFactor',
  'reset',
];

export type ErrorKind =
  | 'network'
  | 'invalidCredentials'
  | 'otpInvalid'
  | 'ticket'
  | 'conflict'
  | 'locked'
  | 'suspended'
  | 'notSeller'
  | 'approvalPending'
  | 'rejected'
  | 'verificationRequired'
  | 'maintenance'
  | 'featureNotAvailable'
  | 'uploadTooLarge'
  | 'rateLimited'
  | 'preferenceLocked'
  | 'staleVersion'
  | 'ticketClosed'
  | 'validation'
  | 'server'
  | 'unknown';

export type ErrorAction =
  | 'contactSupport'
  | 'completeKyc'
  | 'viewPlans'
  | 'recoverAccount'
  | 'createSellerAccount';

export interface MappedError {
  kind: ErrorKind;
  status: number;
  message: string;
  action?: ErrorAction;
  /** Per-field messages keyed by the API's field name (email, password, …). */
  fieldErrors?: Record<string, string>;
}

const FIELDS = [
  'identifier',
  'email',
  'phone',
  'password',
  'newPassword',
  'code',
  'companyName',
  'gstin',
  'categoryCode',
  'businessCountryCode',
];

/** The role-mismatch messages the API sends without a stable code. */
const NO_SELLER_ACCESS = /no seller (?:access|account)|register as a seller/i;
/** What the support API says when a closed ticket is written to. */
const TICKET_CLOSED = /ticket is closed|raise a new one/i;
/** What the OTP endpoints say for a wrong, used or expired code. */
const CODE_REJECTED = /code|otp|expired|not found/i;

function detailLines(error: ApiError): string[] {
  const details = error.details;
  if (!Array.isArray(details)) return [];
  return details.filter((line): line is string => typeof line === 'string');
}

function fieldErrorsOf(lines: string[]): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  for (const line of lines) {
    const field = FIELDS.find(
      name => line.startsWith(`${name} `) || line.startsWith(`${name}.`),
    );
    if (field && !result[field]) result[field] = line;
  }
  return Object.keys(result).length ? result : undefined;
}

/** When a maintenance window ends, from the 503's `details.endsAt`, if the server sent it. */
export function maintenanceEndsAt(error: ApiError): Date | null {
  const details = error.details as { endsAt?: unknown } | undefined;
  if (!details || typeof details.endsAt !== 'string') return null;
  const date = new Date(details.endsAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The throttler's own 429 text says nothing useful; its replacement is the spec's wording. */
function isGenericThrottle(message: string): boolean {
  return /throttlerexception|too many requests/i.test(message);
}

function formatWhen(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function mapError(
  error: unknown,
  context: ErrorContext = 'generic',
  t: Translate = translateNow,
): MappedError {
  if (error instanceof Error && error.name === 'NotASellerError') {
    return { kind: 'notSeller', status: 403, message: t('error.notSeller') };
  }
  if (!(error instanceof ApiError)) {
    return { kind: 'unknown', status: -1, message: t('error.generic') };
  }
  const status = error.statusCode;
  const serverMessage = error.message ?? '';

  switch (error.code) {
    case 'ROLE_NOT_ALLOWED':
      return { kind: 'notSeller', status, message: t('error.notSeller') };
    case 'SELLER_APPROVAL_PENDING':
      return {
        kind: 'approvalPending',
        status,
        message: serverMessage || t('error.sellerApprovalPending'),
      };
    case 'SELLER_REJECTED':
      return {
        kind: 'rejected',
        status,
        // The server's text carries the admin's reason.
        message: serverMessage || t('error.sellerRejected'),
        action: 'contactSupport',
      };
    case 'ACCOUNT_VERIFICATION_REQUIRED':
      return {
        kind: 'verificationRequired',
        status,
        message: t('error.verificationRequired'),
        action: 'completeKyc',
      };
    case 'MAINTENANCE_MODE': {
      const endsAt = maintenanceEndsAt(error);
      return {
        kind: 'maintenance',
        status,
        message: endsAt
          ? t('error.maintenanceUntil', { when: formatWhen(endsAt) })
          : t('error.maintenance'),
      };
    }
    case 'FEATURE_NOT_AVAILABLE':
      return {
        kind: 'featureNotAvailable',
        status,
        message: t('error.featureNotAvailable'),
        action: 'viewPlans',
      };
    case 'UPLOAD_TOO_LARGE':
      return {
        kind: 'uploadTooLarge',
        status,
        message: t('error.uploadTooLarge'),
      };
    // Phase 2: notification preferences and the optimistic-concurrency version.
    case 'NOTIFICATION_LOCKED':
      return {
        kind: 'preferenceLocked',
        status,
        message: t('prefs.error.locked'),
      };
    case 'STALE_RESOURCE_VERSION':
      return { kind: 'staleVersion', status, message: t('error.staleVersion') };
    default:
      break;
  }

  // Support: the API answers 409 with a sentence (no code) when a closed ticket is replied to.
  if (status === 409 && TICKET_CLOSED.test(serverMessage)) {
    return { kind: 'ticketClosed', status, message: t('error.ticketClosed') };
  }

  if (status === 413) {
    return {
      kind: 'uploadTooLarge',
      status,
      message: t('error.uploadTooLarge'),
    };
  }

  if (error.isNetworkError || status === 0) {
    return { kind: 'network', status: 0, message: t('error.network') };
  }

  if (status === 429) {
    const message =
      context !== 'generic' ||
      isGenericThrottle(serverMessage) ||
      !serverMessage
        ? t('error.tooManyAttempts')
        : serverMessage;
    return { kind: 'rateLimited', status, message };
  }

  // The server's own text says when the lock lifts, so it is shown as sent.
  if (status === 423) {
    return {
      kind: 'locked',
      status,
      message: serverMessage || t('error.locked'),
      action: 'recoverAccount',
    };
  }

  if (status === 403) {
    // Wrong-role answers have no stable code: show the server's words and offer the way forward.
    return {
      kind: NO_SELLER_ACCESS.test(serverMessage) ? 'notSeller' : 'suspended',
      status,
      message: serverMessage || t('error.suspended'),
      action: /register as a seller/i.test(serverMessage)
        ? 'createSellerAccount'
        : 'contactSupport',
    };
  }

  if (status === 401) {
    if (context === 'passwordLogin') {
      return {
        kind: 'invalidCredentials',
        status,
        message: t('error.invalidCredentials'),
      };
    }
    if (context === 'register') {
      return { kind: 'ticket', status, message: t('register.ticketRejected') };
    }
    if (CODE_CONTEXTS.includes(context) && CODE_REJECTED.test(serverMessage)) {
      return { kind: 'otpInvalid', status, message: t('auth.otp.invalid') };
    }
    return {
      kind: 'invalidCredentials',
      status,
      message: serverMessage || t('error.generic'),
    };
  }

  if (status === 409) {
    return {
      kind: 'conflict',
      status,
      message: serverMessage || t('error.generic'),
    };
  }

  if (status === 400 || status === 422) {
    if (CODE_CONTEXTS.includes(context) && CODE_REJECTED.test(serverMessage)) {
      return { kind: 'otpInvalid', status, message: t('auth.otp.invalid') };
    }
    const lines = detailLines(error);
    return {
      kind: 'validation',
      status,
      message: lines.length
        ? lines.join(' ')
        : serverMessage || t('error.generic'),
      fieldErrors: fieldErrorsOf(lines),
    };
  }

  if (status >= 500) {
    return { kind: 'server', status, message: t('error.server') };
  }

  return {
    kind: 'unknown',
    status,
    message: serverMessage || t('error.generic'),
  };
}

/**
 * The sentence for a failed write: the mapper's wording, or `fallback` when the failure is one it
 * has no words for (not an API error at all).
 */
export function writeFailureMessage(error: unknown, fallback: string): string {
  const mapped = mapError(error);
  return mapped.kind === 'unknown' ? fallback : mapped.message;
}
