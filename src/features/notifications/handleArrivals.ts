/**
 * What to do with notifications that have just arrived, kept free of React and native modules so
 * the rules are unit tested:
 *
 * - app in the foreground: one in-app banner for the newest arrival and one sound (if the seller
 *   has it on and an admin sound is ready); no system notification;
 * - app alive in the background: a system notification for each arrival the server flagged for
 *   push (`metadata._push`, which the server sets only when the seller's Push preference for that
 *   category is on);
 * - a message for the conversation the seller is reading is silent either way.
 */
import {
  isPushFlagged,
  type SellerNotification,
} from '@tradevistar/seller-api';

export interface ArrivalDeps {
  appActive: boolean;
  soundEnabled: boolean;
  /** The saved admin sound, once downloaded. */
  soundPath: string | null;
  unreadTotal: number;
  isOpenConversation(row: SellerNotification): boolean;
  showBanner(row: SellerNotification): void;
  playSound(path: string): void;
  showSystemAlert(row: SellerNotification, unreadTotal: number): void;
}

export interface ArrivalOutcome {
  banner: boolean;
  sound: boolean;
  systemAlerts: number;
}

export function handleArrivals(
  arrived: readonly SellerNotification[],
  deps: ArrivalDeps,
): ArrivalOutcome {
  const audible = arrived.filter(row => !deps.isOpenConversation(row));
  const outcome: ArrivalOutcome = {
    banner: false,
    sound: false,
    systemAlerts: 0,
  };
  if (!audible.length) return outcome;

  if (deps.appActive) {
    const newest = [...audible].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];
    deps.showBanner(newest);
    outcome.banner = true;
    if (deps.soundEnabled && deps.soundPath) {
      deps.playSound(deps.soundPath);
      outcome.sound = true;
    }
    return outcome;
  }

  for (const row of audible) {
    if (!isPushFlagged(row)) continue;
    deps.showSystemAlert(row, deps.unreadTotal);
    outcome.systemAlerts += 1;
  }
  return outcome;
}
