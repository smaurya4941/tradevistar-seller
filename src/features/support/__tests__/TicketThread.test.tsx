import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SupportTicketDetail } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { translate } from '@/i18n';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ isReady: () => false }),
  useNavigation: () => ({ navigate: mockNavigate, replace: jest.fn() }),
  useRoute: () => ({ params: { ticketId: 't1' } }),
}));

let mockTicket: {
  data?: SupportTicketDetail;
  isError?: boolean;
  refetch: jest.Mock;
};
jest.mock('../data', () => ({
  ...jest.requireActual('../data'),
  useTicket: () => mockTicket,
  refreshSupport: jest.fn(),
}));

jest.mock('@/core/network/useIsOffline', () => ({
  useIsOffline: () => mockOffline,
}));
let mockOffline = false;

const mockReply = jest.fn();
const mockClose = jest.fn();
const mockRate = jest.fn();
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  replyToTicket: (...args: unknown[]) => mockReply(...args),
  closeTicket: (...args: unknown[]) => mockClose(...args),
  rateTicket: (...args: unknown[]) => mockRate(...args),
  getTicket: jest.fn(),
}));

import { ToastProvider } from '@/design';
import { TicketThreadScreen } from '../TicketThreadScreen';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const detail = (
  over: Partial<SupportTicketDetail> = {},
): SupportTicketDetail => ({
  id: 't1',
  ticketNumber: 'TKT-7',
  subject: 'Payout missing',
  message: 'first',
  orderId: null,
  orderNumber: null,
  category: 'PAYMENTS',
  priority: 'NORMAL',
  status: 'OPEN',
  messageCount: 2,
  rating: null,
  ratingComment: null,
  changeRequest: null,
  lastActivityAt: '2026-10-22T10:00:00Z',
  createdAt: '2026-10-22T10:00:00Z',
  messages: [
    {
      id: 'm1',
      body: 'My payout is late',
      authorUserId: 'me',
      fromSupport: false,
      createdAt: '2026-10-22T10:00:00Z',
    },
    {
      id: 'm2',
      body: 'We are checking it',
      authorUserId: 'agent',
      fromSupport: true,
      createdAt: '2026-10-22T10:30:00Z',
    },
  ],
  events: [
    { id: 'e1', eventType: 'RESOLVED', createdAt: '2026-10-22T11:00:00Z' },
  ],
  ...over,
});

const mounted: ReactTestRenderer[] = [];

// Toast timers must not outlive the test that raised them.
afterEach(() => {
  act(() => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
});

async function show() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <TicketThreadScreen />
        </ToastProvider>
      </QueryClientProvider>,
    );
  });
  mounted.push(renderer);
  return renderer;
}

const has = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;
/** The words on screen: every string child, ignoring props (which hold circular React context). */
function collect(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(child => collect(child, out));
  else collect((node as { children?: unknown }).children, out);
}
const text = (renderer: ReactTestRenderer) => {
  const out: string[] = [];
  collect(renderer.toJSON(), out);
  return out.join(' ');
};
const field = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.find(
    node =>
      node.props.testID === id && typeof node.props.onChangeText === 'function',
  );
const button = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.find(
    node =>
      node.props.testID === id && typeof node.props.onPress === 'function',
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockTicket = { data: detail(), refetch: jest.fn(async () => undefined) };
});

describe('the ticket thread', () => {
  it('marks the seller\'s messages "You" and the desk\'s "TradeVistar Support", in time order', async () => {
    const renderer = await show();
    const out = text(renderer);
    expect(out).toContain(t('support.thread.you'));
    expect(out).toContain(t('support.thread.supportName'));
    expect(out.indexOf('My payout is late')).toBeLessThan(
      out.indexOf('We are checking it'),
    );
    expect(has(renderer, 'message-m1')).toBe(true);
    expect(has(renderer, 'message-m2')).toBe(true);
  });

  it('shows status changes between the messages', async () => {
    const renderer = await show();
    expect(text(renderer)).toContain(t('support.event.resolved'));
  });

  it('offers a reply box and Close on an open ticket', async () => {
    const renderer = await show();
    expect(has(renderer, 'thread-composer')).toBe(true);
    expect(has(renderer, 'thread-close')).toBe(true);
    expect(has(renderer, 'thread-closed-note')).toBe(false);
  });

  it('rejects a one-character reply without calling the server', async () => {
    const renderer = await show();
    await act(async () =>
      field(renderer, 'thread-reply').props.onChangeText('a'),
    );
    await act(async () => button(renderer, 'thread-send').props.onPress());
    expect(mockReply).not.toHaveBeenCalled();
    expect(text(renderer)).toContain(t('support.reply.error.short'));
  });

  it('sends a valid reply and clears the box', async () => {
    mockReply.mockResolvedValue(detail());
    const renderer = await show();
    await act(async () =>
      field(renderer, 'thread-reply').props.onChangeText('  Thanks, waiting  '),
    );
    await act(async () => button(renderer, 'thread-send').props.onPress());
    expect(mockReply).toHaveBeenCalledWith('t1', 'Thanks, waiting');
    expect(field(renderer, 'thread-reply').props.value).toBe('');
  });

  it('keeps the text and shows the reason when sending fails', async () => {
    mockReply.mockRejectedValue(new Error('network'));
    const renderer = await show();
    await act(async () =>
      field(renderer, 'thread-reply').props.onChangeText('Hello there'),
    );
    await act(async () => button(renderer, 'thread-send').props.onPress());
    expect(field(renderer, 'thread-reply').props.value).toBe('Hello there');
    expect(text(renderer)).toContain(t('support.reply.failed'));
  });

  it('closing asks for confirmation first', async () => {
    mockClose.mockResolvedValue(detail({ status: 'CLOSED' }));
    const renderer = await show();
    await act(async () => button(renderer, 'thread-close').props.onPress());
    expect(mockClose).not.toHaveBeenCalled();
    const dialog = renderer.root.find(
      node => node.props.testID === 'thread-close-dialog',
    );
    expect(dialog.props.visible).toBe(true);
    await act(async () => dialog.props.onConfirm());
    expect(mockClose).toHaveBeenCalledWith('t1');
  });

  it('disables sending while offline', async () => {
    mockOffline = true;
    const renderer = await show();
    expect(button(renderer, 'thread-send').props.disabled).toBe(true);
    expect(text(renderer)).toContain(t('support.offlineWrite'));
  });

  it('a closed ticket has no reply box, says to raise a new one, and can be rated', async () => {
    mockTicket = { data: detail({ status: 'CLOSED' }), refetch: jest.fn() };
    const renderer = await show();
    expect(has(renderer, 'thread-composer')).toBe(false);
    expect(has(renderer, 'thread-closed-note')).toBe(true);
    expect(text(renderer)).toContain(t('support.thread.closedNote'));
    expect(has(renderer, 'rate-form')).toBe(true);
  });

  it('a resolved, unrated ticket shows the rating form and keeps replying open', async () => {
    mockTicket = { data: detail({ status: 'RESOLVED' }), refetch: jest.fn() };
    const renderer = await show();
    expect(has(renderer, 'rate-form')).toBe(true);
    expect(has(renderer, 'thread-composer')).toBe(true);
  });

  it('an open ticket cannot be rated yet', async () => {
    const renderer = await show();
    expect(has(renderer, 'rate-form')).toBe(false);
    expect(has(renderer, 'rate-given')).toBe(false);
  });

  it('a rated ticket shows the rating given, with a way to change it', async () => {
    mockTicket = {
      data: detail({
        status: 'CLOSED',
        rating: 4,
        ratingComment: 'Quick help',
      }),
      refetch: jest.fn(),
    };
    const renderer = await show();
    expect(has(renderer, 'rate-given')).toBe(true);
    expect(text(renderer)).toContain('Quick help');
    expect(has(renderer, 'rate-change')).toBe(true);
  });

  it('submits a rating with the chosen stars and comment', async () => {
    mockRate.mockResolvedValue(detail({ status: 'RESOLVED', rating: 5 }));
    mockTicket = { data: detail({ status: 'RESOLVED' }), refetch: jest.fn() };
    const renderer = await show();
    expect(button(renderer, 'rate-submit').props.disabled).toBe(true);
    await act(async () =>
      renderer.root
        .find(
          node => node.props.testID === 'rate-stars-5' && node.props.onPress,
        )
        .props.onPress(),
    );
    await act(async () =>
      field(renderer, 'rate-comment').props.onChangeText('Great'),
    );
    expect(button(renderer, 'rate-submit').props.disabled).toBe(false);
    await act(async () => button(renderer, 'rate-submit').props.onPress());
    expect(mockRate).toHaveBeenCalledWith('t1', 5, 'Great');
  });

  it('says the ticket could not be loaded, with a retry', async () => {
    mockTicket = { data: undefined, isError: true, refetch: jest.fn() };
    const renderer = await show();
    expect(text(renderer)).toContain(t('support.thread.loadFailed'));
  });

  it('shows a skeleton while the first answer loads', async () => {
    mockTicket = { data: undefined, isError: false, refetch: jest.fn() };
    const renderer = await show();
    expect(has(renderer, 'thread-loading')).toBe(true);
  });
});
