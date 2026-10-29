/**
 * Hands the address form's state to the pin map and the chosen pin back. A route param cannot carry
 * a callback and should not carry the typed address, so the two screens meet here: the form sets a
 * request before opening the map, the map sets a result before closing, and the form takes the
 * result when it regains focus (once — it is cleared as it is read).
 */
import type { GeocodeQuery, MapPoint } from '@tradevistar/seller-api';

interface MapRequest {
  /** The pin already on the form, if any. */
  pin: MapPoint | null;
  /** The typed address, used only to centre the map when there is no pin yet. */
  address: Partial<GeocodeQuery>;
}

let request: MapRequest | null = null;
let result: MapPoint | null = null;

export function setMapRequest(next: MapRequest): void {
  request = next;
  result = null;
}

export const getMapRequest = (): MapRequest | null => request;

export function setMapResult(point: MapPoint): void {
  result = point;
}

/** The pin the seller confirmed, once; null when the map was closed without one. */
export function takeMapResult(): MapPoint | null {
  const taken = result;
  result = null;
  return taken;
}

export function clearMapBridge(): void {
  request = null;
  result = null;
}
