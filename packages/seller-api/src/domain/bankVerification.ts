/**
 * When to ask the bank-verification service, and what a reply means.
 *
 * The IFSC is checked once it has a complete shape (after a short pause in typing), the account once
 * the IFSC is genuine and the buyer has typed the number twice, identically. Every answer is keyed by
 * the exact input it was for, so a reply that arrives after the buyer changed the IFSC or the account
 * number is ignored. These are the rules; the screen's hook applies them.
 */
import type { BankVerificationResult } from "../endpoints/bank";

export type VerificationPhase = "idle" | "verifying" | "verified" | "failed" | "error";

/** The IFSC pattern: four letters, a zero, six letters or digits. */
export const IFSC_VERIFY_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_VERIFY_PATTERN = /^\d{9,18}$/;

/** Pauses after the last keystroke before a lookup is spent. */
export const IFSC_DEBOUNCE_MS = 400;
export const ACCOUNT_DEBOUNCE_MS = 500;

/** Shown when the service cannot be reached; the account can still be saved, unverified. */
export const VERIFICATION_UNAVAILABLE = "Verification service is temporarily unavailable";

export const normalizeVerifyIfsc = (input: string): string => (input ?? "").trim().toUpperCase();

export const isIfscReadyToVerify = (ifsc: string): boolean => IFSC_VERIFY_PATTERN.test(ifsc);

export const normalizeVerifyAccount = (input: string): string => (input ?? "").replace(/\s/g, "");

export const isAccountReadyToVerify = (account: string): boolean => ACCOUNT_VERIFY_PATTERN.test(account);

/**
 * The account to verify: the number, but only once it has been typed twice and matches. A half-typed
 * or unconfirmed number never spends a verification, so this is "" until then.
 */
export function confirmedAccount(accountNumber: string, confirmation: string): string {
  const account = normalizeVerifyAccount(accountNumber);
  return account !== "" && account === normalizeVerifyAccount(confirmation) ? account : "";
}

/** The key an account verdict belongs to; a verdict is used only while the form still matches it. */
export const accountVerificationKey = (ifsc: string, account: string): string => `${ifsc}:${account}`;

/** One answered check, stored with the input it answered. */
export interface VerificationOutcome {
  key: string;
  phase: "verified" | "failed" | "error";
  message: string;
  result: BankVerificationResult | null;
}

/** The phase to show: idle until the input is ready, verifying until the outcome for *this* input arrives. */
export function phaseFor(
  ready: boolean,
  key: string,
  outcome: VerificationOutcome | null,
): VerificationPhase {
  if (!ready) return "idle";
  return outcome?.key === key ? outcome.phase : "verifying";
}

/** An answered check that need not be asked again: same input, and not a failed attempt to reach the service. */
export const isSettled = (outcome: VerificationOutcome | null, key: string): boolean =>
  outcome !== null && outcome.key === key && outcome.phase !== "error";

export function outcomeFromIfsc(ifsc: string, result: BankVerificationResult): VerificationOutcome {
  return {
    key: ifsc,
    phase: result.ifscVerified ? "verified" : "failed",
    message: result.message,
    result,
  };
}

export function outcomeFromAccount(key: string, result: BankVerificationResult): VerificationOutcome {
  return {
    key,
    phase: result.bankAccountVerified ? "verified" : "failed",
    message: result.message,
    result,
  };
}

export const unavailableOutcome = (key: string): VerificationOutcome => ({
  key,
  phase: "error",
  message: VERIFICATION_UNAVAILABLE,
  result: null,
});
