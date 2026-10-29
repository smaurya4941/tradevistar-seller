/**
 * Whether the phone is in silent or vibrate mode (Android `AudioManager.ringerMode`), so the
 * in-app notification sound can respect it. Unavailable (iOS, tests) reads as "not silent".
 */
import { NativeModules, Platform } from 'react-native';

interface RingerModeNative {
  isSilent(): Promise<boolean>;
}

const native: RingerModeNative | undefined =
  Platform.OS === 'android' ? NativeModules.TVRingerMode : undefined;

export async function isPhoneSilent(): Promise<boolean> {
  if (!native) return false;
  try {
    return Boolean(await native.isSilent());
  } catch {
    return false;
  }
}
