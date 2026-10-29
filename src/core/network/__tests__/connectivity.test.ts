import { isConnected, isOffline } from '../connectivity';

describe('connectivity', () => {
  it('is offline only on an explicit false', () => {
    expect(isOffline({ isConnected: false, isInternetReachable: null })).toBe(
      true,
    );
    expect(isOffline({ isConnected: true, isInternetReachable: false })).toBe(
      true,
    );
  });

  it('does not show offline while NetInfo is still finding out', () => {
    expect(isOffline({ isConnected: null, isInternetReachable: null })).toBe(
      false,
    );
    expect(isOffline({ isConnected: true, isInternetReachable: null })).toBe(
      false,
    );
    expect(isConnected({ isConnected: true, isInternetReachable: true })).toBe(
      true,
    );
  });
});
