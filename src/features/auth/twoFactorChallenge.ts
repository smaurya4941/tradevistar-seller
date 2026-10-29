/**
 * The two-factor challenge between "password accepted" and "code entered".
 *
 * It lives in memory only and is never a navigation parameter, so the challenge token cannot reach
 * a saved navigation state, a log line or a crash report. Cancelling (or finishing) discards it.
 */
import type { TwoFactorChallenge } from '@tradevistar/seller-api';
import { createStore, useStore } from '@/core/store';

export interface HeldChallenge {
  challenge: TwoFactorChallenge;
  /** Device clock when the challenge arrived; the 10-minute life is counted from here. */
  receivedAt: number;
  /** The identifier the seller signed in with, so "start again" can prefill it. */
  identifier: string;
}

export const twoFactorChallengeStore = createStore<HeldChallenge | null>(null);

export function holdTwoFactorChallenge(
  challenge: TwoFactorChallenge,
  identifier: string,
): void {
  twoFactorChallengeStore.set({
    challenge,
    receivedAt: Date.now(),
    identifier,
  });
}

export function clearTwoFactorChallenge(): void {
  twoFactorChallengeStore.set(null);
}

export function useHeldChallenge(): HeldChallenge | null {
  return useStore(twoFactorChallengeStore);
}
