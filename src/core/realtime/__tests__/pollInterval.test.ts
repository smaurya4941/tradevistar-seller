import { isLiveScreen } from '../focusedRoute';
import {
  POLL_SOCKET_DOWN_VISIBLE_MS,
  POLL_WITH_SOCKET_MS,
  snapshotPollInterval,
} from '../pollInterval';

describe('snapshotPollInterval', () => {
  it('polls every 30 s while the socket is up', () => {
    expect(
      snapshotPollInterval({ socketConnected: true, liveScreenVisible: true }),
    ).toBe(POLL_WITH_SOCKET_MS);
    expect(
      snapshotPollInterval({ socketConnected: true, liveScreenVisible: false }),
    ).toBe(30_000);
  });

  it('polls every 10 s while the socket is down and Home or Inbox is in front', () => {
    expect(
      snapshotPollInterval({ socketConnected: false, liveScreenVisible: true }),
    ).toBe(POLL_SOCKET_DOWN_VISIBLE_MS);
    expect(POLL_SOCKET_DOWN_VISIBLE_MS).toBe(10_000);
  });

  it('stays at 30 s when the socket is down but nothing live is in front', () => {
    expect(
      snapshotPollInterval({
        socketConnected: false,
        liveScreenVisible: false,
      }),
    ).toBe(30_000);
  });

  it('treats Home and the Inbox as the live screens', () => {
    expect(isLiveScreen('HomeMain')).toBe(true);
    expect(isLiveScreen('InboxMain')).toBe(true);
    expect(isLiveScreen('MoreMain')).toBe(false);
    expect(isLiveScreen(undefined)).toBe(false);
  });
});
