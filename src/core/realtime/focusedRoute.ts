/**
 * The screen in front, by route name. The live snapshot polls faster while the socket is down and
 * the seller is looking at Home or the Inbox, where a stale badge or list would be noticed.
 */
import { createStore } from '@/core/store';

export const focusedRouteStore = createStore<string | undefined>(undefined);

/** Screens where a stale count is visible at a glance. */
export const LIVE_SCREENS: readonly string[] = ['HomeMain', 'InboxMain'];

export function isLiveScreen(routeName: string | undefined): boolean {
  return routeName !== undefined && LIVE_SCREENS.includes(routeName);
}
