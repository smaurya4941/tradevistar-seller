/**
 * The phone's location, for "Use my current location" on an address.
 *
 * `@react-native-community/geolocation` provides the fixes; this wraps it as the shared
 * `LocationSource` so the capture rules (fast fix first, best sample after a short settle, give up
 * only when both sources fail) live in the shared package and are tested without a device.
 *
 * Permission is asked at the moment the seller taps the button, never at launch: Android through the
 * system dialog (fine or approximate both work), iOS through the library's own request. A refusal
 * is reported as "denied" so the screen can say where to switch it back on.
 */
import Geolocation, {
  type GeolocationError,
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import {
  captureLocation,
  LocationError,
  type CaptureOptions,
  type CapturedLocation,
  type LocationFailure,
  type LocationSource,
  type RawFix,
} from '@tradevistar/seller-api';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { logger } from '@/core/logger';

let configured = false;

function configure(): void {
  if (configured) return;
  configured = true;
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
  });
}

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

/** The library's numeric codes, as the capture's reasons. */
export function failureFor(
  error: Pick<GeolocationError, 'code'>,
): LocationFailure {
  if (error.code === PERMISSION_DENIED) return 'denied';
  if (error.code === TIMEOUT) return 'timeout';
  return 'unavailable';
}

const toFix = (position: GeolocationResponse): RawFix => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
});

/** Asks for location access. Resolves true when the app may read the position. */
export async function requestLocationPermission(): Promise<boolean> {
  configure();
  if (Platform.OS === 'android') {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    return Object.values(results).some(
      result => result === PermissionsAndroid.RESULTS.GRANTED,
    );
  }
  return new Promise<boolean>(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

/** The library as a `LocationSource`. */
export const nativeLocationSource: LocationSource = {
  getCurrent(onFix, onError, options) {
    Geolocation.getCurrentPosition(
      position => onFix(toFix(position)),
      error => onError(failureFor(error)),
      options,
    );
  },
  watch(onFix, onError, options) {
    const id = Geolocation.watchPosition(
      position => onFix(toFix(position)),
      error => onError(failureFor(error)),
      options,
    );
    return () => Geolocation.clearWatch(id);
  },
};

/**
 * Captures the current position after asking for permission. Rejects with a `LocationError`
 * (`denied`, `unavailable`, `timeout`); a permission refusal never reaches the sensors.
 */
export async function getCurrentLocation(
  options?: CaptureOptions,
): Promise<CapturedLocation> {
  let allowed = false;
  try {
    allowed = await requestLocationPermission();
  } catch (error) {
    logger.warn('[location] permission request failed', error);
    throw new LocationError('unavailable');
  }
  if (!allowed) throw new LocationError('denied');
  return captureLocation(nativeLocationSource, options);
}

/** Where the seller can switch location back on after refusing it. */
export function openLocationSettings(): void {
  Linking.openSettings().catch(error =>
    logger.info('[location] settings did not open', error),
  );
}
