/**
 * Spotting a notification that has just arrived, for the in-app banner, the sound and the local
 * system notification. Pure functions and a small tracker; the app persists the tracker's map.
 */

export interface ArrivalRecord {
  id: string;
  createdAt: string;
  read: boolean;
}

/**
 * True when `rows` holds an unread notification the map has not seen at this timestamp. A
 * deduplicated chat alert may reuse its id; its new timestamp still counts as an arrival.
 * `seen` is null before the first snapshot, so opening the app never alerts for what was waiting.
 */
export function hasNewArrival(rows: readonly ArrivalRecord[], seen: ReadonlyMap<string, string> | null): boolean {
  return seen !== null && rows.some((row) => !row.read && seen.get(row.id) !== row.createdAt);
}

/** The most notification identities remembered; beyond this the window restarts from the latest list. */
export const MAX_REMEMBERED_NOTIFICATIONS = 2_000;

/** An arrival older than this was already announced by the phone; it is not raised again on return. */
export const FRESH_ARRIVAL_MS = 2 * 60_000;

export interface ArrivalOptions {
  /** Arrivals older than this are remembered but not reported (what piled up while the app was closed). */
  maxAgeMs?: number;
  now?: number;
}

/**
 * Remembers which notifications were seen between snapshots, so one that scrolls out of the
 * 30-item window and back is not announced twice and a read-state change is never an arrival.
 *
 * The first snapshot after construction (a cold start) is a baseline: it records what is there and
 * reports nothing, even when the map was restored from storage.
 */
export class ArrivalTracker<T extends ArrivalRecord = ArrivalRecord> {
  private seen: Map<string, string>;
  private primed: boolean;

  constructor(restored: Iterable<readonly [string, string]> = []) {
    this.seen = new Map(restored);
    this.primed = false;
  }

  /** Feed each snapshot's rows; returns the unread rows that are new arrivals. */
  update(rows: readonly T[], options: ArrivalOptions = {}): T[] {
    const { maxAgeMs, now = Date.now() } = options;
    const arrived = this.primed
      ? rows.filter((row) => {
          if (row.read || this.seen.get(row.id) === row.createdAt) return false;
          if (maxAgeMs === undefined) return true;
          const age = now - new Date(row.createdAt).getTime();
          return Number.isFinite(age) && age <= maxAgeMs;
        })
      : [];
    this.primed = true;
    for (const row of rows) this.seen.set(row.id, row.createdAt);
    if (this.seen.size > MAX_REMEMBERED_NOTIFICATIONS) {
      this.seen = new Map(rows.map((row) => [row.id, row.createdAt] as [string, string]));
    }
    return arrived;
  }

  /** The map to persist (oldest entries drop first once past the cap). */
  entries(): [string, string][] {
    return [...this.seen.entries()].slice(-MAX_REMEMBERED_NOTIFICATIONS);
  }

  get size(): number {
    return this.seen.size;
  }

  /** Forget everything (sign-out): the next snapshot is a fresh baseline. */
  reset(): void {
    this.seen = new Map();
    this.primed = false;
  }
}

/* ------------------------------------------------------------------ sound source */

/** The sound as the app can use it: audio bytes to save, or a link to fetch. */
export type SoundSource =
  | { kind: "data"; mime: string; extension: string; base64: string }
  | { kind: "url"; url: string };

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
};

/** The audio the server sends is at most 1 MB; refuse anything claiming much more. */
export const MAX_SOUND_BASE64_LENGTH = 1_500_000;

/**
 * Reads the sound setting's `source`: a `data:audio/…;base64,…` URI (what the admin upload saves)
 * or an http(s) link. Anything else — another scheme, a non-audio type, a bad body — is not played.
 */
export function parseSoundSource(source: string | null | undefined): SoundSource | null {
  const value = source?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return { kind: "url", url: value };
  const match = /^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(value);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2].replace(/[\r\n]/g, "");
  const extension = EXTENSIONS[mime];
  if (!extension || !base64 || base64.length > MAX_SOUND_BASE64_LENGTH) return null;
  return { kind: "data", mime, extension, base64 };
}
