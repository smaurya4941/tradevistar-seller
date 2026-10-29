import {
  ApiError,
  type CommunicationPreferences,
  type NotificationPreferenceRow,
  type PreferenceChange,
  type SellerNotification,
} from '@tradevistar/seller-api';
import {
  applyCommunicationPatch,
  isStaleVersion,
  saveCommunication,
} from '../communicationSaver';
import { handleArrivals, type ArrivalDeps } from '../handleArrivals';
import { PreferenceSaver } from '../preferenceSaver';

const note = (over: Partial<SellerNotification> = {}): SellerNotification => ({
  id: 'n1',
  type: 'order.placed',
  title: 't',
  body: 'b',
  read: false,
  createdAt: '2026-10-22T10:00:00Z',
  metadata: { _push: true },
  ...over,
});

function deps(over: Partial<ArrivalDeps> = {}): ArrivalDeps & {
  banners: SellerNotification[];
  sounds: string[];
  alerts: SellerNotification[];
} {
  const state = {
    banners: [] as SellerNotification[],
    sounds: [] as string[],
    alerts: [] as SellerNotification[],
  };
  return Object.assign(state, {
    appActive: true,
    soundEnabled: true,
    soundPath: '/cache/v1.mp3',
    unreadTotal: 3,
    isOpenConversation: () => false,
    showBanner: (row: SellerNotification) => state.banners.push(row),
    playSound: (path: string) => state.sounds.push(path),
    showSystemAlert: (row: SellerNotification) => state.alerts.push(row),
    ...over,
  }) as never;
}

describe('handleArrivals', () => {
  it('foreground: one banner for the newest arrival and one sound, no system alert', () => {
    const d = deps();
    const outcome = handleArrivals(
      [
        note({ id: 'a', createdAt: '2026-10-22T10:00:00Z' }),
        note({ id: 'b', createdAt: '2026-10-22T10:05:00Z' }),
      ],
      d,
    );
    expect(outcome).toEqual({ banner: true, sound: true, systemAlerts: 0 });
    expect(d.banners.map(row => row.id)).toEqual(['b']);
    expect(d.sounds).toEqual(['/cache/v1.mp3']);
    expect(d.alerts).toEqual([]);
  });

  it('foreground: stays quiet when the sound is off or not downloaded yet', () => {
    const off = deps({ soundEnabled: false });
    expect(handleArrivals([note()], off).sound).toBe(false);
    const none = deps({ soundPath: null });
    expect(handleArrivals([note()], none).sound).toBe(false);
    expect(none.banners).toHaveLength(1);
  });

  it('background: a system alert for each push-flagged arrival only', () => {
    const d = deps({ appActive: false });
    const outcome = handleArrivals(
      [
        note({ id: 'a' }),
        note({ id: 'b', metadata: { _push: false } }),
        note({ id: 'c', metadata: null }),
        note({ id: 'd' }),
      ],
      d,
    );
    expect(outcome).toEqual({ banner: false, sound: false, systemAlerts: 2 });
    expect(d.alerts.map(row => row.id)).toEqual(['a', 'd']);
    expect(d.banners).toEqual([]);
    expect(d.sounds).toEqual([]);
  });

  it('is silent for a message in the conversation that is open', () => {
    const d = deps({ isOpenConversation: () => true });
    expect(handleArrivals([note()], d)).toEqual({
      banner: false,
      sound: false,
      systemAlerts: 0,
    });
    expect(d.banners).toEqual([]);
  });

  it('does nothing without arrivals', () => {
    const d = deps();
    expect(handleArrivals([], d)).toEqual({
      banner: false,
      sound: false,
      systemAlerts: 0,
    });
  });
});

/* ------------------------------------------------------------ preference saver */

const matrix = (): NotificationPreferenceRow[] => [
  {
    category: 'ORDERS',
    channels: [
      { channel: 'EMAIL', enabled: true, locked: false },
      { channel: 'SMS', enabled: false, locked: false },
      { channel: 'PUSH', enabled: true, locked: false },
      { channel: 'IN_APP', enabled: true, locked: false },
    ],
  },
  {
    category: 'SECURITY',
    channels: [
      { channel: 'EMAIL', enabled: true, locked: true },
      { channel: 'SMS', enabled: false, locked: false },
      { channel: 'PUSH', enabled: false, locked: false },
      { channel: 'IN_APP', enabled: true, locked: true },
    ],
  },
];

function saverHarness(
  save: (changes: PreferenceChange[]) => Promise<NotificationPreferenceRow[]>,
) {
  let rows: NotificationPreferenceRow[] = matrix();
  const errors: unknown[] = [];
  const pending: string[][] = [];
  const saver = new PreferenceSaver({
    get: () => rows,
    set: next => {
      rows = next;
    },
    save,
    onError: error => errors.push(error),
    onPending: keys => pending.push([...keys].sort()),
    delayMs: 10,
  });
  const state = (category: string, channel: string) =>
    rows
      .find(row => row.category === category)
      ?.channels.find(item => item.channel === channel)?.enabled;
  return { saver, errors, pending, state, rows: () => rows };
}

const applied = (changes: PreferenceChange[]): NotificationPreferenceRow[] =>
  matrix().map(row => ({
    ...row,
    channels: row.channels.map(item => {
      const change = changes.find(
        c => c.category === row.category && c.channel === item.channel,
      );
      return change ? { ...item, enabled: change.enabled } : item;
    }),
  }));

describe('PreferenceSaver', () => {
  it('shows a flip at once and sends one batched update', async () => {
    const save = jest.fn(async (changes: PreferenceChange[]) =>
      applied(changes),
    );
    const h = saverHarness(save);
    expect(h.saver.toggle('ORDERS', 'EMAIL', false)).toEqual({
      kind: 'queued',
    });
    expect(h.state('ORDERS', 'EMAIL')).toBe(false);
    h.saver.toggle('ORDERS', 'SMS', true);
    expect(save).not.toHaveBeenCalled();
    await h.saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual([
      { category: 'ORDERS', channel: 'EMAIL', enabled: false },
      { category: 'ORDERS', channel: 'SMS', enabled: true },
    ]);
    expect(h.state('ORDERS', 'SMS')).toBe(true);
    expect(h.errors).toEqual([]);
  });

  it('marks each switch pending while its save is in flight, then clears it', async () => {
    const h = saverHarness(async changes => applied(changes));
    h.saver.toggle('ORDERS', 'EMAIL', false);
    await h.saver.flush();
    expect(h.pending[0]).toEqual(['ORDERS.EMAIL']);
    expect(h.pending.at(-1)).toEqual([]);
  });

  it('rolls back and reports when the server refuses', async () => {
    const failure = new ApiError(500, { code: 'X', message: 'no' });
    const h = saverHarness(async () => {
      throw failure;
    });
    h.saver.toggle('ORDERS', 'EMAIL', false);
    expect(h.state('ORDERS', 'EMAIL')).toBe(false);
    await h.saver.flush();
    expect(h.state('ORDERS', 'EMAIL')).toBe(true);
    expect(h.errors).toEqual([failure]);
    expect(h.pending.at(-1)).toEqual([]);
  });

  it('turns Push off together with In-app', async () => {
    const save = jest.fn(async (changes: PreferenceChange[]) =>
      applied(changes),
    );
    const h = saverHarness(save);
    h.saver.toggle('ORDERS', 'IN_APP', false);
    expect(h.state('ORDERS', 'PUSH')).toBe(false);
    await h.saver.flush();
    expect(save.mock.calls[0][0]).toEqual([
      { category: 'ORDERS', channel: 'IN_APP', enabled: false },
      { category: 'ORDERS', channel: 'PUSH', enabled: false },
    ]);
  });

  it('refuses a locked switch and sends nothing for a switch that already has that value', async () => {
    const save = jest.fn(async (changes: PreferenceChange[]) =>
      applied(changes),
    );
    const h = saverHarness(save);
    expect(h.saver.toggle('SECURITY', 'EMAIL', false)).toEqual({
      kind: 'blocked',
      reason: 'locked',
    });
    h.saver.toggle('SECURITY', 'IN_APP', true);
    expect(h.saver.toggle('ORDERS', 'EMAIL', true)).toEqual({
      kind: 'unchanged',
    });
    await h.saver.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps flips made while a batch is in flight showing', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const save = jest.fn(async (changes: PreferenceChange[]) => {
      await gate;
      return applied(changes);
    });
    const h = saverHarness(save);
    h.saver.toggle('ORDERS', 'EMAIL', false);
    const first = h.saver.flush();
    h.saver.toggle('ORDERS', 'SMS', true);
    release();
    await first;
    expect(h.state('ORDERS', 'EMAIL')).toBe(false);
    expect(h.state('ORDERS', 'SMS')).toBe(true);
    await h.saver.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------ communication saver */

const comm = (version = 3): CommunicationPreferences => ({
  emailEnabled: true,
  phoneEnabled: false,
  whatsappEnabled: false,
  marketingOptIn: false,
  marketingOptInAt: null,
  promotionalOptIn: false,
  promotionalOptInAt: null,
  buyerInquiryAlerts: true,
  preferredLanguage: 'en',
  preferredContactMethod: 'EMAIL',
  timezone: 'Asia/Kolkata',
  version,
});

describe('saveCommunication', () => {
  it('sends the change on the version it holds', async () => {
    const update = jest.fn(async () => comm(4));
    const result = await saveCommunication(
      { version: 3 },
      { phoneEnabled: true },
      { get: jest.fn(), update },
    );
    expect(update).toHaveBeenCalledWith({ phoneEnabled: true, version: 3 });
    expect(result.version).toBe(4);
  });

  it('on a stale version, re-reads and retries once on the fresh version', async () => {
    const stale = new ApiError(409, {
      code: 'STALE_RESOURCE_VERSION',
      message: 'changed',
    });
    const update = jest
      .fn()
      .mockRejectedValueOnce(stale)
      .mockResolvedValueOnce(comm(8));
    const get = jest.fn(async () => comm(7));
    const result = await saveCommunication(
      { version: 3 },
      { phoneEnabled: true },
      { get, update },
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenNthCalledWith(2, {
      phoneEnabled: true,
      version: 7,
    });
    expect(result.version).toBe(8);
  });

  it('gives up after one retry', async () => {
    const stale = new ApiError(409, {
      code: 'STALE_RESOURCE_VERSION',
      message: 'changed',
    });
    const update = jest.fn().mockRejectedValue(stale);
    await expect(
      saveCommunication(
        { version: 3 },
        { phoneEnabled: true },
        { get: async () => comm(7), update },
      ),
    ).rejects.toBe(stale);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('does not retry any other failure', async () => {
    const boom = new ApiError(500, { code: 'X', message: 'down' });
    const get = jest.fn();
    await expect(
      saveCommunication(
        { version: 3 },
        { phoneEnabled: true },
        { get, update: jest.fn().mockRejectedValue(boom) },
      ),
    ).rejects.toBe(boom);
    expect(get).not.toHaveBeenCalled();
  });

  it('recognises a stale version and applies a patch without mutating', () => {
    expect(
      isStaleVersion(new ApiError(409, { code: 'ANY', message: '' })),
    ).toBe(true);
    expect(isStaleVersion(new ApiError(500, { code: 'X', message: '' }))).toBe(
      false,
    );
    expect(isStaleVersion(new Error('x'))).toBe(false);
    const before = comm();
    const after = applyCommunicationPatch(before, { whatsappEnabled: true });
    expect(after.whatsappEnabled).toBe(true);
    expect(before.whatsappEnabled).toBe(false);
  });
});
