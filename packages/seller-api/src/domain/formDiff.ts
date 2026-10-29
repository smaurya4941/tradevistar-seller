/**
 * Versioned saves: send only what changed, plus the version. When the server answers with a stale
 * version the app refetches the server copy and re-applies the seller's edits on top of it, rather
 * than throwing them away (the web discards them).
 */
import { ApiError } from "../http/client";

export type Draft = Record<string, unknown>;

const isBlank = (value: unknown): boolean => typeof value === "string" && value.trim() === "";

const equal = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => equal(item, b[i]));
  return a === b;
};

/** A form value as the API wants it: trimmed text, and blank text as `null`. */
export function toPayloadValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

/**
 * The fields of `draft` that differ from `original`. Text is compared trimmed and blank equals
 * missing, so typing and deleting a space does not count as a change. Blank text becomes `null`
 * in the result (clear the field).
 */
export function changedFields<T extends Draft>(original: Partial<T>, draft: Partial<T>): Partial<T> {
  const result: Draft = {};
  for (const key of Object.keys(draft)) {
    const before = original[key];
    const after = draft[key];
    const beforeNorm = isBlank(before) || before === undefined ? null : toPayloadValue(before);
    const afterNorm = toPayloadValue(after);
    if (!equal(beforeNorm, afterNorm)) result[key] = afterNorm;
  }
  return result as Partial<T>;
}

export const hasChanges = (changes: Draft): boolean => Object.keys(changes).length > 0;

export const STALE_VERSION_CODE = "STALE_RESOURCE_VERSION";

export const isStaleVersion = (error: unknown): boolean =>
  error instanceof ApiError && (error.code === STALE_VERSION_CODE || (error.statusCode === 409 && /version|changed/i.test(error.message)));

/**
 * Re-applies the seller's changed fields on top of a freshly fetched server copy. Fields the seller
 * did not touch take the server's newer value; fields they did touch keep their edit.
 */
export function mergeStale<T extends Draft>(server: T, userChanges: Partial<T>): T {
  return { ...server, ...userChanges };
}

/** A versioned write with the stale-merge step: refetch, re-apply the edits, report what happened. */
export interface StaleOutcome<S> {
  /** The server copy the form should now show (with the seller's edits on top). */
  merged: S;
  /** The new version to save against. */
  version: number;
}
