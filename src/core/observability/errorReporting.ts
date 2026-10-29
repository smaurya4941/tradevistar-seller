/**
 * Crash and error reporting (Sentry). Unhandled JavaScript errors, unhandled promise rejections
 * and native crashes are captured by the SDK itself; `logger.error` and the app's error boundary
 * add the failures the app catches but cannot recover from.
 *
 * Off unless the build has a `SENTRY_DSN`: without one every function here is a no-op, so
 * development builds and CI never talk to Sentry. Reports carry no personal data: the SDK is told
 * not to send default PII, and `scrubReport` / `scrubBreadcrumb` redact what is left. The only
 * identity attached is the internal user id.
 */
import * as Sentry from '@sentry/react-native';
import { scrubBreadcrumb, scrubReport } from './scrub';

export interface ReporterOptions {
  dsn: string;
  environment: string;
  release: string;
  dist?: string;
}

let enabled = false;

/** Starts the SDK. Safe to call once, as early as possible in app start-up. */
export function startErrorReporting(options: ReporterOptions): boolean {
  if (enabled || !options.dsn) return enabled;
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    dist: options.dist,
    sendDefaultPii: false,
    attachStacktrace: true,
    enableNativeCrashHandling: true,
    // Crashes and errors only: no performance traces, no session replay, no screenshots.
    tracesSampleRate: 0,
    attachScreenshot: false,
    beforeSend: event => scrubReport(event as never) as typeof event,
    beforeBreadcrumb: breadcrumb =>
      scrubBreadcrumb(breadcrumb as never) as typeof breadcrumb,
  });
  enabled = true;
  return true;
}

export function isErrorReportingOn(): boolean {
  return enabled;
}

/** Reports a caught failure. `context` is short, non-personal tags (a feature name, a status). */
export function reportError(
  error: unknown,
  context?: Record<string, string | number | boolean>,
): void {
  if (!enabled) return;
  const withContext = (scope: Sentry.Scope) => {
    if (context) scope.setContext('app', context);
    return scope;
  };
  if (error instanceof Error) {
    Sentry.withScope(scope => {
      withContext(scope);
      Sentry.captureException(error);
    });
  } else {
    Sentry.withScope(scope => {
      withContext(scope);
      Sentry.captureMessage(String(error), 'error');
    });
  }
}

/** Ties reports to the signed-in account by its internal id alone; null on sign-out. */
export function setReportUser(userId: string | null): void {
  if (!enabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/** A trail entry shown with the next report ("opened Checkout"). Never carries personal data. */
export function addTrail(category: string, message: string): void {
  if (!enabled) return;
  Sentry.addBreadcrumb({ category, message, level: 'info' });
}

/** Wraps the root component so touches and render time are part of the trail. */
export function wrapRoot<T extends React.ComponentType<never>>(
  component: T,
): T {
  return enabled
    ? (Sentry.wrap(component as never) as unknown as T)
    : component;
}
