/**
 * Business address rules: how a map pin is kept, dropped or sent, the form validation, and the
 * warning for pickup addresses saved without a pin. Copies the web form's behaviour.
 *
 * - A pin set in this form stays when the seller corrects the address text.
 * - A previously saved pin is dropped when the address text changes: it described the old text.
 * - On save, `locationSource` is sent only for a pin set in this session.
 */
import { validatePhone, validatePostal } from "./countryRules";
import { movesThePoint, isValidCoordinatePair, roundCoordinate } from "./geo";
import { PICKUP_PURPOSES } from "./profileDisplay";
import type { AddressPurpose, CompanyAddressInput, CompanyAddressView, PinSource } from "../endpoints/profile";

export interface AddressForm {
  purpose: AddressPurpose;
  label: string;
  contactName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  stateCode: string;
  zip: string;
  countryCode: string;
  isDefault: boolean;
}

export const ADDRESS_LIMITS = {
  label: 50,
  contactMin: 2,
  contactMax: 100,
  line1Min: 5,
  line1Max: 500,
  place: 100,
} as const;

export const emptyAddressForm = (purpose: AddressPurpose = "OPERATING", countryCode = "IN"): AddressForm => ({
  purpose,
  label: "",
  contactName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  stateCode: "",
  zip: "",
  countryCode,
  isDefault: false,
});

export const formFromAddress = (address: CompanyAddressView): AddressForm => ({
  purpose: address.purpose,
  label: address.label ?? "",
  contactName: address.contactName,
  phone: address.phone,
  line1: address.line1,
  line2: address.line2 ?? "",
  city: address.city,
  state: address.state,
  stateCode: address.stateCode ?? "",
  zip: address.zip,
  countryCode: address.countryCode,
  isDefault: address.isDefault,
});

export type AddressErrors = Partial<Record<keyof AddressForm, string>>;

export function validateAddress(form: AddressForm): AddressErrors {
  const errors: AddressErrors = {};
  if (form.label.trim().length > ADDRESS_LIMITS.label) errors.label = `At most ${ADDRESS_LIMITS.label} characters.`;
  const contact = form.contactName.trim();
  if (contact.length < ADDRESS_LIMITS.contactMin || contact.length > ADDRESS_LIMITS.contactMax) {
    errors.contactName = `Contact name is ${ADDRESS_LIMITS.contactMin}–${ADDRESS_LIMITS.contactMax} characters.`;
  }
  const phone = validatePhone(form.phone, form.countryCode);
  if (phone) errors.phone = phone;
  const line1 = form.line1.trim();
  if (line1.length < ADDRESS_LIMITS.line1Min || line1.length > ADDRESS_LIMITS.line1Max) {
    errors.line1 = `Address line 1 is ${ADDRESS_LIMITS.line1Min}–${ADDRESS_LIMITS.line1Max} characters.`;
  }
  if (!form.city.trim()) errors.city = "Choose a city.";
  else if (form.city.trim().length > ADDRESS_LIMITS.place) errors.city = "At most 100 characters.";
  if (!form.state.trim()) errors.state = "Choose a state.";
  else if (form.state.trim().length > ADDRESS_LIMITS.place) errors.state = "At most 100 characters.";
  const zip = validatePostal(form.zip, form.countryCode);
  if (zip) errors.zip = zip;
  return errors;
}

/** The pin held while the form is open. */
export interface PinState {
  latitude: number | null;
  longitude: number | null;
  /** Where the pin came from; null when there is none. */
  source: PinSource | null;
  /** True for a pin set in this form session (GPS or map), not one loaded from the server. */
  setNow: boolean;
}

export const NO_PIN: PinState = { latitude: null, longitude: null, source: null, setNow: false };

export const pinFromAddress = (address: CompanyAddressView | null): PinState =>
  address && isValidCoordinatePair(address.latitude, address.longitude)
    ? { latitude: address.latitude, longitude: address.longitude, source: address.locationSource, setNow: false }
    : NO_PIN;

export const pinFromCapture = (latitude: number, longitude: number, source: "GPS" | "MAP_PIN"): PinState => ({
  latitude: roundCoordinate(latitude),
  longitude: roundCoordinate(longitude),
  source,
  setNow: true,
});

export const hasPin = (pin: PinState): boolean => isValidCoordinatePair(pin.latitude, pin.longitude);

/**
 * What happens to the pin when one address field changes. A saved pin described the old text, so
 * changing city, state, PIN or country (or the street text) drops it; a pin set in this session
 * stays, because the seller placed it knowing what the form said.
 */
export function pinAfterEdit(pin: PinState, field: keyof AddressForm): PinState {
  if (!hasPin(pin) || pin.setNow) return pin;
  const textFields: (keyof AddressForm)[] = ["line1", "line2"];
  if (movesThePoint(field) || textFields.includes(field)) return NO_PIN;
  return pin;
}

/** The request body: `locationSource` only for a pin set now; coordinates only when both exist. */
export function addressPayload(form: AddressForm, pin: PinState, version?: number): CompanyAddressInput {
  const body: CompanyAddressInput = {
    purpose: form.purpose,
    contactName: form.contactName.trim(),
    phone: form.phone.trim(),
    line1: form.line1.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    zip: form.zip.trim(),
    countryCode: form.countryCode,
    isDefault: form.isDefault,
  };
  if (form.label.trim()) body.label = form.label.trim();
  if (form.line2.trim()) body.line2 = form.line2.trim();
  if (form.stateCode.trim()) body.stateCode = form.stateCode.trim();
  if (hasPin(pin)) {
    body.latitude = pin.latitude;
    body.longitude = pin.longitude;
    if (pin.setNow && (pin.source === "GPS" || pin.source === "MAP_PIN")) body.locationSource = pin.source;
  } else if (version !== undefined) {
    // An edit that dropped the old pin clears it on the server.
    body.latitude = null;
    body.longitude = null;
  }
  if (version !== undefined) body.version = version;
  return body;
}

/** A courier collects from these purposes, so a missing pin is worth a warning after saving. */
export const needsPin = (purpose: AddressPurpose): boolean => PICKUP_PURPOSES.includes(purpose);

export function missingPinWarning(purpose: AddressPurpose, pin: PinState): boolean {
  return needsPin(purpose) && !hasPin(pin);
}

/**
 * An exact "Find from address" match without a map: the point is offered, and when accepted it is
 * kept like a stored pin (no `locationSource` is sent), so the server derives how it was found.
 */
export const pinFromGeocode = (latitude: number, longitude: number): PinState => ({
  latitude: roundCoordinate(latitude),
  longitude: roundCoordinate(longitude),
  source: "GEOCODED",
  setNow: false,
});
