/**
 * What may leave the phone in a crash report or a log line. Nothing that could identify a person
 * or a business — email addresses, phone numbers, GSTIN and PAN values, bank account numbers,
 * tokens, passwords, one-time codes — and nothing that carries a session. Sentry is also told not
 * to send default PII, so this is the second lock on the same door.
 *
 * Kept free of the Sentry SDK (events are plain objects here) so it is tested without a device.
 */
import { isSensitiveKey, redactText, REDACTED } from '@/core/redact';

export { isSensitiveKey, redactText, REDACTED };

/** A URL without its query string or fragment (queries carry search terms and ids). */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactText(value);
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => scrubValue(item, depth + 1));
  }
  const clean: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    clean[key] = isSensitiveKey(key) ? REDACTED : scrubValue(inner, depth + 1);
  }
  return clean;
}

export interface ReportEvent {
  message?: string;
  user?: { id?: string; [key: string]: unknown };
  request?: {
    url?: string;
    headers?: Record<string, unknown>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
  };
  exception?: { values?: { value?: string }[] };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: ReportBreadcrumb[];
  tags?: Record<string, unknown>;
}

export interface ReportBreadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

/** A breadcrumb with free text redacted and any URL cut down to its path. */
export function scrubBreadcrumb<T extends ReportBreadcrumb>(crumb: T): T {
  const next: T = { ...crumb };
  if (next.message) next.message = redactText(next.message);
  if (next.data) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next.data)) {
      if (isSensitiveKey(key)) {
        data[key] = REDACTED;
      } else if (key === 'url' && typeof value === 'string') {
        data[key] = stripQuery(value);
      } else {
        data[key] = scrubValue(value);
      }
    }
    next.data = data;
  }
  return next;
}

/** The report with the user cut down to an id, requests to a bare URL, and free text redacted. */
export function scrubReport<T extends ReportEvent>(event: T): T {
  const next: T = { ...event };
  if (next.message) next.message = redactText(next.message);
  if (next.user) next.user = next.user.id ? { id: next.user.id } : undefined;
  if (next.request) {
    next.request = {
      url: next.request.url ? stripQuery(next.request.url) : undefined,
    };
  }
  if (next.exception?.values) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map(item => ({
        ...item,
        value: item.value ? redactText(item.value) : item.value,
      })),
    };
  }
  if (next.extra) {
    next.extra = scrubValue(next.extra) as Record<string, unknown>;
  }
  if (next.contexts) {
    next.contexts = scrubValue(next.contexts) as Record<string, unknown>;
  }
  if (next.breadcrumbs) {
    next.breadcrumbs = next.breadcrumbs.map(scrubBreadcrumb);
  }
  return next;
}
