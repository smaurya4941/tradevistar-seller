import type { SellerNotification } from '@tradevistar/seller-api';
import {
  alertChannel,
  alertData,
  alertIdFor,
  FALLBACK_HREF,
  tappedHref,
  tappedNotificationId,
} from '../alertPayload';
import { isForOpenConversation } from '../conversationAlert';
import {
  isUnsupportedStatus,
  shouldAttemptRegistration,
  UNSUPPORTED_RETRY_MS,
} from '../registrationRules';

const row = (over: Partial<SellerNotification> = {}): SellerNotification => ({
  id: 'n1',
  type: 'order.placed',
  title: 'New order',
  body: 'Acme ordered 10 units',
  read: false,
  createdAt: '2026-10-22T10:00:00Z',
  metadata: { orderId: 'o1', _push: true },
  ...over,
});

describe('alert payload', () => {
  it('carries strings only: id, type, category and where it leads', () => {
    const data = alertData(row());
    expect(data).toEqual({
      notificationId: 'n1',
      type: 'order.placed',
      category: 'orders',
      href: '/seller/dashboard/orders?order=o1',
    });
    expect(Object.values(data).every(value => typeof value === 'string')).toBe(
      true,
    );
  });

  it('never puts the title or body in the payload', () => {
    const text = JSON.stringify(alertData(row()));
    expect(text).not.toContain('New order');
    expect(text).not.toContain('Acme');
  });

  it('falls back to the notification centre when nothing is actionable', () => {
    expect(
      alertData(row({ type: 'promotion.started', metadata: null })).href,
    ).toBe(FALLBACK_HREF);
  });

  it('adds the conversation to a message alert', () => {
    const data = alertData(
      row({ type: 'message.received', metadata: { conversationId: 'c1' } }),
    );
    expect(data.conversationId).toBe('c1');
    expect(data.href).toBe('/seller/dashboard/messages?conversation=c1');
    expect(alertChannel(data)).toBe('messages');
  });

  it('uses one Notifee id per server row so a refreshed row replaces its alert', () => {
    expect(alertIdFor('n1')).toBe(alertIdFor('n1'));
    expect(alertIdFor('n1')).not.toBe(alertIdFor('n2'));
  });

  it('routes a tap through the stored href, and only a portal path', () => {
    expect(tappedHref({ href: '/seller/dashboard/wallet' })).toBe(
      '/seller/dashboard/wallet',
    );
    expect(tappedHref({ href: 'https://evil.example' })).toBe(FALLBACK_HREF);
    expect(tappedHref(undefined)).toBe(FALLBACK_HREF);
  });

  it('marks real notifications read on a tap, but not local test alerts', () => {
    expect(tappedNotificationId({ notificationId: 'n1' })).toBe('n1');
    expect(
      tappedNotificationId({ notificationId: 'local-123' }),
    ).toBeUndefined();
    expect(tappedNotificationId(undefined)).toBeUndefined();
  });

  it('silences a message for the conversation that is open', () => {
    const message = {
      type: 'message.received',
      metadata: { conversationId: 'c1' },
    };
    expect(isForOpenConversation(message, 'c1')).toBe(true);
    expect(isForOpenConversation(message, 'c2')).toBe(false);
    expect(isForOpenConversation(message, null)).toBe(false);
    expect(
      isForOpenConversation({ type: 'order.placed', metadata: null }, 'c1'),
    ).toBe(false);
  });
});

describe('push registration rules', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');

  it('registers when the API has never said it is unsupported', () => {
    expect(shouldAttemptRegistration(undefined, now)).toBe(true);
    expect(shouldAttemptRegistration(0, now)).toBe(true);
  });

  it('does not ask a missing endpoint again for a day', () => {
    expect(shouldAttemptRegistration(now - 60_000, now)).toBe(false);
    expect(shouldAttemptRegistration(now - UNSUPPORTED_RETRY_MS + 1, now)).toBe(
      false,
    );
    expect(shouldAttemptRegistration(now - UNSUPPORTED_RETRY_MS, now)).toBe(
      true,
    );
  });

  it('is not blocked for ever by a clock that moved backwards', () => {
    expect(
      shouldAttemptRegistration(now + 10 * UNSUPPORTED_RETRY_MS, now),
    ).toBe(true);
  });

  it('reads 404, 405 and 501 as "no such route"', () => {
    expect(isUnsupportedStatus(404)).toBe(true);
    expect(isUnsupportedStatus(405)).toBe(true);
    expect(isUnsupportedStatus(501)).toBe(true);
    expect(isUnsupportedStatus(500)).toBe(false);
    expect(isUnsupportedStatus(401)).toBe(false);
  });
});
