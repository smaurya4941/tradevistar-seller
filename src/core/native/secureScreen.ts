/**
 * FLAG_SECURE for sensitive screens (sign-in, codes, passwords, reset, registration): no
 * screenshots, no screen recording, and a blank thumbnail in Recents.
 *
 * Reference-counted, so overlapping screens (the sign-in sheet and a code screen inside it) turn
 * the flag on once and off only when the last one leaves.
 */
import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import { logger } from '@/core/logger';

interface SecureScreenNative {
  setSecure(secure: boolean): void;
}

const native: SecureScreenNative | undefined = NativeModules.TVSecureScreen;

let holders = 0;

function apply(secure: boolean): void {
  if (Platform.OS !== 'android') return;
  if (!native) {
    if (__DEV__) logger.warn('[secure] TVSecureScreen native module missing');
    return;
  }
  native.setSecure(secure);
}

export function acquireSecureScreen(): () => void {
  holders += 1;
  if (holders === 1) apply(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) apply(false);
  };
}

/** Marks the calling screen as secure while it is mounted. */
export function useSecureScreen(): void {
  useEffect(() => acquireSecureScreen(), []);
}

/** Test-only. */
export function secureScreenHolders(): number {
  return holders;
}
