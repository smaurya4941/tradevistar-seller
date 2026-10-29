import { ApiError } from '@tradevistar/seller-api';
import { translate } from '@/i18n';
import { mapError } from '../errorMapper';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const api = (statusCode: number, code: string, message: string) =>
  new ApiError(statusCode, { code, message });

describe('sign-in errors', () => {
  it('a locked account shows the server message and offers recovery', () => {
    expect(
      mapError(
        api(
          423,
          'ACCOUNT_LOCKED',
          'Account locked until 10:30. Try again later.',
        ),
        'passwordLogin',
        t,
      ),
    ).toMatchObject({
      kind: 'locked',
      message: 'Account locked until 10:30. Try again later.',
      action: 'recoverAccount',
    });
  });

  it('a buyer-only account shows the server message and offers to create a seller account', () => {
    expect(
      mapError(
        api(
          403,
          'FORBIDDEN',
          'This account has no seller access — register as a seller first',
        ),
        'passwordLogin',
        t,
      ),
    ).toMatchObject({
      kind: 'notSeller',
      message: 'This account has no seller access — register as a seller first',
      action: 'createSellerAccount',
    });
  });

  it('shows the pending and rejected messages exactly as the server wrote them', () => {
    expect(
      mapError(
        api(
          403,
          'SELLER_REJECTED',
          'Your seller registration was not approved: blurry KYC',
        ),
        'generic',
        t,
      ),
    ).toMatchObject({
      kind: 'rejected',
      message: 'Your seller registration was not approved: blurry KYC',
    });
  });

  it('an unknown identifier at OTP sign-in is shown as sent', () => {
    expect(
      mapError(
        api(401, 'UNAUTHORIZED', 'No seller account with this identifier'),
        'otpLogin',
        t,
      ),
    ).toMatchObject({ message: 'No seller account with this identifier' });
  });
});

describe('codes', () => {
  it.each(['otpLogin', 'otpVerify', 'twoFactor', 'reset'] as const)(
    'a wrong or expired code in %s reads the same',
    context => {
      expect(
        mapError(
          api(401, 'UNAUTHORIZED', 'Invalid or expired code'),
          context,
          t,
        ),
      ).toMatchObject({
        kind: 'otpInvalid',
        message: 'Invalid or expired code.',
      });
    },
  );

  it('the reset endpoint says a code is gone as a 400', () => {
    expect(
      mapError(
        api(
          400,
          'BAD_REQUEST',
          'Code expired or not found — request a new one',
        ),
        'reset',
        t,
      ),
    ).toMatchObject({ kind: 'otpInvalid' });
  });
});

describe('throttling', () => {
  it.each([
    'passwordLogin',
    'otpLogin',
    'otpRequest',
    'twoFactor',
    'register',
  ] as const)('a 429 in %s asks for a minute', context => {
    expect(
      mapError(
        api(429, 'THROTTLED', 'ThrottlerException: Too Many Requests'),
        context,
        t,
      ),
    ).toMatchObject({
      kind: 'rateLimited',
      message: 'Too many attempts. Wait a minute and try again.',
    });
  });
});

describe('registration', () => {
  it('a 401 on submit means a verification ticket was refused', () => {
    expect(
      mapError(
        api(401, 'UNAUTHORIZED', 'Verification ticket was already used'),
        'register',
        t,
      ),
    ).toMatchObject({ kind: 'ticket' });
  });

  it('a 409 is a conflict with the server message', () => {
    expect(
      mapError(
        api(409, 'CONFLICT', 'An account with this email already exists'),
        'register',
        t,
      ),
    ).toMatchObject({
      kind: 'conflict',
      message: 'An account with this email already exists',
    });
  });

  it('field problems are returned per field', () => {
    const error = new ApiError(400, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [
        'companyName must be shorter than or equal to 200 characters',
        'gstin is not valid',
      ],
    });
    expect(mapError(error, 'register', t).fieldErrors).toEqual({
      companyName:
        'companyName must be shorter than or equal to 200 characters',
      gstin: 'gstin is not valid',
    });
  });
});

describe('maintenance and verification', () => {
  it('a paused write names when it is available again', () => {
    const error = new ApiError(503, {
      code: 'MAINTENANCE_MODE',
      message: 'paused',
      details: { endsAt: '2026-10-20T10:00:00.000Z' },
    });
    expect(mapError(error, 'generic', t)).toMatchObject({
      kind: 'maintenance',
    });
  });

  it('an unverified write opens the KYC path', () => {
    expect(
      mapError(api(403, 'ACCOUNT_VERIFICATION_REQUIRED', 'x'), 'generic', t),
    ).toMatchObject({ kind: 'verificationRequired', action: 'completeKyc' });
  });

  it('no network', () => {
    expect(
      mapError(
        new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' }),
        'passwordLogin',
        t,
      ),
    ).toMatchObject({ kind: 'network' });
  });
});
