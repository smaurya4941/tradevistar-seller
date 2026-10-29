/**
 * Google Analytics 4 through Firebase Analytics: the production sink for the app's typed events,
 * the counterpart of the web's GA4 page views. Every event has already been through the PII scrub
 * in `track()`; this only translates it into GA4's naming and size rules (see `gaEvents`).
 *
 * Collection is off unless the build asks for it (`ANALYTICS_ENABLED`, on by default outside
 * development) and needs the flavor's `google-services.json`: without that file Firebase has no
 * default app and every call here quietly does nothing.
 */
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setAnalyticsCollectionEnabled,
  setUserId,
} from '@react-native-firebase/analytics';
import type { AnalyticsSink } from '@/core/analytics/analytics';
import { logger } from '@/core/logger';
import { isFirebaseConfigured } from '@/core/observability/firebase';
import { gaEventName, gaParams } from './gaEvents';

/** Fire and forget: analytics must never slow or break the screen that sent the event. */
function quietly(label: string, work: () => unknown): void {
  if (!isFirebaseConfigured()) return;
  try {
    const result = work();
    if (result instanceof Promise) {
      result.catch(error => logger.info(`[analytics] ${label} failed`, error));
    }
  } catch (error) {
    logger.info(`[analytics] ${label} failed`, error);
  }
}

export function createFirebaseSink(): AnalyticsSink {
  return {
    track(name, props) {
      quietly(name, () =>
        logEvent(getAnalytics(), gaEventName(name), gaParams(props)),
      );
    },
    screen(name) {
      quietly('screen_view', () =>
        logScreenView(getAnalytics(), {
          screen_name: name,
          screen_class: name,
        }),
      );
    },
    identify(userId) {
      quietly('set user', () => setUserId(getAnalytics(), userId));
    },
  };
}

/** Turns collection on or off for this install (the build flag; a privacy switch could use it). */
export async function setAnalyticsCollection(on: boolean): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    await setAnalyticsCollectionEnabled(getAnalytics(), on);
  } catch (error) {
    logger.info('[analytics] could not change collection', error);
  }
}
