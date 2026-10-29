/**
 * Whether Firebase is configured in this build. Without google-services.json for the flavor, the
 * native default app is never created and every messaging call would throw; the app checks here
 * first and reports "not configured" instead.
 */
import { getApps } from '@react-native-firebase/app';

export function isFirebaseConfigured(): boolean {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
}
