/**
 * Public reference lists the registration form needs. No session is required, so no refresh
 * round-trip happens before the lookup.
 */
import { api } from "../http/client";

export interface LocationCountry {
  code: string;
  name: string;
  dialCode: string;
}

export const getLocationCountries = (signal?: AbortSignal) =>
  api.get<LocationCountry[]>("/reference/locations/countries", { skipAuth: true, signal });

export interface CategoryNode {
  id: string;
  code: string;
  name: string;
  children?: CategoryNode[];
}

/** The category tree; registration offers the top level, whose `code` the backend stores as is. */
export const getCategories = (signal?: AbortSignal) =>
  api.get<CategoryNode[]>("/categories", { skipAuth: true, signal });
