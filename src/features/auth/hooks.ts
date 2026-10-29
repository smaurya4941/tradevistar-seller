/**
 * Small timers the sign-in screens share: the resend countdown and the rate-limit cooldown.
 */
import { useCallback, useEffect, useState } from 'react';

/** Seconds left of a countdown; `start(n)` restarts it. */
export function useCountdown(initialSeconds = 0): {
  seconds: number;
  start: (seconds: number) => void;
} {
  const [endsAt, setEndsAt] = useState(() =>
    initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), 250);
    return () => clearTimeout(timer);
  }, [endsAt, now]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * 1000);
  }, []);

  // Wall-clock based, so time spent in the background still counts.
  return { seconds: Math.max(0, Math.ceil((endsAt - now) / 1000)), start };
}

/** The API's throttles are per minute; a 429 disables the action for this long. */
export const RATE_LIMIT_COOLDOWN_S = 60;
