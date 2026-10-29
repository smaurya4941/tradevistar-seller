/**
 * App logging. Development builds print to the console; release builds keep only warnings and
 * errors, and errors also go to crash reporting once start-up has attached it (`setLoggerHook`).
 * Never pass tokens, OTPs or personal data here.
 */
/* eslint-disable no-console */
import { redactText } from '@/core/redact';

const verbose = __DEV__;

/** Free text is redacted before it is printed: tokens, contact details and IDs never reach a log. */
function printable(detail: unknown): unknown {
  if (detail instanceof Error) return redactText(detail.message);
  if (typeof detail === 'string') return redactText(detail);
  return detail ?? '';
}

type ErrorHook = (message: string, detail?: unknown) => void;
let errorHook: ErrorHook | null = null;

/** Start-up points errors at crash reporting; kept here so the logger imports nothing heavy. */
export function setLoggerHook(hook: ErrorHook | null): void {
  errorHook = hook;
}

export const logger = {
  info(message: string, detail?: unknown): void {
    if (verbose) console.log(message, printable(detail));
  },
  warn(message: string, detail?: unknown): void {
    console.warn(message, printable(detail));
  },
  error(message: string, detail?: unknown): void {
    console.error(message, printable(detail));
    try {
      errorHook?.(message, detail);
    } catch {
      // Reporting a failure must never become a failure.
    }
  },
};
