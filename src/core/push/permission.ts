/**
 * Notification permission.
 *
 * Android 13+ requires the runtime POST_NOTIFICATIONS permission; older versions grant it at
 * install. The system prompt can be shown only a couple of times before Android stops asking, so
 * the app always shows its own explanation first (PushExplainerSheet) and asks only when the
 * seller turns Push on or taps "Turn on" in the Inbox card.
 */
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import { deviceStorage, DeviceKeys } from '@/core/storage/kv';

export type PushPermission = 'granted' | 'denied' | 'blocked' | 'undetermined';

const needsRuntimePermission =
  Platform.OS === 'android' && Number(Platform.Version) >= 33;

export async function getPushPermission(): Promise<PushPermission> {
  if (needsRuntimePermission) {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted) return 'granted';
    return (
      (deviceStorage.getString(DeviceKeys.pushPermission) as
        | PushPermission
        | undefined) ?? 'undetermined'
    );
  }
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus === AuthorizationStatus.DENIED
    ? 'blocked'
    : 'granted';
}

/** Shows the system prompt. Call only after the seller accepted the in-app explanation. */
export async function requestPushPermission(): Promise<PushPermission> {
  let result: PushPermission;
  if (needsRuntimePermission) {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    result =
      status === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'blocked'
        : 'denied';
  } else {
    const settings = await notifee.requestPermission();
    result =
      settings.authorizationStatus === AuthorizationStatus.DENIED
        ? 'blocked'
        : 'granted';
  }
  deviceStorage.set(DeviceKeys.pushPermission, result);
  return result;
}

/** Once blocked, only the system settings can re-enable notifications. */
export function openNotificationSettings(): Promise<void> {
  return notifee.openNotificationSettings();
}

export function hasSeenPushExplainer(): boolean {
  return deviceStorage.getBoolean(DeviceKeys.pushExplainerSeen) === true;
}

export function markPushExplainerSeen(): void {
  deviceStorage.set(DeviceKeys.pushExplainerSeen, true);
}
