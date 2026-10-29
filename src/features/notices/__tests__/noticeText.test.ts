/**
 * The words on the notice banner: the time line for each kind of notice, durations in both
 * languages, and what a maintenance says is paused.
 */
import type { SiteNotice } from '@tradevistar/seller-api';
import { translate } from '@/i18n';
import {
  durationLabel,
  labelText,
  pausedText,
  timingLabel,
  whenLabel,
} from '../noticeText';

const en = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const MIN = 60_000;
const HOUR = 60 * MIN;

const notice = (extra: Partial<SiteNotice> = {}): SiteNotice => ({
  id: 'n1',
  kind: 'MAINTENANCE',
  state: 'LIVE',
  title: 'Scheduled maintenance',
  message: 'We are upgrading.',
  lockMode: 'PARTIAL',
  pausedFeatures: ['Checkout & payments', 'Sign up & sign in'],
  startsAt: '2026-10-09T10:00:00.000Z',
  endsAt: null,
  eventAt: null,
  ...extra,
});

describe('durationLabel', () => {
  it('reads like the web in English', () => {
    expect(durationLabel(en, 2 * 24 * HOUR + 4 * HOUR)).toBe('2d 4h');
    expect(durationLabel(en, 3 * HOUR + 20 * MIN)).toBe('3h 20m');
    expect(durationLabel(en, 12 * MIN)).toBe('12m');
    expect(durationLabel(en, 10_000)).toBe('under a minute');
  });
});

describe('whenLabel', () => {
  it('is always India time, so every seller reads the same moment', () => {
    expect(whenLabel('2026-10-09T10:00:00.000Z')).toBe(
      '9 Oct 2026, 3:30 pm IST',
    );
  });

  it('is empty for an unreadable date', () => {
    expect(whenLabel('later')).toBe('');
  });
});

describe('timingLabel', () => {
  it('has nothing to say without a timing', () => {
    expect(timingLabel(en, null)).toBeNull();
  });

  it('says when an upcoming maintenance starts', () => {
    expect(timingLabel(en, { type: 'startsIn', ms: 3 * HOUR })).toBe(
      'Starts in 3h 0m',
    );
  });

  it('says when a live maintenance should be over, or that it is in progress', () => {
    expect(
      timingLabel(en, { type: 'backBy', at: '2026-10-09T12:30:00.000Z' }),
    ).toBe('Back by 9 Oct 2026, 6:00 pm IST');
    expect(timingLabel(en, { type: 'inProgress' })).toBe('In progress');
  });

  it('gives an announcement its date and countdown', () => {
    expect(
      timingLabel(en, {
        type: 'eventIn',
        at: '2026-10-09T10:00:00.000Z',
        ms: 45 * MIN,
      }),
    ).toBe('9 Oct 2026, 3:30 pm IST · in 45m');
  });
});

describe('labelText', () => {
  it('names the three kinds', () => {
    expect(labelText(en, notice({ kind: 'ANNOUNCEMENT' }))).toBe(
      'Announcement',
    );
    expect(labelText(en, notice())).toBe('Maintenance');
    expect(labelText(en, notice({ state: 'UPCOMING' }))).toBe(
      'Upcoming maintenance',
    );
  });
});

describe('pausedText', () => {
  it('says all actions are paused for a full lock', () => {
    expect(pausedText(en, notice({ lockMode: 'FULL' }))).toBe(
      en('notice.pausedAll'),
    );
  });

  it('lists the paused parts for a partial lock', () => {
    expect(pausedText(en, notice())).toBe(
      'Paused during this window: Checkout & payments, Sign up & sign in. Everything else works as usual.',
    );
  });

  it('says nothing for a partial lock that names no parts, or an announcement', () => {
    expect(pausedText(en, notice({ pausedFeatures: [] }))).toBeNull();
    expect(
      pausedText(en, notice({ kind: 'ANNOUNCEMENT', lockMode: null })),
    ).toBeNull();
  });
});
