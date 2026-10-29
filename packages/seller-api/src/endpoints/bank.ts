/**
 * Settlement bank accounts (`/seller/profile/bank-accounts`) and the live bank-details check
 * (`POST /bank-verification/verify`).
 *
 * The full account number is sent only on add and when linking automatic payouts; the server
 * stores a masked copy. Nothing here may log it.
 */
import { api } from "../http/client";

export type BankAccountStatus =
  | "PENDING_VERIFICATION"
  | "VERIFICATION_REQUIRED"
  | "VERIFIED"
  | "REJECTED"
  | "FAILED"
  | "SUSPENDED"
  | "DISABLED";

export type BankAccountType = "CURRENT" | "SAVINGS" | "CASH_CREDIT" | "OVERDRAFT";

export interface BankAccountView {
  id: string;
  holderName: string;
  bankName: string | null;
  branch: string | null;
  accountNumberMasked: string;
  ifsc: string;
  accountType: BankAccountType;
  countryCode: string;
  currency: string;
  status: BankAccountStatus;
  isPrimary: boolean;
  settlementEnabled: boolean;
  verifiedAt: string | null;
  failureReason: string | null;
  /** Linked to the payout partner, so released escrow reaches this account automatically. */
  automaticPayoutLinked: boolean;
  /** TradeVistar has automatic payouts switched on at all. */
  automaticPayoutsAvailable: boolean;
  version: number;
  createdAt: string;
}

export interface BankAccountEventView {
  id: string;
  action: string;
  fromStatus: BankAccountStatus | null;
  toStatus: BankAccountStatus | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface AddBankAccountBody {
  holderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
  bankName?: string;
  branch?: string;
  accountType?: BankAccountType;
  isPrimary?: boolean;
  /** The sealed verdict from the live check; the only way the server marks the account verified. */
  verificationToken?: string;
}

export const listBankAccounts = (signal?: AbortSignal) =>
  api.get<BankAccountView[]>("/seller/profile/bank-accounts", { requireAuth: true, signal });

export const addBankAccount = (body: AddBankAccountBody) =>
  api.post<BankAccountView>("/seller/profile/bank-accounts", body, { requireAuth: true });

export const setPrimaryBankAccount = (id: string) =>
  api.post<BankAccountView>(`/seller/profile/bank-accounts/${encodeURIComponent(id)}/primary`, undefined, {
    requireAuth: true,
  });

/** The backend never stores the number, so linking an existing account asks for it once. */
export const enableAutomaticPayouts = (id: string, accountNumber: string) =>
  api.post<BankAccountView>(
    `/seller/profile/bank-accounts/${encodeURIComponent(id)}/automatic-payouts`,
    { accountNumber },
    { requireAuth: true },
  );

export const deleteBankAccount = (id: string) =>
  api.delete<{ removed: true }>(`/seller/profile/bank-accounts/${encodeURIComponent(id)}`, { requireAuth: true });

export const getBankAccountHistory = (id: string, signal?: AbortSignal) =>
  api.get<BankAccountEventView[]>(`/seller/profile/bank-accounts/${encodeURIComponent(id)}/history`, {
    requireAuth: true,
    signal,
  });

/* ------------------------------------------------------------------ live verification */

export interface BankVerificationResult {
  verified: boolean;
  ifscVerified: boolean;
  bankAccountVerified: boolean;
  ifsc: string;
  bankName: string | null;
  bankCode: string | null;
  branch: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  centre: string | null;
  micr: string | null;
  rtgs: boolean | null;
  neft: boolean | null;
  imps: boolean | null;
  upi: boolean | null;
  reason: "INVALID_IFSC" | "INVALID_ACCOUNT" | "ACCOUNT_NOT_FOUND" | "BANK_NOT_SUPPORTED" | null;
  message: string;
  verificationToken: string | null;
}

export const verifyBankDetails = (body: { ifsc: string; accountNumber?: string }, signal?: AbortSignal) =>
  api.post<BankVerificationResult>("/bank-verification/verify", body, { signal, requireAuth: true });
