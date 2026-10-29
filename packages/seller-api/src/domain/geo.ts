/**
 * "Use my current location": capturing a GPS fix quickly and turning it into address fields.
 *
 * The capture mirrors the web's: a fast network fix (or a position cached in the last minute) and a
 * high-accuracy watch run together. A precise enough sample returns at once; otherwise the best
 * sample is returned shortly after the first fix arrives, instead of waiting out the full timeout for
 * a GPS that may never improve (indoors, for instance). Only both sources failing is an error worth
 * showing. The phone's location API is passed in as a `LocationSource`, so this stays free of any
 * native module and is tested with a fake one.
 */
import type { ReverseGeocoded as ReverseGeocodedAddress } from "../endpoints/profile";

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  /** Radius of the fix, in metres: smaller is better. */
  accuracy: number;
}

export type LocationFailure = "denied" | "unavailable" | "timeout" | "unsupported";

export class LocationError extends Error {
  readonly reason: LocationFailure;
  constructor(reason: LocationFailure) {
    super(reason);
    this.name = "LocationError";
    this.reason = reason;
  }
}

/** What the native location API gives back, however the module spells it. */
export interface RawFix {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface LocationRequestOptions {
  enableHighAccuracy: boolean;
  /** Accept a cached position no older than this (ms). */
  maximumAge: number;
  timeout: number;
}

/** The phone's location API, reduced to the two calls the capture needs. */
export interface LocationSource {
  getCurrent(
    onFix: (fix: RawFix) => void,
    onError: (reason: LocationFailure) => void,
    options: LocationRequestOptions,
  ): void;
  /** Starts a watch; the returned function stops it. */
  watch(
    onFix: (fix: RawFix) => void,
    onError: (reason: LocationFailure) => void,
    options: LocationRequestOptions,
  ): () => void;
}

export interface CaptureOptions {
  /** A sample at or under this accuracy (metres) is returned immediately. */
  desiredAccuracy?: number;
  /** Once any fix exists, wait at most this long for a better one before returning it. */
  settleMs?: number;
  /** Hard cap for the whole capture. */
  timeoutMs?: number;
}

export const DEFAULT_CAPTURE: Required<CaptureOptions> = {
  desiredAccuracy: 100,
  settleMs: 2_500,
  timeoutMs: 10_000,
};

/** Seven decimals is about a centimetre — what the backend stores. */
export const COORDINATE_DECIMALS = 7;

export const roundCoordinate = (value: number): number => Number(value.toFixed(COORDINATE_DECIMALS));

/** A real point on Earth: finite, in range, and not the (0, 0) a failed fix is reported as. */
export function isValidCoordinatePair(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== "number" || typeof longitude !== "number") return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return !(latitude === 0 && longitude === 0);
}

const isUsableFix = (fix: RawFix): boolean =>
  Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && isValidCoordinatePair(fix.latitude, fix.longitude);

/** Both coordinates, rounded for the backend, or none: an address never carries half a point. */
export function coordinatesFor(
  location: Pick<CapturedLocation, "latitude" | "longitude"> | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!location || !isValidCoordinatePair(location.latitude, location.longitude)) return null;
  return { latitude: roundCoordinate(location.latitude), longitude: roundCoordinate(location.longitude) };
}

/**
 * Captures the current position. Resolves with the best fix; rejects with a `LocationError`.
 * `setTimer`/`clearTimer` are injectable for tests.
 */
export function captureLocation(
  source: LocationSource,
  options: CaptureOptions = {},
  timers: {
    setTimer: (fn: () => void, ms: number) => unknown;
    clearTimer: (handle: unknown) => void;
  } = {
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
): Promise<CapturedLocation> {
  const { desiredAccuracy, settleMs, timeoutMs } = { ...DEFAULT_CAPTURE, ...options };
  const { setTimer, clearTimer } = timers;

  return new Promise<CapturedLocation>((resolve, reject) => {
    let best: CapturedLocation | null = null;
    let settled = false;
    let settleTimer: unknown;
    let failures = 0;
    let stopWatch: (() => void) | null = null;
    let deadline: unknown;

    const stop = () => {
      clearTimer(deadline);
      if (settleTimer !== undefined) clearTimer(settleTimer);
      stopWatch?.();
    };
    const succeed = (location: CapturedLocation) => {
      if (settled) return;
      settled = true;
      stop();
      resolve(location);
    };
    const fail = (reason: LocationFailure) => {
      if (settled) return;
      settled = true;
      stop();
      reject(new LocationError(reason));
    };

    deadline = setTimer(() => {
      if (best) succeed(best);
      else fail("timeout");
    }, timeoutMs);

    const onFix = (fix: RawFix) => {
      if (settled || !isUsableFix(fix)) return;
      const sample: CapturedLocation = {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
      };
      if (!best || sample.accuracy < best.accuracy) best = sample;
      if (sample.accuracy <= desiredAccuracy) {
        succeed(sample);
        return;
      }
      if (settleTimer === undefined) {
        settleTimer = setTimer(() => {
          if (best) succeed(best);
        }, settleMs);
      }
    };

    // Permission refusal is final; any other single failure is not, since the other source may still answer.
    const onError = (reason: LocationFailure) => {
      if (settled) return;
      if (reason === "denied" || reason === "unsupported") {
        fail(reason);
        return;
      }
      failures += 1;
      if (best) succeed(best);
      else if (failures >= 2) fail(reason);
    };

    source.getCurrent(onFix, onError, { enableHighAccuracy: false, maximumAge: 60_000, timeout: timeoutMs });
    // A source that failed synchronously has already settled the promise; do not start a watch then.
    if (!settled) {
      stopWatch = source.watch(onFix, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      });
      // The capture may have ended while the watch was starting.
      if (settled) stopWatch();
    }
  });
}

/** The address fields a geocode fills in; fields it could not find are left alone. */
export interface AddressFields {
  line1: string;
  city: string;
  state: string;
  zip: string;
  countryCode: string;
}

/** The part of an address a reverse geocode may fill; only what it actually found. */
export function addressPatchFromGeocode(found: Partial<ReverseGeocodedAddress> | null | undefined): Partial<AddressFields> {
  if (!found) return {};
  const patch: Partial<AddressFields> = {};
  if (found.line1?.trim()) patch.line1 = found.line1.trim();
  if (found.city?.trim()) patch.city = found.city.trim();
  if (found.state?.trim()) patch.state = found.state.trim();
  const zip = (found.zip ?? "").replace(/\D/g, "").slice(0, 6);
  if (zip) patch.zip = zip;
  patch.countryCode = found.countryCode?.trim().toUpperCase() || "IN";
  return patch;
}

/** Editing where an address is (city, state, PIN) invalidates a captured point; adding a plot number to the street does not. */
export const LOCATION_FIELDS_THAT_MOVE_THE_POINT = ["city", "state", "zip", "countryCode"] as const;

export function movesThePoint(field: string): boolean {
  return (LOCATION_FIELDS_THAT_MOVE_THE_POINT as readonly string[]).includes(field);
}

// ── Address pin on a map ──────────────────────────────────────────────────────


export interface MapPoint {
  lat: number;
  lng: number;
}

/** Where the map opens when nothing better is known. */
export const INDIA_CENTER: MapPoint = { lat: 22.9734, lng: 78.6569 };

/** The pin is stored to seven decimals (about a centimetre). */
export function roundPin(point: MapPoint): MapPoint {
  return { lat: Number(point.lat.toFixed(7)), lng: Number(point.lng.toFixed(7)) };
}

export type PinHint = "saved" | "exact" | "area" | "none";

export interface PinMapStart {
  center: MapPoint;
  /** Degrees of latitude the map shows: street level, neighbourhood or the whole country. */
  delta: number;
  /** The pin already placed when the map opens; null until the buyer places one. */
  pin: MapPoint | null;
  hint: PinHint;
}

/**
 * How the pin map opens. It starts on the address's saved pin; otherwise on what the address text
 * geocodes to (an exact match also pre-places the pin, an area match only centres the map, so an
 * area centre is never saved as a building's location); otherwise on India.
 */
export function pinMapStart(
  saved: MapPoint | null,
  found: { lat: number; lng: number; precision: "EXACT" | "APPROXIMATE" } | null,
): PinMapStart {
  if (saved) return { center: saved, delta: 0.003, pin: saved, hint: "saved" };
  if (found?.precision === "EXACT") {
    const point = roundPin(found);
    return { center: point, delta: 0.003, pin: point, hint: "exact" };
  }
  if (found) return { center: { lat: found.lat, lng: found.lng }, delta: 0.012, pin: null, hint: "area" };
  return { center: INDIA_CENTER, delta: 28, pin: null, hint: "none" };
}

/** Whether the typed address has enough text to ask a geocoder where it is. */
export function canGeocode(address: { line1?: string; city?: string }): boolean {
  return Boolean(address.line1?.trim() && address.city?.trim());
}
