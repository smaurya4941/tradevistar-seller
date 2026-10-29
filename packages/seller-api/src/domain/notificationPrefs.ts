/**
 * Rules for the notification preference matrix (15 categories × 4 channels), mirroring the
 * server's policy (notificationRouting.ts):
 * - Security and Bank alerts have Email and In-app locked on;
 * - Marketing and Analytics start off (the server decides the starting values; the app only reads);
 * - Push rides on In-app: the server sends a push only when In-app is on too, so the app keeps the
 *   two consistent — turning In-app off also turns Push off, and Push cannot be turned on while
 *   In-app is off;
 * - SMS is saved but not delivered today (the SMS gateway carries sign-in codes only).
 */
import type {
  NotificationPreferenceRow,
  PreferenceCategory,
  PreferenceChange,
  PreferenceChannel,
} from "../endpoints/notifications";

const LOCKED: Partial<Record<PreferenceCategory, readonly PreferenceChannel[]>> = {
  SECURITY: ["EMAIL", "IN_APP"],
  BANK: ["EMAIL", "IN_APP"],
};

export function isLockedChannel(category: PreferenceCategory, channel: PreferenceChannel): boolean {
  return LOCKED[category]?.includes(channel) ?? false;
}

export function channelState(
  rows: readonly NotificationPreferenceRow[],
  category: PreferenceCategory,
  channel: PreferenceChannel,
): { enabled: boolean; locked: boolean } {
  const row = rows.find((item) => item.category === category);
  const state = row?.channels.find((item) => item.channel === channel);
  const locked = state?.locked ?? isLockedChannel(category, channel);
  return { enabled: locked || (state?.enabled ?? false), locked };
}

export type ToggleBlock = "locked" | "needsInApp";

/** Why a switch cannot be changed to `next`, or null when it can. */
export function toggleBlock(
  rows: readonly NotificationPreferenceRow[],
  category: PreferenceCategory,
  channel: PreferenceChannel,
  next: boolean,
): ToggleBlock | null {
  if (!next && channelState(rows, category, channel).locked) return "locked";
  if (channel === "PUSH" && next && !channelState(rows, category, "IN_APP").enabled) return "needsInApp";
  return null;
}

/**
 * The changes to send for flipping one switch: the switch itself, plus Push off when In-app is
 * turned off while Push is on. Empty when the switch already has that value or is blocked.
 */
export function changesFor(
  rows: readonly NotificationPreferenceRow[],
  category: PreferenceCategory,
  channel: PreferenceChannel,
  next: boolean,
): PreferenceChange[] {
  if (toggleBlock(rows, category, channel, next)) return [];
  if (channelState(rows, category, channel).enabled === next) return [];
  const changes: PreferenceChange[] = [{ category, channel, enabled: next }];
  if (channel === "IN_APP" && !next && channelState(rows, category, "PUSH").enabled) {
    changes.push({ category, channel: "PUSH", enabled: false });
  }
  return changes;
}

/** The matrix with `changes` applied; used for the optimistic update and for rolling it back. */
export function applyChanges(
  rows: readonly NotificationPreferenceRow[],
  changes: readonly PreferenceChange[],
): NotificationPreferenceRow[] {
  return rows.map((row) => {
    const mine = changes.filter((change) => change.category === row.category);
    if (!mine.length) return row;
    return {
      ...row,
      channels: row.channels.map((state) => {
        const change = mine.find((item) => item.channel === state.channel);
        return change && !state.locked ? { ...state, enabled: change.enabled } : state;
      }),
    };
  });
}

/** True when any category sends push, so the app knows whether it needs the system permission. */
export function anyPushEnabled(rows: readonly NotificationPreferenceRow[]): boolean {
  return rows.some((row) => row.channels.some((state) => state.channel === "PUSH" && state.enabled));
}

/** The "{category}.{channel}" key a switch is tracked by while its save is in flight. */
export const switchKey = (category: PreferenceCategory, channel: PreferenceChannel): string =>
  `${category}.${channel}`;
