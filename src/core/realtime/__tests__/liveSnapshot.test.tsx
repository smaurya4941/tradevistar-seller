import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotificationSnapshot } from '@tradevistar/seller-api';
import React from 'react';
import { act, create } from 'react-test-renderer';

let mockSession: { status: string; user?: { id: string } } = {
  status: 'signedIn',
  user: { id: 'seller-1' },
};
jest.mock('@/core/auth/SessionProvider', () => ({
  useSession: () => mockSession,
}));

const mockSnapshot = jest.fn();
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  getNotificationSnapshot: (...args: unknown[]) => mockSnapshot(...args),
}));

import { queryKeys } from '@/core/query/queryClient';
import { useAnyBadge, useBadge, useLiveSnapshot } from '../liveSnapshot';

const snapshot = (
  over: Partial<NotificationSnapshot> = {},
): NotificationSnapshot => ({
  notifications: [],
  unreadNotifications: 4,
  unreadMessages: 0,
  unreadByArea: {
    orders: 2,
    cancellations: 0,
    returns: 0,
    refunds: 0,
    rfs: 0,
    samples: 0,
    messages: 0,
    payments: 0,
    wallet: 0,
    products: 0,
    support: 0,
    disputes: 0,
    approvals: 0,
    updates: 0,
  },
  conversationRevision: 'r1',
  soundVersion: -1,
  ...over,
});

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

const renders: Record<string, number> = {};

function Probe({
  name,
  children,
}: {
  name: string;
  children: (n: number) => React.ReactNode;
}) {
  renders[name] = (renders[name] ?? 0) + 1;
  return <>{children(renders[name])}</>;
}

function Orders() {
  const count = useBadge('orders');
  return <Probe name="orders">{() => `orders:${count}`}</Probe>;
}
function Wallet() {
  const count = useBadge('wallet');
  return <Probe name="wallet">{() => `wallet:${count}`}</Probe>;
}
function Dot() {
  const any = useAnyBadge(['payments', 'wallet', 'support']);
  return <Probe name="dot">{() => `dot:${any}`}</Probe>;
}
function Raw() {
  const data = useLiveSnapshot();
  return <Probe name="raw">{() => `raw:${data ? 'yes' : 'no'}`}</Probe>;
}

/** React Query notifies observers on a 0 ms timer; let it run inside act. */
const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 5));
  });

async function mount(client: QueryClient) {
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Orders />
        <Wallet />
        <Dot />
        <Raw />
      </QueryClientProvider>,
    );
  });
  await settle();
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(renders)) delete renders[key];
  mockSession = { status: 'signedIn', user: { id: 'seller-1' } };
});

describe('the live snapshot', () => {
  it('reads each badge from the one snapshot', async () => {
    mockSnapshot.mockResolvedValue(snapshot());
    const renderer = await mount(freshClient());
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('orders:2');
    expect(text).toContain('wallet:0');
    expect(text).toContain('dot:false');
    expect(text).toContain('raw:yes');
    expect(mockSnapshot).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the notifications family is invalidated (a socket event, a read)', async () => {
    const client = freshClient();
    mockSnapshot.mockResolvedValueOnce(snapshot());
    const renderer = await mount(client);
    mockSnapshot.mockResolvedValueOnce(
      snapshot({
        unreadByArea: { ...snapshot().unreadByArea, orders: 5, wallet: 1 },
      }),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.notifications });
    });
    await settle();
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('orders:5');
    expect(text).toContain('wallet:1');
    expect(text).toContain('dot:true');
  });

  it('re-renders only the badge whose number changed', async () => {
    const client = freshClient();
    mockSnapshot.mockResolvedValueOnce(snapshot());
    await mount(client);
    const walletBefore = renders.wallet;
    const ordersBefore = renders.orders;
    mockSnapshot.mockResolvedValueOnce(
      snapshot({ unreadByArea: { ...snapshot().unreadByArea, orders: 9 } }),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.notifications });
    });
    await settle();
    expect(renders.orders).toBeGreaterThan(ordersBefore);
    expect(renders.wallet).toBe(walletBefore);
  });

  it('shows nothing and asks for nothing while signed out', async () => {
    mockSession = { status: 'signedOut' };
    const renderer = await mount(freshClient());
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('orders:0');
    expect(text).toContain('raw:no');
    expect(mockSnapshot).not.toHaveBeenCalled();
  });

  it('drops every badge when the cache is cleared on sign-out', async () => {
    const client = freshClient();
    mockSnapshot.mockResolvedValue(snapshot());
    const renderer = await mount(client);
    expect(JSON.stringify(renderer.toJSON())).toContain('orders:2');
    mockSession = { status: 'signedOut' };
    await act(async () => {
      client.clear();
      renderer.update(
        <QueryClientProvider client={client}>
          <Orders />
          <Wallet />
          <Dot />
          <Raw />
        </QueryClientProvider>,
      );
    });
    await settle();
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('orders:0');
    expect(text).toContain('raw:no');
  });
});
