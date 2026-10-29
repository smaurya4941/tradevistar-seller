/**
 * "Use my current location": ask for permission, read the phone's position (waiting for a good
 * fix and reporting its accuracy in metres), then look up the street, city, state and PIN at that
 * point so the address can be filled in. The point is kept even when the lookup fails — the
 * coordinates alone are enough for a courier to find the address.
 */
import {
  addressPatchFromGeocode,
  coordinatesFor,
  LocationError,
  reverseGeocodeLocation,
  type AddressFields,
  type LocationFailure,
} from '@tradevistar/seller-api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/core/logger';
import { getCurrentLocation } from '@/core/native/currentLocation';
import type { TranslationKey } from '@/i18n';

export interface LocationCaptureResult {
  /** The captured point, rounded as the backend stores it. */
  point: { latitude: number; longitude: number };
  /** The fix's radius in metres, rounded. */
  accuracy: number;
  /** The address fields the lookup found (empty when it found nothing). */
  patch: Partial<AddressFields>;
  /** True when the lookup filled at least one address field. */
  filled: boolean;
}

export const FAILURE_MESSAGE: Record<LocationFailure, TranslationKey> = {
  denied: 'loc.denied',
  unavailable: 'loc.unavailable',
  timeout: 'loc.timeout',
  unsupported: 'loc.unsupported',
};

export function locationFailureOf(error: unknown): LocationFailure {
  return error instanceof LocationError ? error.reason : 'unavailable';
}

export function useLocationCapture() {
  const [locating, setLocating] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Resolves with the capture; rejects with a `LocationError`. Ignores a second tap while one runs. */
  const capture =
    useCallback(async (): Promise<LocationCaptureResult | null> => {
      if (running.current) return null;
      running.current = true;
      setLocating(true);
      try {
        const location = await getCurrentLocation();
        const point = coordinatesFor(location);
        if (!point) throw new LocationError('unavailable');
        const found = await reverseGeocodeLocation(
          point.latitude,
          point.longitude,
        ).catch(() => {
          logger.info('[location] address lookup failed');
          return null;
        });
        const patch = addressPatchFromGeocode(found);
        // The country alone is not "filling" anything.
        const { countryCode: _country, ...rest } = patch;
        return {
          point,
          accuracy: Math.round(location.accuracy),
          patch,
          filled: Object.keys(rest).length > 0,
        };
      } finally {
        running.current = false;
        if (alive.current) setLocating(false);
      }
    }, []);

  return { locating, capture };
}
