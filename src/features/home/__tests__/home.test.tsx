import type { UseQueryResult } from '@tanstack/react-query';
import type {
  InquirySummary,
  OrderStatusCounts,
  Page,
  RecentOrder,
  SellerDashboard,
  ShipmentSummary,
  WalletSummary,
} from '@tradevistar/seller-api';
import React from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { translate } from '@/i18n';

jest.mock('react-native-safe-area-context', () => {
  const { View: HostView } = require('react-native');
  return {
    SafeAreaView: HostView,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockOpenRoute = jest.fn();
jest.mock('@/app/navigation/openHref', () => ({
  openRoute: (...args: unknown[]) => mockOpenRoute(...args),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ isReady: () => false }),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { AnalyticsSummary } from '../components/AnalyticsSummary';
import {
  InquiryCenterCard,
  RecentOrdersCard,
  ShipmentsCard,
} from '../components/ActivityCards';
import { HomeCard } from '../components/HomeCard';
import { KpiGrid, kpiList } from '../components/KpiGrid';
import { StatusStrip } from '../components/StatusStrip';
import { WalletCard } from '../components/WalletCard';
import { usePrimarySettled, useRefreshOnFocus } from '../useHomeData';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

function query<T>(over: Partial<UseQueryResult<T>> = {}): UseQueryResult<T> {
  return {
    data: undefined,
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: jest.fn(),
    ...over,
  } as unknown as UseQueryResult<T>;
}

function collect(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(child => collect(child, out));
  else collect((node as { children?: unknown }).children, out);
}
const words = (renderer: ReactTestRenderer) => {
  const out: string[] = [];
  collect(renderer.toJSON(), out);
  return out.join(' ');
};
const has = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;
const press = (renderer: ReactTestRenderer, id: string) =>
  act(() => {
    renderer.root
      .find(
        node =>
          node.props.testID === id && typeof node.props.onPress === 'function',
      )
      .props.onPress();
  });

function mount(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

beforeEach(() => jest.clearAllMocks());

/* ------------------------------------------------------------------ fixtures */

const counts: OrderStatusCounts = {
  PENDING: 3,
  READY_TO_SHIP: 1,
  PROCESSING: 0,
  SHIPPED: 2,
  DELIVERED: 10,
  CANCELLED: 1,
  RETURNED: 0,
  FAILED_TO_DELIVER: 0,
  total: 17,
};

const wallet = (over: Partial<WalletSummary> = {}): WalletSummary => ({
  withdrawableBalance: 125_000,
  walletBalance: 150_000,
  pendingWithdraw: 10_000,
  totalCommission: 4_500,
  commissionEnabled: true,
  alreadyWithdrawn: 80_000,
  escrowHeld: 35_000,
  ...over,
});

const dashboard = (over: Partial<SellerDashboard> = {}): SellerDashboard => ({
  approvalStatus: 'APPROVED',
  kpis: {
    totalProducts: 42,
    verifiedBuyers: 17,
    newRfqs: 3,
    pendingQuotations: 2,
    orders: 90,
    revenue: 420_000,
    countriesServed: 4,
    profileCompletion: 80,
  },
  revenueByMonth: [
    { month: '2026-08', amount: 100_000 },
    { month: '2026-09', amount: 320_000 },
  ],
  ordersByMonth: [
    { month: '2026-08', count: 4 },
    { month: '2026-09', count: 9 },
  ],
  topProducts: [
    { name: 'Steel pipe', orders: 9, quantity: 90, revenue: 90_000 },
  ],
  aiInsights: null,
  insightsLocked: false,
  commissionPercent: 2,
  ...over,
});

const page = <T,>(items: T[]): Page<T> => ({
  items,
  meta: { page: 1, limit: items.length, total: items.length, totalPages: 1 },
});

/* ------------------------------------------------------------------ tests */

describe('the order status strip', () => {
  it('shows all eight states with their counts, in order', () => {
    const renderer = mount(<StatusStrip query={query({ data: counts })} />);
    const out = words(renderer);
    for (const label of [
      'Pending',
      'Ready to Ship',
      'Packaging',
      'Out for Delivery',
      'Delivered',
      'Canceled',
      'Returned',
      'Failed to Deliver',
    ]) {
      expect(out).toContain(label);
    }
    expect(out.indexOf('Pending')).toBeLessThan(out.indexOf('Delivered'));
    expect(
      renderer.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('status-chip-') &&
          node.props.onPress,
      ),
    ).toHaveLength(8);
  });

  it('opens the Orders tab with that state as the filter', () => {
    const renderer = mount(<StatusStrip query={query({ data: counts })} />);
    press(renderer, 'status-chip-SHIPPED');
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Main',
      params: { screen: 'Orders', query: { status: 'SHIPPED' } },
    });
  });

  it('speaks each chip as "label: n orders"', () => {
    const renderer = mount(<StatusStrip query={query({ data: counts })} />);
    const chip = renderer.root.find(
      node =>
        node.props.testID === 'status-chip-PENDING' &&
        node.props.accessibilityLabel,
    );
    expect(chip.props.accessibilityLabel).toBe('Pending: 3 orders');
  });

  it('shows a skeleton, then an error with a retry', () => {
    expect(
      has(mount(<StatusStrip query={query()} />), 'status-strip-skeleton'),
    ).toBe(true);
    const refetch = jest.fn();
    const failed = mount(
      <StatusStrip query={query({ isError: true, refetch })} />,
    );
    expect(has(failed, 'card-error')).toBe(true);
    act(() => {
      failed.root
        .find(
          node =>
            node.props.label === t('common.tryAgain') && node.props.onPress,
        )
        .props.onPress();
    });
    expect(refetch).toHaveBeenCalled();
  });
});

describe('the wallet card', () => {
  it('shows the withdrawable balance large and the tiles, with commission when it is on', () => {
    const renderer = mount(<WalletCard query={query({ data: wallet() })} />);
    const out = words(renderer);
    expect(out).toContain('₹1,25,000');
    expect(out).toContain(t('home.wallet.pendingWithdraw'));
    expect(out).toContain(t('home.wallet.commission'));
    expect(out).toContain(t('home.wallet.withdrawn'));
    expect(out).toContain(t('home.wallet.escrow'));
    expect(out).toContain(t('home.wallet.balance'));
  });

  it('hides commission while the admin has it off', () => {
    const renderer = mount(
      <WalletCard
        query={query({ data: wallet({ commissionEnabled: false }) })}
      />,
    );
    expect(words(renderer)).not.toContain(t('home.wallet.commission'));
  });

  it('has no Withdraw button yet, and "View wallet" opens the wallet section', () => {
    const renderer = mount(<WalletCard query={query({ data: wallet() })} />);
    expect(words(renderer).toLowerCase()).not.toContain('withdraw now');
    expect(
      renderer.root.findAll(
        node =>
          node.props.label === 'Withdraw' ||
          node.props.label === 'Withdraw money',
      ),
    ).toHaveLength(0);
    press(renderer, 'wallet-view');
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Section',
      params: { sectionId: 'wallet' },
    });
  });
});

describe('the key figures', () => {
  it('shows exactly eight tiles with plain captions and no trend arrows', () => {
    const list = kpiList(dashboard().kpis);
    expect(list).toHaveLength(8);
    expect(list.map(kpi => kpi.key)).toEqual([
      'products',
      'buyers',
      'rfqs',
      'quotes',
      'orders',
      'revenue',
      'countries',
      'profile',
    ]);
    const renderer = mount(<KpiGrid query={query({ data: dashboard() })} />);
    const out = words(renderer);
    expect(out).toContain('₹4.2L');
    expect(out).toContain('80%');
    expect(out).toContain(t('home.kpi.rfqs.caption'));
    for (const glyph of [
      'trending_up',
      'trending_down',
      'arrow_upward',
      'arrow_downward',
    ]) {
      expect(JSON.stringify(renderer.toJSON())).not.toContain(glyph);
    }
  });

  it('shows an error card when the dashboard fails, never an empty grid', () => {
    const renderer = mount(<KpiGrid query={query({ isError: true })} />);
    expect(has(renderer, 'card-error')).toBe(true);
    expect(has(renderer, 'kpi-grid')).toBe(false);
  });
});

describe('analytics on Home', () => {
  it('shows charts when the plan includes insights', () => {
    const renderer = mount(
      <AnalyticsSummary
        dashboard={query({ data: dashboard() })}
        statusCounts={query({ data: counts })}
      />,
    );
    expect(has(renderer, 'analytics-section')).toBe(true);
    expect(has(renderer, 'analytics-locked-card')).toBe(false);
    expect(words(renderer)).toContain(t('home.analytics.seeAll'));
  });

  it('hides the section on a plan without insights and points to the plans instead', () => {
    const renderer = mount(
      <AnalyticsSummary
        dashboard={query({
          data: dashboard({ insightsLocked: true, topProducts: [] }),
        })}
        statusCounts={query({ data: counts })}
      />,
    );
    expect(has(renderer, 'analytics-section')).toBe(false);
    expect(has(renderer, 'analytics-locked-card')).toBe(true);
    press(renderer, 'analytics-unlock');
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Section',
      params: { sectionId: 'subscription' },
    });
  });

  it('shows nothing until the plan is known', () => {
    const renderer = mount(
      <AnalyticsSummary
        dashboard={query()}
        statusCounts={query({ data: counts })}
      />,
    );
    expect(has(renderer, 'analytics-section')).toBe(false);
    expect(has(renderer, 'analytics-locked-card')).toBe(false);
  });

  it('"See full analytics" opens the Analytics screen', () => {
    const renderer = mount(
      <AnalyticsSummary
        dashboard={query({ data: dashboard() })}
        statusCounts={query({ data: counts })}
      />,
    );
    press(renderer, 'analytics-see-all');
    expect(mockNavigate).toHaveBeenCalledWith('Analytics');
  });
});

describe('the activity cards', () => {
  const orders: RecentOrder[] = [
    {
      id: 'o1',
      orderNumber: 'TV-100',
      buyer: 'Acme Ltd',
      amount: 5_000,
      deliveryStatus: 'READY_TO_SHIP',
    },
    {
      id: 'o2',
      orderNumber: 'TV-101',
      buyer: 'Bharat Co',
      amount: 1_250.5,
      deliveryStatus: 'SHIPPED',
    },
  ];

  it('recent orders: number, buyer, amount and the seller-facing status', () => {
    const renderer = mount(
      <RecentOrdersCard query={query({ data: page(orders) })} />,
    );
    const out = words(renderer);
    expect(out).toContain('TV-100');
    expect(out).toContain('Acme Ltd');
    expect(out).toContain('₹5,000');
    expect(out).toContain('₹1,250.50');
    expect(out).toContain('Ready to Ship');
    expect(out).toContain('Out for Delivery');
  });

  it('recent orders: a row opens Orders with the order, "View all" opens Orders', () => {
    const renderer = mount(
      <RecentOrdersCard query={query({ data: page(orders) })} />,
    );
    press(renderer, 'order-row-TV-100');
    expect(mockOpenRoute).toHaveBeenLastCalledWith({
      name: 'Main',
      params: { screen: 'Orders', query: { order: 'o1' } },
    });
    press(renderer, 'orders-view-all');
    expect(mockOpenRoute).toHaveBeenLastCalledWith({
      name: 'Main',
      params: { screen: 'Orders' },
    });
  });

  it('recent orders: says so when there are none', () => {
    const renderer = mount(
      <RecentOrdersCard query={query({ data: page([]) })} />,
    );
    expect(words(renderer)).toContain(t('home.orders.empty'));
  });

  const inquiries: InquirySummary[] = [
    {
      id: 'i1',
      title: 'Bulk rice',
      productName: 'Basmati',
      quantity: 500,
      unit: 'kg',
      urgent: true,
      createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    },
    {
      id: 'i2',
      title: 'Steel pipe',
      productName: 'Pipe',
      quantity: 10,
      unit: 'ton',
      urgent: false,
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
  ];

  it('inquiry centre: counts the urgent ones and shows relative times', () => {
    const renderer = mount(
      <InquiryCenterCard query={query({ data: page(inquiries) })} />,
    );
    const out = words(renderer);
    expect(out).toContain(t('home.inquiries.urgent', { count: 1 }));
    expect(out).toContain('Bulk rice');
    expect(out).toContain('Basmati');
    expect(out).toContain('500');
    expect(out).toContain('3h ago');
    expect(out).toContain('2d ago');
  });

  it('inquiry centre: a row opens the inquiry in its section', () => {
    const renderer = mount(
      <InquiryCenterCard query={query({ data: page(inquiries) })} />,
    );
    press(renderer, 'inquiry-row-i1');
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Section',
      params: { sectionId: 'inquiries', query: { rfq: 'i1' } },
    });
  });

  const shipments: ShipmentSummary[] = [
    {
      id: 's1',
      orderNumber: 'TV-100',
      buyer: 'Acme',
      route: 'Mumbai → Delhi',
      eta: '2026-10-25T00:00:00',
      status: 'IN_TRANSIT',
    },
    {
      id: 's2',
      orderNumber: 'TV-101',
      buyer: 'Bharat',
      route: 'Pune → Goa',
      eta: null,
      status: 'LABEL_CREATED',
    },
  ];

  it('shipments: route, status badge, ETA or "TBD" when there is none', () => {
    const renderer = mount(
      <ShipmentsCard query={query({ data: page(shipments) })} />,
    );
    const out = words(renderer);
    expect(out).toContain('Mumbai → Delhi');
    expect(out).toContain('In Transit');
    expect(out).toContain(t('home.shipments.eta', { date: '25 Oct' }));
    expect(out).toContain(t('home.shipments.etaTbd'));
  });
});

describe('each card fails on its own', () => {
  it('a failed card shows an inline error and a retry while its neighbours still draw', () => {
    const refetch = jest.fn();
    const renderer = mount(
      <View>
        <RecentOrdersCard query={query({ isError: true, refetch })} />
        <ShipmentsCard query={query({ data: page([]) })} />
      </View>,
    );
    expect(has(renderer, 'card-error')).toBe(true);
    expect(has(renderer, 'shipment-tracking')).toBe(true);
    act(() => {
      renderer.root
        .find(
          node =>
            node.props.label === t('common.tryAgain') && node.props.onPress,
        )
        .props.onPress();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps showing data it already has when a refresh fails', () => {
    const renderer = mount(
      <RecentOrdersCard
        query={query({
          isError: true,
          data: page([
            {
              id: 'o1',
              orderNumber: 'TV-100',
              buyer: 'Acme',
              amount: 1,
              deliveryStatus: 'PENDING',
            },
          ]),
        })}
      />,
    );
    expect(words(renderer)).toContain('TV-100');
    expect(has(renderer, 'card-error')).toBe(false);
  });

  it('a card can hide itself', () => {
    const renderer = mount(
      <HomeCard
        title="Hidden"
        query={query({ data: 1 })}
        hidden
        testID="hidden-card"
      >
        {() => null}
      </HomeCard>,
    );
    expect(renderer.toJSON()).toBeNull();
  });
});

describe('loading order', () => {
  it('lists wait until the status counts, wallet and dashboard have each answered', () => {
    const loading = { isFetching: true };
    const done = { isFetching: false };
    const failed = { isFetching: false };
    expect(usePrimarySettled(loading, done, done)).toBe(false);
    expect(usePrimarySettled(done, done, done)).toBe(true);
    // A headline query that failed has settled too: the lists must not wait for ever.
    expect(usePrimarySettled(failed, done, done)).toBe(true);
  });
});

describe('refresh on focus', () => {
  function probe(refresh: () => void) {
    const callbacks: (() => void)[] = [];
    function Probe({ tick }: { tick: number }) {
      callbacks.push(useRefreshOnFocus(refresh));
      return <View accessibilityLabel={String(tick)} />;
    }
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe tick={0} />);
    });
    act(() => renderer.update(<Probe tick={1} />));
    return callbacks;
  }

  afterEach(() => jest.restoreAllMocks());

  it('keeps one callback across renders, so a render never restarts the 30 s clock', () => {
    const callbacks = probe(jest.fn());
    expect(callbacks.length).toBeGreaterThan(1);
    expect(new Set(callbacks).size).toBe(1);
  });

  it('refreshes only when the screen was away for more than 30 seconds', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const refresh = jest.fn();
    const [onFocus] = probe(refresh);
    now.mockReturnValue(1_000_000 + 20_000);
    onFocus();
    expect(refresh).not.toHaveBeenCalled();
    now.mockReturnValue(1_000_000 + 20_000 + 31_000);
    onFocus();
    expect(refresh).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1_000_000 + 20_000 + 31_000 + 5_000);
    onFocus();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
