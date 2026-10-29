/**
 * Analytics and crash reporting: events become valid GA4 events, no personal data reaches either
 * service, screen views and the signed-in id are sent, and a crashing screen shows the fallback
 * and is reported.
 */
import * as Analytics from '@react-native-firebase/analytics';
import * as Sentry from '@sentry/react-native';
import React from 'react';
import { act, create } from 'react-test-renderer';

const mockEnv = {
  sentryDsn: 'https://key@sentry.io/1',
  analyticsEnabled: true,
  appEnv: 'production',
};
jest.mock('@/config/env', () => ({
  env: {
    get sentryDsn() {
      return mockEnv.sentryDsn;
    },
    get analyticsEnabled() {
      return mockEnv.analyticsEnabled;
    },
    get appEnv() {
      return mockEnv.appEnv;
    },
  },
}));
let mockConfigured = true;
jest.mock('@/core/observability/firebase', () => ({
  isFirebaseConfigured: () => mockConfigured,
}));

import {
  identifyUser,
  scrub,
  setAnalyticsSinks,
  track,
  trackScreen,
  type AnalyticsSink,
} from '@/core/analytics/analytics';
import { logger, setLoggerHook } from '@/core/logger';
import { AppErrorBoundary } from '@/app/components/AppErrorBoundary';
import { gaEventName, gaParams } from '../gaEvents';
import { createFirebaseSink } from '../firebaseSink';
import { initObservability, setObservedUser } from '../index';
import {
  isSensitiveKey,
  redactText,
  REDACTED,
  scrubBreadcrumb,
  scrubReport,
  stripQuery,
} from '../scrub';

describe('GA4 event names', () => {
  it('keeps ordinary names as they are', () => {
    expect(gaEventName('add_to_cart')).toBe('add_to_cart');
    expect(gaEventName('app_open')).toBe('app_open');
  });

  it('prefixes the names Google reserves', () => {
    expect(gaEventName('notification_open')).toBe('tv_notification_open');
    expect(gaEventName('screen_view')).toBe('tv_screen_view');
    expect(gaEventName('error')).toBe('tv_error');
    expect(gaEventName('firebase_thing')).toBe('tv_firebase_thing');
  });

  it('fixes invalid characters and a leading digit, and caps the length', () => {
    expect(gaEventName('quote award!')).toBe('quote_award_');
    expect(gaEventName('3d_view')).toBe('tv_3d_view');
    expect(gaEventName('x'.repeat(60))).toHaveLength(40);
  });
});

describe('GA4 parameters', () => {
  it('sends numbers as numbers, text as text and booleans as words', () => {
    expect(
      gaParams({ count: 3, sort: 'price', cold: true, warm: false }),
    ).toEqual({
      count: 3,
      sort: 'price',
      cold: 'true',
      warm: 'false',
    });
  });

  it('drops undefined and non-finite values, truncates long text, caps the count', () => {
    const params = gaParams({
      gone: undefined,
      bad: Number.NaN,
      long: 'a'.repeat(300),
    });
    expect(params).toEqual({ long: 'a'.repeat(100) });
    const many = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`p${i}`, i]),
    );
    expect(Object.keys(gaParams(many))).toHaveLength(25);
  });

  it('renames a reserved parameter prefix', () => {
    expect(Object.keys(gaParams({ google_x: 1 }))).toEqual(['tv_google_x']);
  });
});

describe('what may leave the phone', () => {
  it('redacts emails, phone numbers and GSTINs inside text', () => {
    const text =
      'Asha asha@example.com called 98765 43210 about 27AAPFU0939F1ZV';
    const clean = redactText(text);
    expect(clean).not.toContain('asha@example.com');
    expect(clean).not.toContain('98765');
    expect(clean).not.toContain('27AAPFU0939F1ZV');
    expect(clean).toContain(REDACTED);
  });

  it('cuts a URL down to its path', () => {
    expect(stripQuery('https://api.x.com/v1/search?q=asha%40x.com#top')).toBe(
      'https://api.x.com/v1/search',
    );
  });

  it('strips a crash report to an id, a bare URL and redacted text', () => {
    const report = scrubReport({
      message: 'failed for asha@example.com',
      user: { id: 'u1', email: 'asha@example.com', ip_address: '1.2.3.4' },
      request: {
        url: 'https://api.x.com/v1/me?token=abc',
        headers: { Authorization: 'Bearer abc' },
        cookies: 'tv_refresh_seller=abc',
      },
      exception: { values: [{ value: 'bad gstin 27AAPFU0939F1ZV' }] },
      extra: {
        phone: '9876543210',
        note: 'ok',
        nested: { token: 'abc', email: 'a@b.co' },
      },
      breadcrumbs: [
        {
          category: 'xhr',
          message: 'GET a@b.co',
          data: { url: 'https://x.y/z?q=1', status_code: 200 },
        },
      ],
    });
    expect(report.user).toEqual({ id: 'u1' });
    expect(report.request).toEqual({ url: 'https://api.x.com/v1/me' });
    expect(report.message).not.toContain('asha@example.com');
    expect(report.exception?.values?.[0]?.value).not.toContain(
      '27AAPFU0939F1ZV',
    );
    expect(report.extra).toEqual({
      phone: REDACTED,
      note: 'ok',
      nested: { token: REDACTED, email: REDACTED },
    });
    expect(report.breadcrumbs?.[0]).toEqual({
      category: 'xhr',
      message: `GET ${REDACTED}`,
      data: { url: 'https://x.y/z', status_code: 200 },
    });
  });

  it('drops a user with no id', () => {
    expect(scrubReport({ user: { email: 'a@b.co' } }).user).toBeUndefined();
  });

  it('redacts a breadcrumb on its own', () => {
    expect(
      scrubBreadcrumb({ message: 'a@b.co', data: { token: 'x' } }),
    ).toEqual({
      message: REDACTED,
      data: { token: REDACTED },
    });
  });

  it('keeps the event scrub for analytics properties', () => {
    expect(
      scrub({ product_id: 'p1', email: 'a@b.co', note: 'call 9876543210' }),
    ).toEqual({
      product_id: 'p1',
    });
  });
});

describe('the Firebase sink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigured = true;
  });

  it('logs events with GA4 names and parameters', () => {
    createFirebaseSink().track('notification_open', { id: 'n1', cold: true });
    expect(Analytics.logEvent).toHaveBeenCalledWith(
      {},
      'tv_notification_open',
      {
        id: 'n1',
        cold: 'true',
      },
    );
  });

  it('logs screen views and the signed-in id', () => {
    const sink = createFirebaseSink();
    sink.screen?.('Checkout');
    sink.identify?.('u1');
    sink.identify?.(null);
    expect(Analytics.logScreenView).toHaveBeenCalledWith(
      {},
      { screen_name: 'Checkout', screen_class: 'Checkout' },
    );
    expect(Analytics.setUserId).toHaveBeenNthCalledWith(1, {}, 'u1');
    expect(Analytics.setUserId).toHaveBeenNthCalledWith(2, {}, null);
  });

  it('does nothing when Firebase is not configured for the build', () => {
    mockConfigured = false;
    createFirebaseSink().track('app_open', { cold: true });
    expect(Analytics.logEvent).not.toHaveBeenCalled();
  });

  it('survives Firebase throwing or rejecting', () => {
    (Analytics.logEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native');
    });
    (Analytics.logScreenView as jest.Mock).mockRejectedValueOnce(
      new Error('later'),
    );
    const sink = createFirebaseSink();
    expect(() => sink.track('app_open', { cold: true })).not.toThrow();
    expect(() => sink.screen?.('Home')).not.toThrow();
  });
});

describe('analytics fan-out', () => {
  afterEach(() => setAnalyticsSinks([]));

  it('sends events scrubbed, screens and identity to every sink, even if one fails', () => {
    const good: AnalyticsSink & { calls: unknown[][] } = {
      calls: [],
      track(name, props) {
        this.calls.push(['track', name, props]);
      },
      screen(name) {
        this.calls.push(['screen', name]);
      },
      identify(id) {
        this.calls.push(['identify', id]);
      },
    };
    const broken: AnalyticsSink = {
      track() {
        throw new Error('down');
      },
      screen() {
        throw new Error('down');
      },
    };
    setAnalyticsSinks([broken, good]);
    track('app_open', { launch_ms: 5, cold: true });
    trackScreen('Home');
    identifyUser('u1');
    expect(good.calls).toEqual([
      ['track', 'app_open', { launch_ms: 5, cold: true }],
      ['screen', 'Home'],
      ['identify', 'u1'],
    ]);
  });
});

describe('initObservability', () => {
  it('starts crash reporting and analytics, ties the user, and reports logged errors', () => {
    jest.clearAllMocks();
    initObservability();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.io/1',
        environment: 'production',
        sendDefaultPii: false,
        tracesSampleRate: 0,
      }),
    );
    expect(Analytics.setAnalyticsCollectionEnabled).toHaveBeenCalledWith(
      {},
      true,
    );

    setObservedUser('u1');
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(Analytics.setUserId).toHaveBeenCalledWith({}, 'u1');
    setObservedUser(null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    logger.error('session refresh failed', new Error('boom'));
    expect(Sentry.captureException).toHaveBeenCalled();
    setLoggerHook(null);
  });

  it('scrubs reports before they are sent', () => {
    const { beforeSend } = (Sentry.init as jest.Mock).mock.calls[0][0] as {
      beforeSend: (event: unknown) => { user?: unknown };
    };
    expect(beforeSend({ user: { id: 'u1', email: 'a@b.co' } }).user).toEqual({
      id: 'u1',
    });
  });
});

describe('AppErrorBoundary', () => {
  function Boom(): React.ReactElement {
    throw new Error('render failed');
  }

  it('shows the fallback, reports the crash, and recovers on Try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (Sentry.captureException as jest.Mock).mockClear();
    let broken = true;
    function Maybe() {
      return broken ? <Boom /> : <></>;
    }
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <AppErrorBoundary>
          <Maybe />
        </AppErrorBoundary>,
      );
    });
    expect(
      renderer.root.findAll(node => node.props.testID === 'app-error').length,
    ).toBeGreaterThan(0);
    expect(Sentry.captureException).toHaveBeenCalled();
    broken = false;
    const retry = renderer.root.find(
      node => node.props.testID === 'app-error-retry' && node.props.onPress,
    );
    await act(async () => retry.props.onPress());
    expect(
      renderer.root.findAll(node => node.props.testID === 'app-error'),
    ).toHaveLength(0);
  });
});

describe('sensitive property names', () => {
  it.each([
    'token',
    'authToken',
    'otp_code',
    'Authorization',
    'phone',
    'userEmail',
    'code',
    'gstin',
  ])('treats %s as private', key => expect(isSensitiveKey(key)).toBe(true));

  it.each([
    'status_code',
    'statusCode',
    'company',
    'expand',
    'url',
    'method',
    'product_id',
  ])('treats %s as harmless', key => expect(isSensitiveKey(key)).toBe(false));
});
