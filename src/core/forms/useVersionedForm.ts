/**
 * The edit-and-save pattern every versioned profile screen uses.
 *
 * The screen keeps only the fields the seller touched (`edits`) on top of the server copy, so:
 * - the form is always `server + edits`, and "dirty" means some edit differs from the server;
 * - a save sends only the changed fields plus the version;
 * - on `STALE_RESOURCE_VERSION` the server copy is refetched and the edits stay on top of it
 *   ("This changed elsewhere. Review and save again."), instead of being thrown away as the web
 *   does. Fields the seller did not touch silently take the newer server value.
 */
import {
  changedFields,
  hasChanges,
  isStaleVersion,
  type Draft,
} from '@tradevistar/seller-api';
import { useCallback, useMemo, useState } from 'react';

export type SaveResult = 'saved' | 'stale' | 'nothing' | 'failed';

export interface VersionedFormOptions<
  S extends { version: number },
  F extends Draft,
> {
  server: S | undefined;
  toForm: (server: S) => F;
  /** Sends the changed fields and the version it was read at; resolves with the new server copy. */
  save: (changes: Partial<F>, version: number) => Promise<S>;
  /** Re-reads the server copy after a stale answer. */
  refetch: () => Promise<S | undefined>;
  /** Called with the new server copy after a good save. */
  onSaved?: (saved: S) => void;
}

export interface VersionedForm<S, F extends Draft> {
  form: F | null;
  server: S | undefined;
  changes: Partial<F>;
  dirty: boolean;
  saving: boolean;
  /** True after a stale answer until the seller edits or saves again. */
  staleNotice: boolean;
  error: unknown;
  setField: <K extends keyof F>(key: K, value: F[K]) => void;
  /** Drops every edit. */
  reset: () => void;
  submit: () => Promise<SaveResult>;
  clearError: () => void;
}

export function useVersionedForm<
  S extends { version: number },
  F extends Draft,
>(options: VersionedFormOptions<S, F>): VersionedForm<S, F> {
  const { server, toForm, save, refetch, onSaved } = options;
  const [edits, setEdits] = useState<Partial<F>>({});
  const [saving, setSaving] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const base = useMemo(
    () => (server ? toForm(server) : null),
    [server, toForm],
  );
  const form = useMemo(
    () => (base ? ({ ...base, ...edits } as F) : null),
    [base, edits],
  );
  const changes = useMemo(
    () => (base ? changedFields<F>(base, edits) : ({} as Partial<F>)),
    [base, edits],
  );
  const dirty = hasChanges(changes);

  const setField = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setStaleNotice(false);
    setError(null);
    setEdits(current => ({ ...current, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setEdits({});
    setStaleNotice(false);
    setError(null);
  }, []);

  const submit = useCallback(async (): Promise<SaveResult> => {
    if (!server || saving) return 'failed';
    if (!hasChanges(changes)) return 'nothing';
    setSaving(true);
    setError(null);
    try {
      const saved = await save(changes, server.version);
      setEdits({});
      setStaleNotice(false);
      onSaved?.(saved);
      return 'saved';
    } catch (caught) {
      if (isStaleVersion(caught)) {
        try {
          await refetch();
        } catch {
          // The notice still tells the seller to review; the next save refetches again.
        }
        setStaleNotice(true);
        return 'stale';
      }
      setError(caught);
      return 'failed';
    } finally {
      setSaving(false);
    }
  }, [changes, onSaved, refetch, save, saving, server]);

  const clearError = useCallback(() => setError(null), []);

  return {
    form,
    server,
    changes,
    dirty,
    saving,
    staleNotice,
    error,
    setField,
    reset,
    submit,
    clearError,
  };
}
