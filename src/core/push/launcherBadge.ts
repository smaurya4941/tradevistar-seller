/**
 * The number on the app's launcher icon: the seller's unread notification total, capped at 99.
 *
 * Android has no API to set it directly. Launchers that support numbers (Samsung, some Xiaomi,
 * Oppo and Vivo builds, Nova…) read `badgeCount` from the notifications the app is showing, so
 * every displayed alert carries the latest known total. iOS reads `setBadgeCount`. When the count
 * drops to zero in the app, the shown notifications are cleared so the dot disappears too.
 */
import notifee from '@notifee/react-native';
import { launcherCount } from '@tradevistar/seller-api';
import { Platform } from 'react-native';
import { logger } from '@/core/logger';
import { deviceStorage, DeviceKeys } from '@/core/storage/kv';

export function lastLauncherCount(): number {
  return deviceStorage.getNumber(DeviceKeys.launcherBadge) ?? 0;
}

/** Called whenever the in-app unread total changes. */
export async function syncLauncherBadge(total: number): Promise<void> {
  const count = launcherCount(total);
  const previous = lastLauncherCount();
  deviceStorage.set(DeviceKeys.launcherBadge, count);
  try {
    if (Platform.OS === 'ios') {
      await notifee.setBadgeCount(count);
    } else if (count === 0 && previous > 0) {
      // Everything was read in the app: the shown notifications are stale.
      await notifee.cancelDisplayedNotifications();
    }
  } catch (error) {
    logger.info('[push] launcher badge unavailable', error);
  }
}

/** Sign-out: no number, and nothing about the previous account left in the shade. */
export async function clearPushPresentation(): Promise<void> {
  deviceStorage.set(DeviceKeys.launcherBadge, 0);
  try {
    await notifee.cancelAllNotifications();
    if (Platform.OS === 'ios') await notifee.setBadgeCount(0);
  } catch (error) {
    logger.info('[push] clearing notifications failed', error);
  }
}
