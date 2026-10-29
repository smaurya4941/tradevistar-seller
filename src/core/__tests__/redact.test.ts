import { logger } from '../logger';
import { isSensitiveKey, redactText, REDACTED } from '../redact';
import { scrubBreadcrumb, scrubReport } from '../observability/scrub';

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsInNpZCI6InMxIn0.c2lnbmF0dXJlLXZhbHVl';

describe('redactText', () => {
  it('removes access tokens in any wording', () => {
    expect(redactText(`Authorization: Bearer ${JWT}`)).not.toContain('eyJ');
    expect(redactText(`token was ${JWT} here`)).toBe(
      `token was ${REDACTED} here`,
    );
    expect(redactText('Bearer abc.def-ghi')).toBe(REDACTED);
  });

  it('removes the refresh cookie', () => {
    const text =
      'set-cookie: tv_refresh_seller=9f8a7b6c5d4e; Path=/api/v1/auth; HttpOnly';
    const clean = redactText(text);
    expect(clean).not.toContain('9f8a7b6c5d4e');
    expect(clean).toContain('Path=/api/v1/auth');
  });

  it('removes GSTIN and PAN values', () => {
    const clean = redactText('GSTIN 27AAPFU0939F1ZV, PAN AAPFU0939F');
    expect(clean).toBe(`GSTIN ${REDACTED}, PAN ${REDACTED}`);
  });

  it('removes bank account numbers, plain or grouped', () => {
    expect(redactText('a/c 123456789012')).toBe(`a/c ${REDACTED}`);
    expect(redactText('a/c 1234-5678-9012-3456')).toBe(`a/c ${REDACTED}`);
    expect(redactText('a/c 000123456789')).toBe(`a/c ${REDACTED}`);
  });

  it('removes emails and phone numbers', () => {
    const clean = redactText('mail ravi@shop.in call +91 98765 43210');
    expect(clean).not.toContain('ravi@shop.in');
    expect(clean).not.toContain('98765');
  });

  it('leaves ordinary text and short numbers alone', () => {
    expect(redactText('Order 1234 shipped to 3 buyers in 2 days')).toBe(
      'Order 1234 shipped to 3 buyers in 2 days',
    );
  });
});

describe('isSensitiveKey', () => {
  it.each([
    'password',
    'newPassword',
    'refreshToken',
    'access_token',
    'otp',
    'code',
    'panNumber',
    'gstin',
    'accountNumber',
    'ifsc',
    'cookie',
    'Authorization',
  ])('%s is private', key => expect(isSensitiveKey(key)).toBe(true));

  it.each(['status', 'statusCode', 'orderId', 'method', 'count', 'company'])(
    '%s is harmless',
    key => expect(isSensitiveKey(key)).toBe(false),
  );
});

describe('reports and breadcrumbs', () => {
  it('removes tokens from a breadcrumb and a report', () => {
    const crumb = scrubBreadcrumb({
      category: 'xhr',
      message: `GET /orders Bearer ${JWT}`,
      data: { url: 'https://api/x?token=1', refreshToken: 'abc' },
    });
    expect(crumb.message).toBe(`GET /orders ${REDACTED}`);
    expect(crumb.data).toEqual({
      url: 'https://api/x',
      refreshToken: REDACTED,
    });

    const report = scrubReport({
      extra: {
        password: 'hunter2',
        note: `retry with ${JWT}`,
        gstin: '27AAPFU0939F1ZV',
      },
      request: {
        url: 'https://api/auth/login?x=1',
        cookies: 'tv_refresh_seller=abc',
      },
    });
    expect(report.extra).toEqual({
      password: REDACTED,
      note: `retry with ${REDACTED}`,
      gstin: REDACTED,
    });
    expect(report.request).toEqual({ url: 'https://api/auth/login' });
  });
});

describe('logger', () => {
  it('prints redacted detail', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    logger.warn('refresh failed', new Error(`bad token ${JWT}`));
    logger.warn('cookie', 'tv_refresh_seller=secretvalue');

    expect(warn).toHaveBeenNthCalledWith(
      1,
      'refresh failed',
      `bad token ${REDACTED}`,
    );
    expect(warn).toHaveBeenNthCalledWith(2, 'cookie', REDACTED);
    warn.mockRestore();
  });

  it('still passes the original error to the crash reporter hook', () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const hook = jest.fn();
    const { setLoggerHook } = jest.requireActual(
      '../logger',
    ) as typeof import('../logger');
    setLoggerHook(hook);
    const failure = new Error('x');

    logger.error('boom', failure);

    expect(hook).toHaveBeenCalledWith('boom', failure);
    setLoggerHook(null);
    error.mockRestore();
  });
});

describe('Phase 3 sensitive data', () => {
  it('redacts every profile field that must never leave the phone', () => {
    for (const key of [
      'accountNumber',
      'confirmAccountNumber',
      'ifsc',
      'gstin',
      'pan',
      'aadhaar',
      'documentNumber',
      'exemptionCertNumber',
      'lutNumber',
      'taxIdentificationNumber',
      'emailCode',
      'mobileCode',
      'code',
      'signedUrl',
      'fileUrl',
      'verificationToken',
      'invitationToken',
      'token',
      'currentPassword',
      'newPassword',
      'password',
    ]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });

  it('keeps harmless names such as document types readable', () => {
    for (const key of [
      'documentType',
      'document_type',
      'pages',
      'size_bucket',
      'signed_in',
      'type',
      'source',
    ]) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });

  it('removes a signed file link and an invitation link from free text', () => {
    const signed =
      'https://storage.example.com/private/doc.pdf?token=abc123&expires=99';
    expect(redactText(`opening ${signed} now`)).toBe(`opening ${REDACTED} now`);
    const invite =
      'https://seller.tradevistar.com/seller/invitations/accept?token=INVITE-TOKEN-1';
    expect(redactText(`link ${invite}`)).not.toContain('INVITE-TOKEN-1');
  });

  it('removes an Aadhaar number and an OTP-style 12 digit run', () => {
    expect(redactText('aadhaar 2345 6789 0123')).not.toContain('6789');
  });

  it('scrubs a report that carries document and bank details', () => {
    const report = scrubReport({
      extra: {
        documentNumber: 'LIC-9981',
        accountNumber: '123456789012',
        documentType: 'PAN_CARD',
        note: 'a/c 123456789012',
      },
    });
    expect(report.extra).toEqual({
      documentNumber: REDACTED,
      accountNumber: REDACTED,
      documentType: 'PAN_CARD',
      note: `a/c ${REDACTED}`,
    });
  });
});
