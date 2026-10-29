/**
 * Opens a portal link (`/seller/dashboard/orders?order=<id>`) as an app route: from a
 * notification row, a tapped system notification, a search result or an in-app banner.
 *
 * The navigator may still be mounting (a notification tap can cold-start the app) or the seller
 * may be signed out; the route is retried for a couple of seconds and then held until sign-in.
 */
import { navigateToRoute, navigationRef } from './navigationRef';
import { holdRoute } from './pendingRoute';
import { routeForHref } from './routeMapping';
import type { AppRoute } from './types';

/** Navigates to `route` as soon as the navigator can take it, else holds it for after sign-in. */
export function openRoute(route: AppRoute, attempts = 20): void {
  if (navigateToRoute(route)) return;
  if (!navigationRef.isReady() && attempts > 0) {
    setTimeout(() => openRoute(route, attempts - 1), 100);
    return;
  }
  holdRoute(route);
}

/** Returns false when the app has no screen for the href (the caller can offer "Open on web"). */
export function openPortalHref(href: string): boolean {
  const route = routeForHref(href);
  if (!route) return false;
  openRoute(route);
  return true;
}

/** The notification centre, optionally on one category. */
export function openInbox(): void {
  openRoute({ name: 'Main', params: { screen: 'Inbox' } });
}
