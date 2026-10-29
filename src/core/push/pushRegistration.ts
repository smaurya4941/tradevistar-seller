/**
 * Device registration for server push, kept dormant until the API has a route for it.
 *
 * Registration talks to `POST /me/devices`. Until the API ships that route it answers 404, which
 * is recorded as `unsupported` for a day (so no launch calls a missing endpoint) — the rest of
 * the notification work (badges, banners, local alerts) does not depend on it, and registration
 * starts working with no app change once the route is deployed.
 */
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import {
  ApiError,
  registerPushDevice,
  unregisterPushDevice,
  type AuthUser,
} from '@tradevistar/seller-api';
import { Platform } from 'react-native';
import {
  appVersion,
  deviceLabel,
  deviceLocale,
} from '@/core/device/deviceInfo';
import { logger } from '@/core/logger';
import { deviceStorage, DeviceKeys } from '@/core/storage/kv';
import { createStore } from '@/core/store';
import { isFirebaseConfigured } from './firebase';
import { getPushPermission } from './permission';
import {
  isUnsupportedStatus,
  shouldAttemptRegistration,
} from './registrationRules';

export type RegistrationState =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'unsupported'
  | 'error';

export interface PushStatus {
  firebaseConfigured: boolean;
  token: string | null;
  registration: RegistrationState;
  lastError: string | null;
}

export const pushStatusStore = createStore<PushStatus>({
  firebaseConfigured: false,
  token: null,
  registration: 'idle',
  lastError: null,
});

function update(patch: Partial<PushStatus>): void {
  pushStatusStore.set(previous => ({ ...previous, ...patch }));
}

let registeredUserId: string | null = null;
let stopTokenRefresh: (() => void) | null = null;

async function sendRegistration(token: string): Promise<void> {
  update({ registration: 'registering', lastError: null });
  try {
    await registerPushDevice({
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      appVersion,
      deviceName: deviceLabel(),
      locale: deviceLocale(),
    });
    deviceStorage.set(DeviceKeys.lastPushToken, token);
    deviceStorage.remove(DeviceKeys.pushUnsupportedAt);
    update({ registration: 'registered' });
  } catch (error) {
    if (error instanceof ApiError && isUnsupportedStatus(error.statusCode)) {
      deviceStorage.set(DeviceKeys.pushUnsupportedAt, Date.now());
      update({
        registration: 'unsupported',
        lastError: 'The API does not accept push devices yet.',
      });
      return;
    }
    update({
      registration: 'error',
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Registers this device for the signed-in seller. Runs after sign-in and restore; skipped quietly
 * when Firebase is not configured, notifications are not allowed, or the API said a day ago that
 * it has no such route.
 */
export async function registerForPush(user: AuthUser): Promise<void> {
  const configured = isFirebaseConfigured();
  update({ firebaseConfigured: configured });
  if (!configured) return;
  if ((await getPushPermission()) !== 'granted') return;
  if (
    !shouldAttemptRegistration(
      deviceStorage.getNumber(DeviceKeys.pushUnsupportedAt),
    )
  ) {
    update({ registration: 'unsupported' });
    return;
  }

  const messaging = getMessaging();
  const token = await getToken(messaging);
  update({ token });
  registeredUserId = user.id;
  await sendRegistration(token);

  stopTokenRefresh?.();
  stopTokenRefresh = onTokenRefresh(messaging, next => {
    update({ token: next });
    if (registeredUserId) {
      sendRegistration(next).catch(error =>
        logger.warn('[push] re-registration failed', error),
      );
    }
  });
}

/** Called before logout, while the access token is still valid, so the server stops sending. */
export async function unregisterFromPush(): Promise<void> {
  stopTokenRefresh?.();
  stopTokenRefresh = null;
  registeredUserId = null;
  const token =
    pushStatusStore.get().token ??
    deviceStorage.getString(DeviceKeys.lastPushToken);
  const wasRegistered = pushStatusStore.get().registration === 'registered';
  update({ registration: 'idle' });
  if (!token || !wasRegistered) return;
  try {
    await unregisterPushDevice(token);
  } catch (error) {
    if (!(error instanceof ApiError && isUnsupportedStatus(error.statusCode))) {
      throw error;
    }
  }
}
