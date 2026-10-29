import { ApiError } from '@tradevistar/seller-api';
import { mapError } from '../errorMapper';
import { translate } from '@/i18n';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const api = (
  statusCode: number,
  code: string,
  message = 'server message',
  details?: unknown,
) => new ApiError(statusCode, { code, message, details });

describe('error codes the seller API sends', () => {
  it('SELLER_APPROVAL_PENDING', () => {
    expect(
      mapError(api(403, 'SELLER_APPROVAL_PENDING'), 'passwordLogin', t),
    ).toMatchObject({
      kind: 'approvalPending',
      message: 'server message',
    });
  });

  it('SELLER_REJECTED points to support', () => {
    expect(mapError(api(403, 'SELLER_REJECTED'), 'generic', t)).toMatchObject({
      kind: 'rejected',
      action: 'contactSupport',
    });
  });

  it('ACCOUNT_VERIFICATION_REQUIRED offers KYC', () => {
    expect(
      mapError(api(403, 'ACCOUNT_VERIFICATION_REQUIRED'), 'generic', t),
    ).toMatchObject({
      kind: 'verificationRequired',
      action: 'completeKyc',
      message: t('error.verificationRequired'),
    });
  });

  it('MAINTENANCE_MODE says until when, if the server did', () => {
    const withEnd = mapError(
      api(503, 'MAINTENANCE_MODE', 'paused', {
        endsAt: '2026-10-20T10:00:00.000Z',
      }),
      'generic',
      t,
    );
    expect(withEnd.kind).toBe('maintenance');
    expect(withEnd.message).toContain('until');

    expect(mapError(api(503, 'MAINTENANCE_MODE'), 'generic', t).message).toBe(
      t('error.maintenance'),
    );
  });

  it('FEATURE_NOT_AVAILABLE offers the plans', () => {
    expect(
      mapError(api(403, 'FEATURE_NOT_AVAILABLE'), 'generic', t),
    ).toMatchObject({
      kind: 'featureNotAvailable',
      action: 'viewPlans',
    });
  });

  it('UPLOAD_TOO_LARGE and a bare 413 read the same', () => {
    expect(mapError(api(413, 'UPLOAD_TOO_LARGE'), 'generic', t).message).toBe(
      t('error.uploadTooLarge'),
    );
    expect(mapError(api(413, 'REQUEST_FAILED'), 'generic', t).kind).toBe(
      'uploadTooLarge',
    );
  });

  it('ROLE_NOT_ALLOWED (a buyer or admin signing in) is "not a seller"', () => {
    expect(
      mapError(api(403, 'ROLE_NOT_ALLOWED'), 'passwordLogin', t),
    ).toMatchObject({
      kind: 'notSeller',
      message: t('error.notSeller'),
    });
  });
});

describe('by status', () => {
  it('network failures', () => {
    const error = new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' });
    expect(mapError(error, 'generic', t)).toMatchObject({
      kind: 'network',
      status: 0,
      message: t('error.network'),
    });
  });

  it('a 401 on password sign-in never says which part was wrong', () => {
    expect(
      mapError(api(401, 'UNAUTHORIZED', 'No such user'), 'passwordLogin', t),
    ).toMatchObject({
      kind: 'invalidCredentials',
      message: t('error.invalidCredentials'),
    });
  });

  it('a 423 is a lockout', () => {
    expect(mapError(api(423, 'LOCKED'), 'passwordLogin', t).kind).toBe(
      'locked',
    );
  });

  it('a 403 shows the server text, or the suspended text without one', () => {
    expect(
      mapError(api(403, 'FORBIDDEN', 'Account suspended'), 'generic', t),
    ).toMatchObject({
      kind: 'suspended',
      message: 'Account suspended',
    });
    expect(mapError(api(403, 'FORBIDDEN', ''), 'generic', t).message).toBe(
      t('error.suspended'),
    );
  });

  it('throttling: sign-in and the generic throttler text use the friendly wording', () => {
    expect(
      mapError(api(429, 'X', 'Custom wait text'), 'passwordLogin', t).message,
    ).toBe(t('error.tooManyAttempts'));
    expect(
      mapError(
        api(429, 'X', 'ThrottlerException: Too Many Requests'),
        'generic',
        t,
      ).message,
    ).toBe(t('error.tooManyAttempts'));
    expect(
      mapError(api(429, 'X', 'Wait 20 seconds'), 'generic', t).message,
    ).toBe('Wait 20 seconds');
  });

  it('validation prefers the per-field reasons and maps them to fields', () => {
    const mapped = mapError(
      api(422, 'VALIDATION_FAILED', 'Request validation failed', [
        'identifier should not be empty',
        'password must be longer',
      ]),
      'generic',
      t,
    );
    expect(mapped.kind).toBe('validation');
    expect(mapped.message).toBe(
      'identifier should not be empty password must be longer',
    );
    expect(mapped.fieldErrors).toEqual({
      identifier: 'identifier should not be empty',
      password: 'password must be longer',
    });
  });

  it('server errors hide technical detail', () => {
    expect(
      mapError(api(500, 'INTERNAL', 'stack trace here'), 'generic', t),
    ).toMatchObject({
      kind: 'server',
      message: t('error.server'),
    });
  });

  it('anything else shows exactly what the server wrote', () => {
    expect(
      mapError(api(418, 'TEAPOT', 'Already exists'), 'generic', t),
    ).toMatchObject({
      kind: 'unknown',
      message: 'Already exists',
    });
  });

  it('a thrown non-API error is a generic failure', () => {
    expect(mapError(new Error('boom'), 'generic', t)).toMatchObject({
      kind: 'unknown',
      message: t('error.generic'),
    });
  });

  it('the engine NotASellerError is "not a seller"', () => {
    const error = new Error('x');
    error.name = 'NotASellerError';
    expect(mapError(error, 'passwordLogin', t).kind).toBe('notSeller');
  });
});
