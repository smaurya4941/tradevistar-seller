import { ApiError } from '@tradevistar/seller-api';
import { translate } from '@/i18n';
import { mapError, writeFailureMessage } from '../errorMapper';

const t = (key: Parameters<typeof translate>[1]) => translate('en', key);

describe('Phase 2 error codes', () => {
  it('a locked notification channel says security and bank alerts stay on', () => {
    const mapped = mapError(
      new ApiError(403, { code: 'NOTIFICATION_LOCKED', message: 'Security and bank alerts cannot be switched off' }),
    );
    expect(mapped.kind).toBe('preferenceLocked');
    expect(mapped.message).toBe(t('prefs.error.locked'));
  });

  it('a stale record version asks the seller to reload', () => {
    const mapped = mapError(
      new ApiError(409, { code: 'STALE_RESOURCE_VERSION', message: 'This record changed since you loaded it' }),
    );
    expect(mapped.kind).toBe('staleVersion');
    expect(mapped.message).toBe(t('error.staleVersion'));
  });

  it('writing to a closed ticket says to raise a new one', () => {
    const mapped = mapError(
      new ApiError(409, { code: 'CONFLICT', message: 'This ticket is closed — please raise a new one' }),
    );
    expect(mapped.kind).toBe('ticketClosed');
    expect(mapped.message).toBe(t('error.ticketClosed'));
  });

  it('shows the server\'s own words for a throttled contact form', () => {
    const mapped = mapError(
      new ApiError(429, { code: 'THROTTLED', message: 'Too many messages. Try again in a minute.' }),
    );
    expect(mapped.message).toBe('Too many messages. Try again in a minute.');
  });

  it('a lost connection reads as a network problem, not a refusal', () => {
    expect(mapError(new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' })).kind).toBe('network');
  });
});

describe('writeFailureMessage', () => {
  it('uses the mapper\'s wording for an API failure', () => {
    expect(
      writeFailureMessage(new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' }), 'fallback'),
    ).toBe(t('error.network'));
  });

  it('uses the fallback for anything that is not an API error', () => {
    expect(writeFailureMessage(new Error('boom'), 'Could not send')).toBe('Could not send');
    expect(writeFailureMessage(undefined, 'Could not send')).toBe('Could not send');
  });
});
