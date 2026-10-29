/**
 * Exposes the session engine to React and wires it to the app lifecycle: launch restore,
 * foreground refresh and server-ended sessions.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';
import type { SessionEngine, SessionState } from './sessionEngine';
import { onSessionEnded } from '@/core/api/apiClient';

const SessionContext = createContext<SessionEngine | null>(null);

export function SessionProvider({
  engine,
  children,
}: {
  engine: SessionEngine;
  children: React.ReactNode;
}) {
  useEffect(() => {
    void engine.start();
    const stopEnded = onSessionEnded((reason, detail) => {
      void engine.onSessionEnded(reason, detail);
    });
    let previous: string = AppState.currentState ?? 'active';
    const subscription = AppState.addEventListener('change', next => {
      if (previous.match(/inactive|background/) && next === 'active') {
        void engine.onForeground();
      }
      previous = next;
    });
    return () => {
      stopEnded();
      subscription.remove();
    };
  }, [engine]);

  return (
    <SessionContext.Provider value={engine}>{children}</SessionContext.Provider>
  );
}

export function useSessionEngine(): SessionEngine {
  const engine = useContext(SessionContext);
  if (!engine) {
    throw new Error('useSessionEngine must be used inside <SessionProvider>');
  }
  return engine;
}

export function useSession(): SessionState {
  const engine = useSessionEngine();
  const subscribe = useMemo(
    () => (listener: () => void) => engine.subscribe(listener),
    [engine],
  );
  return useSyncExternalStore(subscribe, () => engine.getState());
}
