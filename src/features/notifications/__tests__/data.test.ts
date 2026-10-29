import type { InfiniteData } from '@tanstack/react-query';
import {
  ApiError,
  type NotificationPage,
  type SellerNotification,
} from '@tradevistar/seller-api';

const mockRead = jest.fn();
const mockUnread = jest.fn();
const mockReadAll = jest.fn();
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  markNotificationRead: (...args: unknown[]) => mockRead(...args),
  markNotificationUnread: (...args: unknown[]) => mockUnread(...args),
  markAllNotificationsRead: (...args: unknown[]) => mockReadAll(...args),
}));

import { queryClient, queryKeys } from '@/core/query/queryClient';
import { markAllRead, markRead, markUnread } from '../data';

const key = [...queryKeys.notifications, 'list', 'all', false, 'seller-1'];

const item = (id: string, read: boolean): SellerNotification => ({
  id,
  type: 'order.placed',
  title: id,
  body: null,
  read,
  createdAt: '2026-10-22T10:00:00Z',
  metadata: null,
});

const seed = (): void => {
  const page: NotificationPage = {
    items: [item('a', false), item('b', true)],
    meta: { page: 1, limit: 25, total: 2, totalPages: 1 },
    unreadCount: 1,
  };
  queryClient.setQueryData<InfiniteData<NotificationPage>>(key, {
    pages: [page],
    pageParams: [1],
  });
};

const flag = (id: string): boolean | undefined =>
  queryClient
    .getQueryData<InfiniteData<NotificationPage>>(key)
    ?.pages[0].items.find(entry => entry.id === id)?.read;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  seed();
});

describe('marking read', () => {
  it('flips the row at once, before the server answers', async () => {
    let finish!: () => void;
    mockRead.mockReturnValue(new Promise<void>(resolve => (finish = resolve)));
    const pending = markRead(item('a', false));
    expect(flag('a')).toBe(true);
    finish();
    await pending;
    expect(mockRead).toHaveBeenCalledWith('a');
  });

  it('puts the row back and rethrows when the server refuses', async () => {
    mockRead.mockRejectedValue(new ApiError(500, { code: 'X', message: 'no' }));
    await expect(markRead(item('a', false))).rejects.toBeInstanceOf(ApiError);
    expect(flag('a')).toBe(false);
  });

  it('does nothing for a row that is already read', async () => {
    await markRead(item('b', true));
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('marks unread, and rolls that back too', async () => {
    mockUnread.mockResolvedValue(undefined);
    await markUnread(item('b', true));
    expect(flag('b')).toBe(false);
    seed();
    mockUnread.mockRejectedValue(
      new ApiError(500, { code: 'X', message: 'no' }),
    );
    await expect(markUnread(item('b', true))).rejects.toBeInstanceOf(ApiError);
    expect(flag('b')).toBe(true);
  });

  it('refreshes the whole notifications family after each change', async () => {
    const spy = jest.spyOn(queryClient, 'invalidateQueries');
    mockRead.mockResolvedValue(undefined);
    await markRead(item('a', false));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.notifications });
  });
});

describe('mark all read', () => {
  it('clears everything without a category', async () => {
    mockReadAll.mockResolvedValue(undefined);
    await markAllRead('all');
    expect(mockReadAll).toHaveBeenCalledWith(undefined);
  });

  it('clears only the category in view', async () => {
    mockReadAll.mockResolvedValue(undefined);
    await markAllRead('quotes');
    expect(mockReadAll).toHaveBeenCalledWith('quotes');
  });

  it('still refreshes when the server refuses', async () => {
    const spy = jest.spyOn(queryClient, 'invalidateQueries');
    mockReadAll.mockRejectedValue(
      new ApiError(500, { code: 'X', message: 'no' }),
    );
    await expect(markAllRead('all')).rejects.toBeInstanceOf(ApiError);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.notifications });
  });
});
