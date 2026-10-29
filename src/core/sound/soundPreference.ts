/**
 * Whether new notifications play the platform sound while the app is open. On by default; the
 * seller can turn it off in Settings. Kept on the device (it survives sign-out, like the
 * language) and observable, so the switch and the sound effect agree the moment it changes.
 */
import { createStore, useStore } from '@/core/store';
import { deviceStorage, DeviceKeys } from '@/core/storage/kv';

function stored(): boolean {
  try {
    return deviceStorage.getBoolean(DeviceKeys.notificationSound) ?? true;
  } catch {
    return true;
  }
}

export const notificationSoundStore = createStore<boolean>(stored());

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    deviceStorage.set(DeviceKeys.notificationSound, enabled);
  } catch {
    // The choice still holds for this session; it just is not remembered.
  }
  notificationSoundStore.set(enabled);
}

export function useNotificationSoundEnabled(): boolean {
  return useStore(notificationSoundStore);
}
