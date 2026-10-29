/**
 * Platform notices (`GET /platform/notices`): live or upcoming maintenance and manual
 * announcements an admin publishes from Admin → Maintenance & Notices. Public, so signed-out
 * sellers see them too; the app asks for the seller audience.
 */
import { api } from "../http/client";

export type SiteNoticeKind = "MAINTENANCE" | "ANNOUNCEMENT";
/** Maintenance is announced ahead of time, so a notice is either running now or still to come. */
export type SiteNoticeState = "LIVE" | "UPCOMING";
export type SiteNoticeLockMode = "FULL" | "PARTIAL";
export type SiteNoticeCelebration = string;

export interface SiteNotice {
  id: string;
  kind: SiteNoticeKind;
  state: SiteNoticeState;
  title: string;
  message: string;
  /** FULL pauses every write for the audience; PARTIAL only `pausedFeatures`. Null on announcements. */
  lockMode: SiteNoticeLockMode | null;
  /** Names of the paused parts when the lock is partial. */
  pausedFeatures: string[];
  startsAt: string;
  endsAt: string | null;
  /** An announcement's countdown target. */
  eventAt: string | null;
  celebration?: SiteNoticeCelebration | null;
  celebrationMinutes?: number;
}

export interface SiteNoticesResponse {
  /** The server's clock, so countdowns are right even when the phone's clock is off. */
  serverTime: string;
  notices: SiteNotice[];
}

export type SiteNoticeAudience = "buyer" | "seller";

/** Notices for one site. Never cached by the API; the app polls it. */
export const getSiteNotices = (audience: SiteNoticeAudience = "seller", signal?: AbortSignal) =>
  api.get<SiteNoticesResponse>(`/platform/notices?audience=${audience}`, { signal, skipAuth: true });
