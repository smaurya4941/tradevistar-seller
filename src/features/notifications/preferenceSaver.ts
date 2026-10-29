/**
 * Saves notification-preference switches: optimistic, batched, and rolled back on failure.
 *
 * A flip shows at once (the matrix in the cache is changed before anything is sent). Flips made
 * within a short window go to the server as one batched update; if that fails, the matrix returns
 * to what it was before the batch and the caller is told, so the switch snaps back with a message.
 * While a batch is in flight, each switch it contains reports itself as pending (its spinner).
 *
 * Kept free of React and the network so the behaviour is unit tested with fakes.
 */
import {
  applyChanges,
  changesFor,
  switchKey,
  toggleBlock,
  type NotificationPreferenceRow,
  type PreferenceCategory,
  type PreferenceChange,
  type PreferenceChannel,
  type ToggleBlock,
} from '@tradevistar/seller-api';

export interface PreferenceSaverDeps {
  /** The matrix as the cache holds it now. */
  get(): readonly NotificationPreferenceRow[] | undefined;
  /** Replaces the cached matrix. */
  set(rows: NotificationPreferenceRow[]): void;
  /** Sends a batch; resolves with the server's full matrix. */
  save(changes: PreferenceChange[]): Promise<NotificationPreferenceRow[]>;
  /** A batch failed and was rolled back. */
  onError(error: unknown, changes: PreferenceChange[]): void;
  /** The set of switches with a save in flight changed. */
  onPending(keys: ReadonlySet<string>): void;
  /** How long to wait for more flips before sending. */
  delayMs?: number;
}

export type ToggleOutcome =
  | { kind: 'queued' }
  | { kind: 'unchanged' }
  | { kind: 'blocked'; reason: ToggleBlock }
  | { kind: 'unavailable' };

const key = (change: PreferenceChange): string =>
  switchKey(change.category, change.channel);

export class PreferenceSaver {
  private buffer = new Map<string, PreferenceChange>();
  private snapshot: NotificationPreferenceRow[] | null = null;
  private pending = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly deps: PreferenceSaverDeps) {}

  toggle(
    category: PreferenceCategory,
    channel: PreferenceChannel,
    next: boolean,
  ): ToggleOutcome {
    const rows = this.deps.get();
    if (!rows) return { kind: 'unavailable' };
    const block = toggleBlock(rows, category, channel, next);
    if (block) return { kind: 'blocked', reason: block };
    const changes = changesFor(rows, category, channel, next);
    if (!changes.length) return { kind: 'unchanged' };

    // What to return to if the batch fails: the matrix before this batch's first flip.
    if (!this.snapshot) this.snapshot = rows.map(row => ({ ...row }));
    this.deps.set(applyChanges(rows, changes));
    for (const change of changes) {
      this.buffer.set(key(change), change);
      this.pending.add(key(change));
    }
    this.deps.onPending(new Set(this.pending));
    this.schedule();
    return { kind: 'queued' };
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.deps.delayMs ?? 350);
  }

  /** Sends what is buffered now; resolves when every batch so far has settled. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.buffer.size) return this.chain;
    const batch = [...this.buffer.values()];
    const snapshot = this.snapshot;
    this.buffer = new Map();
    this.snapshot = null;
    this.chain = this.chain.then(() => this.send(batch, snapshot));
    return this.chain;
  }

  private async send(
    batch: PreferenceChange[],
    snapshot: NotificationPreferenceRow[] | null,
  ): Promise<void> {
    try {
      const saved = await this.deps.save(batch);
      // Flips made while this batch was in flight are not in the answer yet: keep them showing.
      this.deps.set(applyChanges(saved, [...this.buffer.values()]));
    } catch (error) {
      if (snapshot) {
        this.deps.set(applyChanges(snapshot, [...this.buffer.values()]));
      }
      this.deps.onError(error, batch);
    } finally {
      for (const change of batch) {
        // Still waiting in a newer buffer: its spinner stays.
        if (!this.buffer.has(key(change))) this.pending.delete(key(change));
      }
      this.deps.onPending(new Set(this.pending));
    }
  }

  /** Stops a scheduled send (the screen closed); anything buffered is sent first. */
  dispose(): Promise<void> {
    return this.flush();
  }
}
