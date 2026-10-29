/**
 * Field-level errors from an API failure, so a rejected value is shown under its own input.
 *
 * The API sends validation reasons in `error.details`: either strings that start with the field
 * name ("website must start with http"), or objects naming the field (`{ field, message }`).
 * Both are read; anything else leaves the fields alone and the screen shows the summary instead.
 */
import { ApiError } from '@tradevistar/seller-api';

export type FieldErrors = Record<string, string>;

const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/;

export function serverFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};
  const result: FieldErrors = {};
  const details: unknown = error.details;
  const lines = Array.isArray(details) ? details : details ? [details] : [];
  for (const line of lines) {
    if (typeof line === 'string') {
      const [first, ...rest] = line.split(' ');
      if (rest.length > 0 && FIELD_NAME.test(first) && !result[first]) {
        result[first] = line;
      }
    } else if (line && typeof line === 'object') {
      const entry = line as {
        field?: unknown;
        property?: unknown;
        message?: unknown;
        constraints?: unknown;
      };
      const field =
        typeof entry.field === 'string'
          ? entry.field
          : typeof entry.property === 'string'
          ? entry.property
          : null;
      const constraints =
        entry.constraints && typeof entry.constraints === 'object'
          ? Object.values(entry.constraints as Record<string, unknown>).find(
              value => typeof value === 'string',
            )
          : undefined;
      const message =
        typeof entry.message === 'string'
          ? entry.message
          : (constraints as string | undefined);
      if (field && message && !result[field]) result[field] = message;
    }
  }
  return result;
}

/** The first of `names` the server complained about, for forms whose field names differ. */
export function pickFieldError(
  errors: FieldErrors,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    if (errors[name]) return errors[name];
  }
  return undefined;
}
