/**
 * A destination that arrived (from a link) before the seller could be taken there: the app was
 * still starting, or the seller was signed out. It is opened once, after sign-in.
 */
import { createStore } from '@/core/store';
import type { AppRoute } from './types';

export const pendingRouteStore = createStore<AppRoute | null>(null);

export function holdRoute(route: AppRoute): void {
  pendingRouteStore.set(route);
}

/** Returns the held route and forgets it. */
export function takePendingRoute(): AppRoute | null {
  const route = pendingRouteStore.get();
  pendingRouteStore.set(null);
  return route;
}
