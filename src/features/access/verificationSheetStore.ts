/**
 * The shared "verification required" sheet: opened when a seller taps a write action while
 * view-only, or when the server refuses a write with ACCOUNT_VERIFICATION_REQUIRED.
 */
import {
  onSellerEvent,
  kycStatusFromDetails,
  type KycStatus,
} from '@tradevistar/seller-api';
import { track } from '@/core/analytics/analytics';
import { createStore, useStore } from '@/core/store';

export interface VerificationSheetState {
  open: boolean;
  /** The status the server reported with a refusal, when it did. */
  kycStatus: KycStatus | null;
}

export const verificationSheetStore = createStore<VerificationSheetState>({
  open: false,
  kycStatus: null,
});

export function openVerificationSheet(
  source: 'tap' | 'refusal',
  kycStatus: KycStatus | null = null,
): void {
  track('verification_sheet_opened', { source });
  verificationSheetStore.set({ open: true, kycStatus });
}

export function closeVerificationSheet(): void {
  verificationSheetStore.set(previous => ({ ...previous, open: false }));
}

export function useVerificationSheet(): VerificationSheetState {
  return useStore(verificationSheetStore);
}

let wired = false;

/** An unexpected ACCOUNT_VERIFICATION_REQUIRED opens the same sheet, using the status in the error. */
export function wireVerificationRefusals(): void {
  if (wired) return;
  wired = true;
  onSellerEvent('access:verification-required', detail => {
    openVerificationSheet('refusal', kycStatusFromDetails(detail?.details));
  });
}
