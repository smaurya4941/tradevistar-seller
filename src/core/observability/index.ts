/**
 * Start-up wiring for analytics and crash reporting, and the two small hooks the app calls.
 *
 * `initObservability()` runs first thing in `index.js`: it starts crash reporting when the build
 * has a Sentry DSN, points the analytics events at Google Analytics 4 when the build collects
 * analytics, and sends `logger.error` to crash reporting. In development the events stay in the
 * console log only.
 */
import { useCallback, useRef } from 'react';
import DeviceInfo from 'react-native-device-info';
import { env } from '@/config/env';
import {
  identifyUser,
  setAnalyticsSinks,
  trackScreen,
  type AnalyticsSink,
} from '@/core/analytics/analytics';
import { logger, setLoggerHook } from '@/core/logger';
import {
  isErrorReportingOn,
  reportError,
  setReportUser,
  startErrorReporting,
} from './errorReporting';
import { createFirebaseSink, setAnalyticsCollection } from './firebaseSink';

const devSink: AnalyticsSink = {
  track(name, props) {
    logger.info(`[analytics] ${name}`, props);
  },
  screen(name) {
    logger.info(`[analytics] screen ${name}`);
  },
};

let started = false;

export function initObservability(): void {
  if (started) return;
  started = true;

  if (env.sentryDsn) {
    try {
      startErrorReporting({
        dsn: env.sentryDsn,
        environment: env.appEnv,
        release: `${DeviceInfo.getBundleId()}@${DeviceInfo.getVersion()}+${DeviceInfo.getBuildNumber()}`,
        dist: DeviceInfo.getBuildNumber(),
      });
      setLoggerHook((message, detail) =>
        reportError(detail instanceof Error ? detail : new Error(message), {
          source: 'logger',
          message,
        }),
      );
    } catch (error) {
      // Crash reporting failing to start must not stop the app from starting.
      logger.warn('[observability] crash reporting did not start', error);
    }
  }

  const sinks: AnalyticsSink[] = [devSink];
  if (env.analyticsEnabled) {
    try {
      sinks.push(createFirebaseSink());
      void setAnalyticsCollection(true);
    } catch (error) {
      logger.warn('[observability] analytics did not start', error);
    }
  } else {
    void setAnalyticsCollection(false);
  }
  setAnalyticsSinks(sinks);
}

/** Ties analytics and crash reports to the signed-in account by its internal id; null signs out. */
export function setObservedUser(userId: string | null): void {
  identifyUser(userId);
  setReportUser(userId);
}

export { isErrorReportingOn, reportError };

/**
 * Screen views for analytics, as the web sends a page view per route: pass the result as the
 * navigation container's `onStateChange`. Sends the route name only — never params, which hold ids
 * and search text — and only when the screen actually changed.
 */
export function useScreenTracking(
  currentRoute: () => { name: string } | undefined,
): () => void {
  const last = useRef<string | undefined>(undefined);
  return useCallback(() => {
    const name = currentRoute()?.name;
    if (!name || name === last.current) return;
    last.current = name;
    trackScreen(name);
  }, [currentRoute]);
}
