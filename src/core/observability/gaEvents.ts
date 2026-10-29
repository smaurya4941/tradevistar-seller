/**
 * Turning the app's typed events into what Google Analytics 4 (Firebase Analytics) accepts.
 *
 * GA4 limits: an event name is 1–40 characters of letters, digits and underscores starting with a
 * letter; a parameter name the same; a text value up to 100 characters; up to 25 parameters; and
 * a short list of names (and the `firebase_`, `google_` and `ga_` prefixes) is reserved for
 * Google. Values are numbers or text, so a boolean is sent as "true" / "false".
 *
 * The properties reaching here have already been through the PII scrub in `track()`.
 */

/** Names Google reserves; logging one is silently dropped, so ours get a `tv_` prefix. */
export const GA_RESERVED_EVENTS: ReadonlySet<string> = new Set([
  'ad_activeview',
  'ad_click',
  'ad_exposure',
  'ad_impression',
  'ad_query',
  'adunit_exposure',
  'app_clear_data',
  'app_exception',
  'app_install',
  'app_remove',
  'app_store_refund',
  'app_store_subscription_cancel',
  'app_store_subscription_convert',
  'app_store_subscription_renew',
  'app_update',
  'dynamic_link_app_open',
  'dynamic_link_app_update',
  'dynamic_link_first_open',
  'error',
  'first_open',
  'first_visit',
  'in_app_purchase',
  'notification_dismiss',
  'notification_foreground',
  'notification_open',
  'notification_receive',
  'os_update',
  'screen_view',
  'session_start',
  'user_engagement',
]);

const RESERVED_PREFIX = /^(firebase_|google_|ga_)/;
const MAX_NAME = 40;
const MAX_VALUE = 100;
const MAX_PARAMS = 25;

function cleanName(raw: string): string {
  let name = raw.replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z]/.test(name)) name = `tv_${name}`;
  return name;
}

/** The GA4 event name for one of ours: valid characters, not reserved, at most 40 long. */
export function gaEventName(name: string): string {
  let result = cleanName(name);
  if (GA_RESERVED_EVENTS.has(result) || RESERVED_PREFIX.test(result)) {
    result = `tv_${result}`;
  }
  return result.slice(0, MAX_NAME);
}

export type GaParams = Record<string, string | number>;

/** The GA4 parameters for an event's properties. */
export function gaParams(
  props: Record<string, string | number | boolean | undefined>,
): GaParams {
  const params: GaParams = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (Object.keys(params).length >= MAX_PARAMS) break;
    let name = cleanName(key);
    if (RESERVED_PREFIX.test(name)) name = `tv_${name}`;
    name = name.slice(0, MAX_NAME);
    if (typeof value === 'number') {
      if (Number.isFinite(value)) params[name] = value;
    } else if (typeof value === 'boolean') {
      params[name] = value ? 'true' : 'false';
    } else {
      params[name] = String(value).slice(0, MAX_VALUE);
    }
  }
  return params;
}
