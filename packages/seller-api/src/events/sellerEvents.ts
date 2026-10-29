/**
 * Platform-neutral change notifications.
 *
 * The shared package cannot touch React, so it publishes here and the app bridges each event to
 * whatever its UI listens to (a banner, a React Query invalidation, the maintenance screen).
 */
export type SellerEvent =
  /** A write was refused because the seller's KYC is not verified yet. */
  | "access:verification-required"
  /** A write was refused because a maintenance window pauses it (503 MAINTENANCE_MODE). */
  | "notices:maintenance-paused";

/** What the API said when it refused: its error body, for events that have one. */
export interface SellerEventDetail {
  code: string;
  message: string;
  details?: unknown;
}

type Listener = (detail?: SellerEventDetail) => void;

const listeners = new Map<SellerEvent, Set<Listener>>();

export function onSellerEvent(event: SellerEvent, listener: Listener): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function emitSellerEvent(event: SellerEvent, detail?: SellerEventDetail): void {
  for (const listener of listeners.get(event) ?? []) {
    try {
      listener(detail);
    } catch {
      // One faulty subscriber must never break the request that triggered the event.
    }
  }
}
