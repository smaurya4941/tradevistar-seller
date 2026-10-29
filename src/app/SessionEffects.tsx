/**
 * Side effects that follow the session:
 * - analytics and crash reports are tied to the signed-in account by its internal id alone;
 * - a session that could not be restored for lack of network is retried the moment the
 *   connection returns (only an explicit 401 from refresh ever signs the seller out).
 */
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { refreshAppConfigIfStale } from '@/core/appConfig/appConfigStore';
import { useSession, useSessionEngine } from '@/core/auth/SessionProvider';
import { isOffline } from '@/core/network/connectivity';
import { setObservedUser } from '@/core/observability';

export function SessionEffects(): null {
  const engine = useSessionEngine();
  const session = useSession();
  const userId = session.status === 'signedIn' ? session.user.id : null;

  useEffect(() => {
    setObservedUser(userId);
  }, [userId]);

  useEffect(() => {
    let wasOffline = false;
    return NetInfo.addEventListener(state => {
      const offline = isOffline(state);
      if (wasOffline && !offline) {
        if (engine.getState().status === 'offline') void engine.retry();
        refreshAppConfigIfStale();
      }
      wasOffline = offline;
    });
  }, [engine]);

  return null;
}
