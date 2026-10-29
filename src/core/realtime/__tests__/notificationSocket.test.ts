const mockEnsure = jest.fn();
const mockGetToken = jest.fn();
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  ensureFreshAccessToken: (...args: unknown[]) => mockEnsure(...args),
  getAccessToken: () => mockGetToken(),
}));

const mockInvalidate = jest.fn();
const mockInvalidatePortal = jest.fn();
const mockInvalidateChats = jest.fn();
jest.mock('@/core/query/queryClient', () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidate(...args),
  },
  queryKeys: {
    notifications: ['notifications'],
    notificationSnapshot: ['notifications', 'live'],
  },
  invalidatePortalData: () => mockInvalidatePortal(),
  invalidateChats: () => mockInvalidateChats(),
}));

import { io } from 'socket.io-client';
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
  isNotificationSocketConnected,
  socketStatusStore,
} from '../notificationSocket';

type Handlers = Record<string, (...args: unknown[]) => void>;
interface FakeSocket {
  on: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  removeAllListeners: jest.Mock;
  __handlers: Handlers;
}
const socket = (io as unknown as jest.Mock)() as FakeSocket;
const lastCall = () =>
  (io as unknown as jest.Mock).mock.calls.at(-1) as [
    string,
    {
      auth: (callback: (data: { token: string }) => void) => void;
    } & Record<string, unknown>,
  ];

beforeEach(() => {
  jest.clearAllMocks();
  disconnectNotificationSocket();
  for (const key of Object.keys(socket.__handlers)) {
    delete socket.__handlers[key];
  }
});

describe('the notifications socket', () => {
  it('connects to the /notifications namespace over websocket only, with backoff to 30 s', () => {
    connectNotificationSocket();
    const [url, options] = lastCall();
    expect(url.endsWith('/notifications')).toBe(true);
    expect(options).toMatchObject({
      path: '/api/realtime/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelayMax: 30_000,
    });
    expect(socketStatusStore.get().state).toBe('connecting');
  });

  it('asks for a fresh token on every connect attempt', async () => {
    mockEnsure.mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    connectNotificationSocket();
    const { auth } = lastCall()[1];
    const seen: string[] = [];
    await new Promise<void>(resolve =>
      auth(data => {
        seen.push(data.token);
        resolve();
      }),
    );
    await new Promise<void>(resolve =>
      auth(data => {
        seen.push(data.token);
        resolve();
      }),
    );
    expect(seen).toEqual(['first', 'second']);
  });

  it('falls back to the current token when a refresh fails', async () => {
    mockEnsure.mockRejectedValue(new Error('offline'));
    mockGetToken.mockReturnValue('still-valid');
    connectNotificationSocket();
    const { auth } = lastCall()[1];
    const token = await new Promise<string>(resolve =>
      auth(data => resolve(data.token)),
    );
    expect(token).toBe('still-valid');
  });

  it('tracks connection state and refreshes the snapshot on connect and disconnect', () => {
    connectNotificationSocket();
    socket.__handlers.connect();
    expect(isNotificationSocketConnected()).toBe(true);
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: ['notifications', 'live'],
    });
    socket.__handlers.disconnect('transport close');
    expect(socketStatusStore.get()).toMatchObject({
      state: 'disconnected',
      lastError: 'transport close',
    });
    expect(isNotificationSocketConnected()).toBe(false);
  });

  it('reconnects after the server disconnects an unauthenticated socket', () => {
    jest.useFakeTimers();
    connectNotificationSocket();
    socket.__handlers.disconnect('io server disconnect');
    expect(socket.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5_000);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('records a connect error', () => {
    connectNotificationSocket();
    socket.__handlers.connect_error({ message: 'jwt expired' });
    expect(socketStatusStore.get()).toMatchObject({
      state: 'error',
      lastError: 'jwt expired',
    });
  });

  it('on notification:changed refreshes notifications, the dashboard and chats', () => {
    connectNotificationSocket();
    socket.__handlers['notification:changed']();
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: ['notifications'],
    });
    expect(mockInvalidatePortal).toHaveBeenCalled();
    expect(mockInvalidateChats).toHaveBeenCalled();
    expect(socketStatusStore.get().lastEventAt).not.toBeNull();
  });

  it('opens one socket however often it is asked, and tears down on sign-out', () => {
    (io as unknown as jest.Mock).mockClear();
    connectNotificationSocket();
    connectNotificationSocket();
    expect(io).toHaveBeenCalledTimes(1);
    disconnectNotificationSocket();
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(socketStatusStore.get()).toEqual({
      state: 'disconnected',
      lastEventAt: null,
      lastError: null,
    });
  });
});
