/**
 * The auth context: the session engine plus the OTP, two-factor and registration calls, with the
 * analytics each one reports. Screens call this and never the API directly.
 *
 * Two-factor is navigation, not a promise held open under a dialog: `signIn` returns an outcome,
 * and a challenge is parked in memory (twoFactorChallenge.ts) while the TwoFactor screen is shown.
 */
import {
  ApiError,
  registerSeller as registerSellerRequest,
  requestOtp,
  forgotPassword as forgotPasswordRequest,
  resetPassword as resetPasswordRequest,
  type CodeTiming,
  type SellerRegistrationInput,
  type SellerRegistrationResult,
} from '@tradevistar/seller-api';
import React, { createContext, useContext, useMemo } from 'react';
import { track, type SignInMethod } from '@/core/analytics/analytics';
import { useSessionEngine } from '@/core/auth/SessionProvider';
import type { SignInOutcome } from '@/core/auth/sessionEngine';
import {
  clearTwoFactorChallenge,
  holdTwoFactorChallenge,
  twoFactorChallengeStore,
} from './twoFactorChallenge';

export interface AuthContextValue {
  signIn(
    identifier: string,
    password: string,
    rememberMe: boolean,
  ): Promise<SignInOutcome>;
  requestLoginOtp(identifier: string): Promise<void>;
  signInWithOtp(
    identifier: string,
    code: string,
    rememberMe: boolean,
  ): Promise<SignInOutcome>;
  /** Completes the parked challenge. */
  verifyTwoFactor(code: string): Promise<SignInOutcome>;
  resendTwoFactor(): Promise<CodeTiming>;
  /** Cancel: back to sign-in, the challenge is discarded. */
  cancelTwoFactor(): void;
  requestForgotPassword(identifier: string): Promise<void>;
  resetPassword(
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<void>;
  registerSeller(
    input: SellerRegistrationInput,
    idempotencyKey?: string,
  ): Promise<SellerRegistrationResult>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function errorCodeOf(error: unknown): string {
  return error instanceof ApiError ? error.code : 'UNKNOWN';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const engine = useSessionEngine();

  const value = useMemo<AuthContextValue>(() => {
    /** Runs one sign-in call and reports it; the outcome decides what the screen does next. */
    const run = async (
      method: SignInMethod,
      identifier: string,
      call: () => Promise<SignInOutcome>,
    ): Promise<SignInOutcome> => {
      track('sign_in_started', { method });
      try {
        const outcome = await call();
        if (outcome.kind === 'twoFactorRequired') {
          holdTwoFactorChallenge(outcome.challenge, identifier);
          track('two_factor_required', {
            channel: outcome.challenge.channel.toLowerCase(),
          });
        } else if (outcome.kind === 'approval') {
          // The approval screen reports it was seen; nothing from this attempt is kept.
          clearTwoFactorChallenge();
        } else {
          clearTwoFactorChallenge();
          track('sign_in_succeeded', { method });
        }
        return outcome;
      } catch (error) {
        track('sign_in_failed', { method, error_code: errorCodeOf(error) });
        throw error;
      }
    };

    return {
      signIn: (identifier, password, rememberMe) =>
        run('password', identifier, () =>
          engine.signInWithPassword(identifier, password, rememberMe),
        ),
      requestLoginOtp: async identifier => {
        await requestOtp(identifier, 'LOGIN');
        track('otp_requested', { purpose: 'login' });
      },
      signInWithOtp: (identifier, code, rememberMe) =>
        run('otp', identifier, () =>
          engine.signInWithOtp(identifier, code, rememberMe),
        ),
      verifyTwoFactor: async code => {
        const held = twoFactorChallengeStore.get();
        if (!held) {
          throw new ApiError(401, {
            code: 'TWO_FACTOR_EXPIRED',
            message: 'Your sign-in took too long. Start again.',
          });
        }
        const outcome = await run('two_factor', held.identifier, () =>
          engine.verifyTwoFactor(held.challenge.challengeToken, code),
        );
        if (outcome.kind === 'signedIn') track('two_factor_verified', {});
        return outcome;
      },
      resendTwoFactor: () => {
        const held = twoFactorChallengeStore.get();
        if (!held) {
          return Promise.reject(
            new ApiError(401, {
              code: 'TWO_FACTOR_EXPIRED',
              message: 'Your sign-in took too long. Start again.',
            }),
          );
        }
        return engine.resendTwoFactor(held.challenge.challengeToken);
      },
      cancelTwoFactor: clearTwoFactorChallenge,
      requestForgotPassword: async identifier => {
        await forgotPasswordRequest(identifier);
        track('otp_requested', { purpose: 'reset' });
      },
      resetPassword: async (identifier, code, newPassword) => {
        await resetPasswordRequest(identifier, code, newPassword);
        track('forgot_password_completed', {});
      },
      registerSeller: async (input, idempotencyKey) => {
        const result = await registerSellerRequest(input, idempotencyKey);
        track('registration_submitted', {
          linked: result.linkedExistingAccount,
        });
        return result;
      },
      signOut: () => engine.signOut(),
    };
  }, [engine]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
