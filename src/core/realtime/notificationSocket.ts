/**
 * The authenticated `/notifications` socket. The server emits `notification:changed` whenever the
 * seller's notifications change; the app then refetches the snapshot, counts and lists rather than
 * trusting a pushed payload, which is how the web portal stays consistent too.
 *
 * Connected only while signed in. The token is read on every (re)connect attempt, so a refreshed
 * access token is picked up without tearing the socket down. Websocket transport only, reconnect
 * backoff up to 30 seconds.
 */
import {
  ensureFreshAccessToken,
  getAccessToken,
} from '@tradevistar/seller-api';
import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { logger } from '@/core/logger';
import {
  invalidateChats,
  invalidatePortalData,
  queryClient,
  queryKeys,
} from '@/core/query/queryClient';
import { createStore } from '@/core/store';

export type SocketState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SocketStatus {
  state: SocketState;
  lastEventAt: number | null;
  lastError: string | null;
}

export const socketStatusStore = createStore<SocketStatus>({
  state: 'disconnected',
  lastEventAt: null,
  lastError: null,
});

let socket: Socket | null = null;

/** The families a change event makes stale: notifications, the dashboard and tickets, and chats. */
export function handleNotificationChanged(): void {
  socketStatusStore.set(previous => ({ ...previous, lastEventAt: Date.now() }));
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  // Orders, inquiries, wallet figures and tickets may have changed too.
  invalidatePortalData();
  // A new message notifies too: an open thread or list refreshes straight away.
  invalidateChats();
}

function refreshSnapshot(): void {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.notificationSnapshot,
  });
}

export function connectNotificationSocket(): void {
  if (socket) return;
  socketStatusStore.set(previous => ({
    ...previous,
    state: 'connecting',
    lastError: null,
  }));
  socket = io(`${env.socketUrl}/notifications`, {
    path: '/api/realtime/socket.io',
    transports: ['websocket'],
    auth: callback => {
      ensureFreshAccessToken()
        .catch(() => getAccessToken())
        .then(token => callback({ token: token ?? '' }));
    },
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
  });

  socket.on('connect', () => {
    socketStatusStore.set(previous => ({
      ...previous,
      state: 'connected',
      lastError: null,
    }));
    // Events sent while the socket was down were missed: read the snapshot once now.
    refreshSnapshot();
  });
  socket.on('disconnect', reason => {
    socketStatusStore.set(previous => ({
      ...previous,
      state: 'disconnected',
      lastError: reason,
    }));
    // Reschedule the fallback poll at its faster pace.
    refreshSnapshot();
    // The server disconnects an unauthenticated socket; retry once the token may have refreshed.
    if (reason === 'io server disconnect') {
      setTimeout(() => socket?.connect(), 5_000);
    }
  });
  socket.on('connect_error', error => {
    socketStatusStore.set(previous => ({
      ...previous,
      state: 'error',
      lastError: error.message,
    }));
    logger.info('[socket] connect error', error.message);
  });
  socket.on('notification:changed', handleNotificationChanged);
}

export function disconnectNotificationSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  socketStatusStore.set({
    state: 'disconnected',
    lastEventAt: null,
    lastError: null,
  });
}

export function isNotificationSocketConnected(): boolean {
  return socketStatusStore.get().state === 'connected';
}
