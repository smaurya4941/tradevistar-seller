/** True while the device reports no connection; for disabling writes with a clear reason. */
import { useNetInfo } from '@react-native-community/netinfo';
import { isOffline } from './connectivity';

export function useIsOffline(): boolean {
  return isOffline(useNetInfo());
}
