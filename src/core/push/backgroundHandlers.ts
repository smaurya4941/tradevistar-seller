/**
 * Handlers that must be registered at module load, outside React, so Android can run them in a
 * headless JS task while the app is in the background. Imported from index.js.
 *
 * Only the tap on a system notification needs one today: the app raises its own alerts while it
 * is alive, and there is no server push (gap 3) to deliver a message to a killed app.
 */
import notifee, { EventType } from '@notifee/react-native';
import type { AlertData } from './alertPayload';
import { openFromAlert } from './localAlerts';

export function registerBackgroundHandlers(): void {
  // A tap while backgrounded: the route is held and delivered once navigation is ready.
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      openFromAlert(detail.notification?.data as AlertData | undefined);
    }
  });
}
