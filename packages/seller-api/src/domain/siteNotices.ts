/**
 * Rules for the platform notice banner, kept apart from the screens so they are tested alone.
 *
 * The API reports its own clock with every list, so every "starts in" and "back by" is measured
 * against server time (device time + skew). A phone whose clock is minutes off still counts down
 * correctly.
 */
import type { SiteNotice } from "../endpoints/siteNotices";

/** How often the list is re-read while the app is open. */
export const NOTICE_POLL_MS = 60_000;
/** How long each notice shows before the banner rotates to the next. */
export const NOTICE_ROTATE_MS = 7_000;
/** The banner re-evaluates its countdown this often. */
export const NOTICE_TICK_MS = 30_000;

/** Server time minus device time, in ms; add it to the device clock to get the server clock. */
export function clockSkew(serverTime: string | null | undefined, deviceNow: number): number {
  const server = serverTime ? Date.parse(serverTime) : Number.NaN;
  return Number.isFinite(server) ? server - deviceNow : 0;
}

/**
 * A live maintenance cannot be dismissed — the buyer must be able to tell why actions fail.
 * Everything else can be put away for the rest of the session.
 */
export const isDismissible = (notice: Pick<SiteNotice, "kind" | "state">): boolean =>
  !(notice.kind === "MAINTENANCE" && notice.state === "LIVE");

/** Notices still worth showing: not dismissed, except live maintenance, which always shows. */
export function visibleNotices(notices: readonly SiteNotice[], dismissed: readonly string[]): SiteNotice[] {
  return notices.filter((notice) => !dismissed.includes(notice.id) || !isDismissible(notice));
}

/** The notice at a rotating position; wraps, and is null for an empty list. */
export function noticeAt(notices: readonly SiteNotice[], index: number): SiteNotice | null {
  if (notices.length === 0) return null;
  return notices[((index % notices.length) + notices.length) % notices.length] ?? null;
}

export type NoticeLabel = "announcement" | "maintenance" | "upcomingMaintenance";

export function noticeLabel(notice: Pick<SiteNotice, "kind" | "state">): NoticeLabel {
  if (notice.kind === "ANNOUNCEMENT") return "announcement";
  return notice.state === "LIVE" ? "maintenance" : "upcomingMaintenance";
}

export type NoticeTone = "info" | "warning" | "upcoming";

/** Announcements read as information, live maintenance as a warning, upcoming as a heads-up. */
export function noticeTone(notice: Pick<SiteNotice, "kind" | "state">): NoticeTone {
  if (notice.kind === "ANNOUNCEMENT") return "info";
  return notice.state === "LIVE" ? "warning" : "upcoming";
}

/** The short time line next to the title. */
export type NoticeTiming =
  | { type: "startsIn"; ms: number }
  | { type: "backBy"; at: string }
  | { type: "inProgress" }
  | { type: "eventIn"; at: string; ms: number };

export function noticeTiming(notice: SiteNotice, serverNow: number): NoticeTiming | null {
  if (notice.kind === "MAINTENANCE") {
    if (notice.state === "UPCOMING") return { type: "startsIn", ms: Math.max(0, Date.parse(notice.startsAt) - serverNow) };
    return notice.endsAt ? { type: "backBy", at: notice.endsAt } : { type: "inProgress" };
  }
  if (notice.eventAt && Date.parse(notice.eventAt) > serverNow) {
    return { type: "eventIn", at: notice.eventAt, ms: Date.parse(notice.eventAt) - serverNow };
  }
  return null;
}

export type DurationUnit = "daysHours" | "hoursMinutes" | "minutes" | "underMinute";

export interface DurationText {
  unit: DurationUnit;
  days: number;
  hours: number;
  minutes: number;
}

/** "2d 4h", "3h 20m", "12m" or "under a minute", as data so the screen can translate it. */
export function durationText(ms: number): DurationText {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (totalMinutes < 1) return { unit: "underMinute", days, hours, minutes };
  if (days > 0) return { unit: "daysHours", days, hours, minutes };
  if (hours > 0) return { unit: "hoursMinutes", days, hours, minutes };
  return { unit: "minutes", days, hours, minutes };
}

/**
 * Milliseconds until the next scheduled start or end that falls inside the poll window, so the
 * banner flips on time instead of waiting for the next poll. Null when nothing is due soon.
 */
export function nextTransitionMs(
  notices: readonly SiteNotice[],
  serverNow: number,
  windowMs: number = NOTICE_POLL_MS,
): number | null {
  const upcoming = notices
    .flatMap((notice) => [notice.state === "UPCOMING" ? notice.startsAt : null, notice.endsAt])
    .filter((iso): iso is string => Boolean(iso))
    .map((iso) => Date.parse(iso) - serverNow)
    .filter((ms) => ms > 0 && ms < windowMs)
    .sort((a, b) => a - b);
  return upcoming[0] ?? null;
}

/** What a PARTIAL lock tells the buyer is paused, or the full-lock sentence. */
export type PausedSummary = { type: "all" } | { type: "some"; features: string[] } | null;

export function pausedSummary(notice: SiteNotice): PausedSummary {
  if (notice.kind !== "MAINTENANCE") return null;
  if (notice.lockMode === "FULL") return { type: "all" };
  return { type: "some", features: notice.pausedFeatures };
}

/**
 * The list as it stands on the server clock: a notice whose end has passed drops out, and an
 * upcoming one whose start has passed counts as live, so the banner is right between polls.
 */
export function effectiveNotices(notices: readonly SiteNotice[], serverNow: number): SiteNotice[] {
  return notices
    .filter((notice) => !notice.endsAt || Date.parse(notice.endsAt) > serverNow)
    .map((notice) =>
      notice.state === "UPCOMING" && Date.parse(notice.startsAt) <= serverNow
        ? { ...notice, state: "LIVE" as const }
        : notice,
    );
}
