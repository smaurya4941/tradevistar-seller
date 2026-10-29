/**
 * What "online" means for the app. NetInfo reports `null` while it is still finding out, and
 * `isInternetReachable` can be null on networks that block its probe; only an explicit `false`
 * counts as offline, so a slow probe never shows an offline banner.
 */
export interface ConnectivityState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

export function isOffline(state: ConnectivityState): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function isConnected(state: ConnectivityState): boolean {
  return !isOffline(state);
}
