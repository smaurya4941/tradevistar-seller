/**
 * The notice banner as a seller meets it: nothing while there is nothing to say, the right words
 * and controls for each kind of notice, the details sheet, dismissal for the session — and no way
 * to put away a live maintenance.
 */
import type { SiteNotice } from '@tradevistar/seller-api';
import React from 'react';
import { Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SiteNoticeBanner } from '../components/SiteNoticeBanner';
import { resetDismissedNotices } from '../dismissedNotices';
import { useNoticeBoard } from '../useNoticeBoard';

/** The app owns the board (GlobalBanners); the test does the same. */
function Banner() {
  const board = useNoticeBoard();
  return <SiteNoticeBanner board={board} />;
}

jest.setTimeout(30_000);

// The test renderer has no real app state; the banner only acts while the app is in the foreground.
jest.mock('@/core/useAppActive', () => ({ useAppActive: () => true }));

const mockFeed: { data: unknown } = { data: undefined };
const mockRefetch = jest.fn();
jest.mock('../data', () => ({
  useSiteNotices: () => ({ data: mockFeed.data, refetch: mockRefetch }),
}));

const HOUR = 3_600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const notice = (extra: Partial<SiteNotice> = {}): SiteNotice => ({
  id: 'n1',
  kind: 'ANNOUNCEMENT',
  state: 'LIVE',
  title: 'Diwali sale is coming',
  message: 'Prices drop at midnight.',
  lockMode: null,
  pausedFeatures: [],
  startsAt: iso(-HOUR),
  endsAt: null,
  eventAt: null,
  ...extra,
});

const maintenance = (extra: Partial<SiteNotice> = {}) =>
  notice({
    id: 'm1',
    kind: 'MAINTENANCE',
    title: 'Payments upgrade',
    message: 'We are improving payments.',
    lockMode: 'PARTIAL',
    pausedFeatures: ['Checkout & payments'],
    endsAt: iso(2 * HOUR),
    ...extra,
  });

const feed = (...notices: SiteNotice[]) => {
  mockFeed.data = { serverTime: iso(0), skew: 0, notices };
};

let renderer: ReactTestRenderer | null = null;

async function show(): Promise<ReactTestRenderer> {
  await act(async () => {
    renderer = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 360, height: 640 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <Banner />
      </SafeAreaProvider>,
    );
  });
  return renderer!;
}

const said = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(RNText)
    .map(node => React.Children.toArray(node.props.children).join(''));

const byId = (r: ReactTestRenderer, testID: string) =>
  r.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props.onPress === 'function',
  )[0];

const present = (r: ReactTestRenderer, testID: string) =>
  r.root.findAll(node => node.props.testID === testID).length > 0;

beforeEach(() => {
  mockFeed.data = undefined;
  resetDismissedNotices();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('SiteNoticeBanner', () => {
  it('renders nothing while the list has not loaded', async () => {
    const r = await show();
    expect(present(r, 'site-notice-banner')).toBe(false);
  });

  it('renders nothing when there are no notices', async () => {
    feed();
    const r = await show();
    expect(present(r, 'site-notice-banner')).toBe(false);
  });

  it('shows an announcement with its title and a way to dismiss it', async () => {
    feed(notice());
    const r = await show();
    expect(said(r)).toContain('Diwali sale is coming');
    expect(present(r, 'site-notice-dismiss')).toBe(true);
  });

  it('puts a dismissed announcement away for the session', async () => {
    feed(notice());
    const r = await show();
    await act(async () => {
      byId(r, 'site-notice-dismiss')!.props.onPress();
    });
    expect(present(r, 'site-notice-banner')).toBe(false);
  });

  it('says when a live maintenance should be over, and cannot be dismissed', async () => {
    feed(maintenance());
    const r = await show();
    expect(said(r)).toContain('Payments upgrade');
    expect(said(r).some(line => line.startsWith('Back by '))).toBe(true);
    expect(present(r, 'site-notice-dismiss')).toBe(false);
  });

  it('counts down to an upcoming maintenance', async () => {
    feed(
      maintenance({
        state: 'UPCOMING',
        startsAt: iso(3 * HOUR + 60_000),
        endsAt: iso(5 * HOUR),
      }),
    );
    const r = await show();
    expect(said(r).some(line => /^Starts in 3h \d+m$/.test(line))).toBe(true);
    expect(present(r, 'site-notice-dismiss')).toBe(true);
  });

  it('treats a maintenance whose start has passed as live', async () => {
    feed(
      maintenance({
        state: 'UPCOMING',
        startsAt: iso(-60_000),
        endsAt: iso(HOUR),
      }),
    );
    const r = await show();
    expect(present(r, 'site-notice-dismiss')).toBe(false);
  });

  it('hides a notice whose end has already passed', async () => {
    feed(maintenance({ endsAt: iso(-60_000) }));
    const r = await show();
    expect(present(r, 'site-notice-banner')).toBe(false);
  });

  it('shows where it sits when several notices rotate', async () => {
    feed(maintenance(), notice());
    const r = await show();
    expect(said(r)).toContain('1/2');
    // Maintenance is listed first and is the one on screen.
    expect(said(r)).toContain('Payments upgrade');
  });

  it('rotates to the next notice every few seconds, and stops while the details are open', async () => {
    jest.useFakeTimers();
    try {
      feed(maintenance(), notice());
      const r = await show();
      expect(said(r)).toContain('Payments upgrade');
      await act(async () => {
        jest.advanceTimersByTime(7_100);
      });
      expect(said(r)).toContain('Diwali sale is coming');
      expect(said(r)).toContain('2/2');

      await act(async () => {
        byId(r, 'site-notice-open')!.props.onPress();
      });
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      // Still on the second notice: nothing moved under the seller's thumb.
      expect(said(r)).toContain('2/2');
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-reads the list when a scheduled start comes due', async () => {
    jest.useFakeTimers();
    try {
      mockRefetch.mockClear();
      feed(
        maintenance({
          state: 'UPCOMING',
          startsAt: iso(20_000),
          endsAt: iso(HOUR),
        }),
      );
      await show();
      expect(mockRefetch).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(22_000);
      });
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the details with the message, the window and what is paused', async () => {
    feed(maintenance());
    const r = await show();
    await act(async () => {
      byId(r, 'site-notice-open')!.props.onPress();
    });
    const lines = said(r);
    expect(lines).toContain('We are improving payments.');
    expect(lines).toContain('Starts');
    expect(lines).toContain('Ends');
    expect(
      lines.some(line =>
        line.includes('Paused during this window: Checkout & payments'),
      ),
    ).toBe(true);
  });

  it('describes a full lock in plain words', async () => {
    feed(maintenance({ lockMode: 'FULL', pausedFeatures: [] }));
    const r = await show();
    await act(async () => {
      byId(r, 'site-notice-open')!.props.onPress();
    });
    expect(
      said(r).some(line =>
        line.includes('actions such as saving and sending are paused'),
      ),
    ).toBe(true);
  });

  it('gives an announcement its date instead of a window', async () => {
    feed(notice({ eventAt: iso(4 * HOUR) }));
    const r = await show();
    await act(async () => {
      byId(r, 'site-notice-open')!.props.onPress();
    });
    expect(said(r)).toContain('Date');
    expect(said(r)).not.toContain('Starts');
  });
});
