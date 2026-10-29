/**
 * How often the live snapshot is refetched as a fallback to the socket. The web polls every five
 * seconds; the socket removes the need, so the phone polls gently: every 30 seconds while the
 * socket is up, every 10 while it is down and Home or the Inbox is in front. A backgrounded app
 * does not poll (React Query's focus handling pauses it).
 */
export const POLL_WITH_SOCKET_MS = 30_000;
export const POLL_SOCKET_DOWN_VISIBLE_MS = 10_000;

export function snapshotPollInterval(options: {
  socketConnected: boolean;
  liveScreenVisible: boolean;
}): number {
  if (options.socketConnected) return POLL_WITH_SOCKET_MS;
  return options.liveScreenVisible
    ? POLL_SOCKET_DOWN_VISIBLE_MS
    : POLL_WITH_SOCKET_MS;
}
