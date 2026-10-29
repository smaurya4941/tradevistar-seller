/**
 * The celebration an announcement plays when its event time arrives (Admin → Maintenance &
 * Notices → Celebration), judged on the server clock like the rest of the notice banner.
 *
 * An announcement with an event time and a celebration kind plays it once per device, from the
 * event time for the admin-set number of minutes. Opening the app part-way through still plays what
 * is left; opening it after the window, or after it has played, plays nothing.
 */
import type { SiteNotice } from "../endpoints/siteNotices";

export const CELEBRATION_KINDS = ["LAUNCH", "NEW_FEATURE", "EVENT", "FESTIVAL", "SALE"] as const;

export type CelebrationKind = (typeof CELEBRATION_KINDS)[number];

/** How long it plays when the admin did not say. */
export const DEFAULT_CELEBRATION_MINUTES = 1;

/** How many played celebrations a device remembers. */
export const CELEBRATED_MEMORY = 20;

export function parseCelebrationKind(value: unknown): CelebrationKind | null {
  return (CELEBRATION_KINDS as readonly unknown[]).includes(value) ? (value as CelebrationKind) : null;
}

export interface CelebrationPlan {
  /** The notice it belongs to; remembered once it has started. */
  id: string;
  kind: CelebrationKind;
  title: string;
  message: string;
  /** Server clock, ms since epoch. */
  startsAt: number;
  untilAt: number;
}

/**
 * The celebrations still to play or playing now, soonest first: announcements with a known kind
 * and a valid event time whose window has not ended and which this device has not celebrated.
 */
export function celebrationPlans(
  notices: readonly Pick<
    SiteNotice,
    "id" | "title" | "message" | "eventAt" | "celebration" | "celebrationMinutes"
  >[],
  serverNow: number,
  celebrated: readonly string[],
): CelebrationPlan[] {
  const plans: CelebrationPlan[] = [];
  for (const notice of notices) {
    const kind = parseCelebrationKind(notice.celebration);
    if (!kind || !notice.eventAt || celebrated.includes(notice.id)) continue;
    const startsAt = Date.parse(notice.eventAt);
    if (!Number.isFinite(startsAt)) continue;
    const minutes = notice.celebrationMinutes && notice.celebrationMinutes > 0 ? notice.celebrationMinutes : DEFAULT_CELEBRATION_MINUTES;
    const untilAt = startsAt + minutes * 60_000;
    if (untilAt <= serverNow) continue;
    plans.push({ id: notice.id, kind, title: notice.title, message: notice.message, startsAt, untilAt });
  }
  return plans.sort((a, b) => a.startsAt - b.startsAt);
}

/** Adds an id to the remembered list, newest last, keeping only the most recent few. */
export function rememberCelebrated(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return [...ids];
  return [...ids, id].slice(-CELEBRATED_MEMORY);
}

/** Longest a timer can wait; later events are picked up by a later poll. */
export const MAX_TIMER_MS = 2 ** 31 - 1;
