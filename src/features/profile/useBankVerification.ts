/**
 * Inline bank-details verification for the add-account form (settlement account).
 *
 * The rules (when to ask, what an answer means) are the shared `bankVerification` domain's; this
 * hook runs them against the backend (`POST /bank-verification/verify`). The IFSC is checked once it
 * has a complete shape and the seller pauses typing; the account once the IFSC is genuine and the
 * number has been typed twice, identically. Every answer is stored with the exact input it was for,
 * so a reply that arrives after the seller changed the IFSC or the account number is ignored, and an
 * in-flight request is cancelled the moment the input changes.
 *
 * The full account number is only ever held in memory here and sent to the verification route —
 * never logged, stored or sent to analytics.
 */
import {
  ACCOUNT_DEBOUNCE_MS,
  accountVerificationKey,
  IFSC_DEBOUNCE_MS,
  isAccountReadyToVerify,
  isIfscReadyToVerify,
  isSettled,
  normalizeVerifyAccount,
  normalizeVerifyIfsc,
  outcomeFromAccount,
  outcomeFromIfsc,
  phaseFor,
  unavailableOutcome,
  verifyBankDetails,
  type BankVerificationResult,
  type VerificationOutcome,
  type VerificationPhase,
} from '@tradevistar/seller-api';
import { useEffect, useRef, useState } from 'react';

export interface BankVerification {
  ifscPhase: VerificationPhase;
  ifscMessage: string;
  accountPhase: VerificationPhase;
  accountMessage: string;
  /** Only ever the token for the IFSC and account currently in the form. */
  verificationToken: string | null;
  /** A check is running, so saving should wait for its answer. */
  verifying: boolean;
}

/**
 * @param ifscInput the IFSC as typed.
 * @param accountNumber pass "" until the number is final (typed twice and matching), so a
 *   half-typed number never spends a verification.
 * @param onIfscVerified fills the bank name and branch from the provider's record.
 */
export function useBankVerification(
  ifscInput: string,
  accountNumber: string,
  onIfscVerified?: (result: BankVerificationResult) => void,
): BankVerification {
  const ifsc = normalizeVerifyIfsc(ifscInput);
  const ifscReady = isIfscReadyToVerify(ifsc);
  const [ifscOutcome, setIfscOutcome] = useState<VerificationOutcome | null>(
    null,
  );
  const [accountOutcome, setAccountOutcome] =
    useState<VerificationOutcome | null>(null);
  const onVerified = useRef(onIfscVerified);
  const settledIfsc = useRef<VerificationOutcome | null>(null);
  const settledAccount = useRef<VerificationOutcome | null>(null);

  useEffect(() => {
    onVerified.current = onIfscVerified;
  }, [onIfscVerified]);

  // ── The IFSC ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ifscReady) return;
    // The same IFSC already answered in this form: nothing to ask again.
    if (isSettled(settledIfsc.current, ifsc)) return;

    const controller = new AbortController();
    const settle = (outcome: VerificationOutcome) => {
      if (controller.signal.aborted) return;
      settledIfsc.current = outcome;
      setIfscOutcome(outcome);
    };
    const timer = setTimeout(() => {
      verifyBankDetails({ ifsc }, controller.signal)
        .then(result => {
          if (result.ifscVerified && !controller.signal.aborted) {
            onVerified.current?.(result);
          }
          settle(outcomeFromIfsc(ifsc, result));
        })
        .catch(() => settle(unavailableOutcome(ifsc)));
    }, IFSC_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ifsc, ifscReady]);

  const ifscPhase = phaseFor(ifscReady, ifsc, ifscOutcome);

  // ── The account ───────────────────────────────────────────────────────────
  const account = normalizeVerifyAccount(accountNumber);
  const accountKey = accountVerificationKey(ifsc, account);
  const accountReady =
    ifscPhase === 'verified' && isAccountReadyToVerify(account);

  useEffect(() => {
    if (!accountReady) return;
    if (isSettled(settledAccount.current, accountKey)) return;

    const controller = new AbortController();
    const settle = (outcome: VerificationOutcome) => {
      if (controller.signal.aborted) return;
      settledAccount.current = outcome;
      setAccountOutcome(outcome);
    };
    const timer = setTimeout(() => {
      verifyBankDetails({ ifsc, accountNumber: account }, controller.signal)
        .then(result => settle(outcomeFromAccount(accountKey, result)))
        .catch(() => settle(unavailableOutcome(accountKey)));
    }, ACCOUNT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [accountKey, accountReady, ifsc, account]);

  const accountCurrent =
    accountReady && accountOutcome?.key === accountKey ? accountOutcome : null;
  const accountPhase = phaseFor(accountReady, accountKey, accountCurrent);

  return {
    ifscPhase,
    ifscMessage: ifscOutcome?.key === ifsc ? ifscOutcome.message : '',
    accountPhase,
    accountMessage: accountCurrent?.message ?? '',
    verificationToken: accountCurrent?.result?.verificationToken ?? null,
    verifying: ifscPhase === 'verifying' || accountPhase === 'verifying',
  };
}
