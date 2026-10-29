/** Whether the app is in the foreground, re-rendering when it goes to the background or returns. */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useAppActive(): boolean {
  const [active, setActive] = useState(
    () => (AppState.currentState ?? 'active') === 'active',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
}
