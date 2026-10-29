/**
 * Product analytics. The events are typed here; `core/observability` attaches the production sink
 * (Google Analytics 4 through Firebase Analytics) at start-up.
 *
 * Events are typed, so a misspelt name or property is a compile error. Every event passes a PII
 * guard before it reaches a sink: email addresses, phone numbers and GSTINs are never sent, even
 * if a caller slips one into a property by mistake. Later phases add their events below.
 */
import { logger } from '@/core/logger';
import { EMAIL, GSTIN, PHONE } from '@/core/redact';

export { EMAIL, GSTIN, PHONE };

export type SignInMethod = 'password' | 'otp' | 'two_factor';

export interface AnalyticsEvents {
  app_open: { launch_ms: number; cold: boolean };
  update_forced: { installed: string; min_supported: string };
  update_optional_shown: { installed: string; latest: string };
  sign_in_started: { method: SignInMethod };
  sign_in_succeeded: { method: SignInMethod };
  sign_in_failed: { method: SignInMethod; error_code: string };
  otp_requested: { purpose: 'login' | 'register' | 'reset' };
  two_factor_required: { channel: string };
  two_factor_verified: Record<string, never>;
  registration_started: Record<string, never>;
  registration_step_completed: { step: string };
  registration_submitted: { linked: boolean };
  approval_pending_seen: Record<string, never>;
  approval_rejected_seen: Record<string, never>;
  forgot_password_started: Record<string, never>;
  forgot_password_completed: Record<string, never>;
  invitation_opened: { signed_in: boolean };
  invitation_accepted: Record<string, never>;
  view_only_banner_seen: { kyc_status: string };
  verification_sheet_opened: { source: 'tap' | 'refusal' };
  signout: { reason: 'user' | 'expired' | 'role_rejected' };
  language_changed: { language: string };
  theme_changed: { theme: string };
  // Phase 2: no names, messages, ticket text, search text or contact details are ever sent.
  home_viewed: Record<string, never>;
  analytics_viewed: { period: number };
  notification_opened: { category: string };
  notification_marked_all: { category: string };
  preferences_changed: { category: string; channel: string };
  push_permission_result: { result: string };
  ticket_created: { category: string };
  ticket_replied: Record<string, never>;
  ticket_rated: { score: number };
  faq_opened: Record<string, never>;
  faq_helpful: Record<string, never>;
  search_used: { result_count: number };
  info_page_viewed: { slug: string };
  contact_form_sent: Record<string, never>;
  // Phase 3: no names, numbers, GSTINs, documents or contact details are ever sent.
  profile_viewed: Record<string, never>;
  document_upload_started: {
    type: string;
    source: 'scan' | 'gallery' | 'files';
  };
  document_uploaded: { type: string; pages: number; size_bucket: string };
  document_change_requested: Record<string, never>;
  gst_otp_sent: Record<string, never>;
  gst_verified: Record<string, never>;
  gst_manual_submitted: Record<string, never>;
  bank_account_added: { verified: boolean };
  bank_primary_set: Record<string, never>;
  bank_payouts_linked: Record<string, never>;
  team_invited: { role: string };
  team_role_changed: { role: string };
  team_ownership_transferred: Record<string, never>;
  calendar_away_set: Record<string, never>;
  two_factor_enabled: Record<string, never>;
  sessions_revoked_others: Record<string, never>;
  password_changed: Record<string, never>;
  contact_changed: Record<string, never>;
}

export type AnalyticsEventName = keyof AnalyticsEvents;
type Props = Record<string, string | number | boolean | undefined>;

export interface AnalyticsSink {
  track(name: string, props: Props): void;
  /** A screen came into view (the route name only). */
  screen?(name: string): void;
  /** The signed-in account's internal id, or null after sign-out. */
  identify?(userId: string | null): void;
}

const PII_KEYS =
  /email|phone|mobile|gstin|pan|identifier|name|password|code|ticket|token|account|ifsc/i;

/** Drops any property whose name or value could identify a person or business. */
export function scrub(props: Props): Props {
  const clean: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (PII_KEYS.test(key) && !ALLOWED_KEYS.has(key)) continue;
    if (
      typeof value === 'string' &&
      (EMAIL.test(value) || PHONE.test(value) || GSTIN.test(value))
    ) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

/** Property names that match the PII pattern but carry no personal data. */
const ALLOWED_KEYS = new Set<string>(['error_code']);

const devSink: AnalyticsSink = {
  track(name, props) {
    logger.info(`[analytics] ${name}`, props);
  },
};

let sinks: AnalyticsSink[] = [devSink];

/** Calls a sink method on every sink; one sink failing never stops the others. */
function eachSink(call: (sink: AnalyticsSink) => void): void {
  for (const sink of sinks) {
    try {
      call(sink);
    } catch (error) {
      logger.warn('[analytics] sink failed', error);
    }
  }
}

/** A screen came into view. Only the route name is sent, never its params. */
export function trackScreen(name: string): void {
  eachSink(sink => sink.screen?.(name));
}

/** Ties events to the signed-in account by its internal id alone; null after sign-out. */
export function identifyUser(userId: string | null): void {
  eachSink(sink => sink.identify?.(userId));
}

/** Replaces the sinks (start-up adds the production one; tests add a recorder). */
export function setAnalyticsSinks(next: AnalyticsSink[]): void {
  sinks = next;
}

export function track<E extends AnalyticsEventName>(
  name: E,
  props: AnalyticsEvents[E],
): void {
  const clean = scrub(props as Props);
  eachSink(sink => sink.track(name, clean));
}
