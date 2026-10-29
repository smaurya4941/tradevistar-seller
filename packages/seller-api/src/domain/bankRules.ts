/**
 * Settlement bank account rules: the add-account form checks, which actions a card offers, and the
 * words for the backend's bank error codes. The live IFSC / account check itself is in
 * `bankVerification.ts`.
 */
import { validateIfsc } from "./countryRules";
import type { BankAccountType, BankAccountView } from "../endpoints/bank";
import { ACCOUNT_VERIFY_PATTERN } from "./bankVerification";

export const BANK_LIMITS = { holderMin: 2, holderMax: 150, accountMin: 9, accountMax: 18 } as const;

export const BANK_ACCOUNT_TYPES: readonly BankAccountType[] = ["CURRENT", "SAVINGS", "CASH_CREDIT", "OVERDRAFT"];

export interface BankForm {
  holderName: string;
  accountType: BankAccountType;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string;
  useAsSettlement: boolean;
}

export const emptyBankForm = (): BankForm => ({
  holderName: "",
  accountType: "CURRENT",
  accountNumber: "",
  confirmAccountNumber: "",
  ifsc: "",
  bankName: "",
  branch: "",
  useAsSettlement: false,
});

export const digitsOnly = (value: string): string => (value ?? "").replace(/\D/g, "").slice(0, BANK_LIMITS.accountMax);
export const normalizeIfscInput = (value: string): string => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);

export type BankErrors = Partial<Record<"holderName" | "accountNumber" | "confirmAccountNumber" | "ifsc", string>>;

export function validateBankForm(form: BankForm): BankErrors {
  const errors: BankErrors = {};
  const holder = form.holderName.trim();
  if (holder.length < BANK_LIMITS.holderMin || holder.length > BANK_LIMITS.holderMax) {
    errors.holderName = `Account holder name is ${BANK_LIMITS.holderMin}–${BANK_LIMITS.holderMax} characters.`;
  }
  if (!ACCOUNT_VERIFY_PATTERN.test(form.accountNumber)) errors.accountNumber = "An Indian bank account number is 9 to 18 digits.";
  if (form.confirmAccountNumber !== form.accountNumber) errors.confirmAccountNumber = "Account numbers do not match.";
  const ifsc = validateIfsc(form.ifsc);
  if (ifsc) errors.ifsc = ifsc;
  return errors;
}

export interface BankActions {
  /** Make this the settlement account (needs settlements enabled, i.e. verified). */
  makePrimary: boolean;
  /** Link for automatic payouts (the platform has them on and the account is not linked). */
  linkPayouts: boolean;
  remove: boolean;
  /** Show the "cannot receive settlements yet" note. */
  settlementPending: boolean;
}

export function bankActions(account: BankAccountView): BankActions {
  return {
    makePrimary: account.settlementEnabled && !account.isPrimary,
    linkPayouts: account.automaticPayoutsAvailable && !account.automaticPayoutLinked && account.status === "VERIFIED",
    remove: true,
    settlementPending: !account.settlementEnabled,
  };
}

export type BankErrorKind =
  | "mismatch"
  | "duplicate"
  | "notVerified"
  | "noVerifiedAccount"
  | "payoutsUnavailable"
  | "inUse"
  | null;

export function bankErrorKind(code: string | undefined): BankErrorKind {
  switch (code) {
    case "ACCOUNT_NUMBER_MISMATCH":
      return "mismatch";
    case "BANK_ACCOUNT_ALREADY_ADDED":
      return "duplicate";
    case "BANK_ACCOUNT_NOT_VERIFIED":
      return "notVerified";
    case "NO_VERIFIED_SETTLEMENT_ACCOUNT":
      return "noVerifiedAccount";
    case "AUTOMATIC_PAYOUTS_UNAVAILABLE":
      return "payoutsUnavailable";
    case "BANK_ACCOUNT_IN_USE":
      return "inUse";
    default:
      return null;
  }
}

/** The label of a deletion blocker with an optional screen that resolves it. */
export interface BlockerTarget {
  href: string | null;
}

const BLOCKER_TARGETS: Record<string, string> = {
  openOrders: "/seller/dashboard/orders",
  open_orders: "/seller/dashboard/orders",
  pendingOrders: "/seller/dashboard/orders",
  walletBalance: "/seller/dashboard/wallet",
  wallet_balance: "/seller/dashboard/wallet",
  pendingWithdrawals: "/seller/dashboard/wallet",
  activeSubscription: "/seller/dashboard/subscription",
  openDisputes: "/seller/dashboard/orders",
  openTickets: "/seller/dashboard/support",
};

/** Where a closure blocker can be resolved, when the app has a screen for it. */
export const blockerHref = (key: string): string | null => BLOCKER_TARGETS[key] ?? null;
