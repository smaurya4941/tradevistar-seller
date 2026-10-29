/**
 * Access-token helpers that always resolve the store configured by `configureApiClient`, so
 * endpoint code can keep calling `getAccessToken()` without knowing which app it runs in.
 */
import { getApiClientConfig } from "./config";

export type { TokenStore } from "./memoryTokenStore";
export { createMemoryTokenStore } from "./memoryTokenStore";

export function getAccessToken(): string | null {
  return getApiClientConfig().tokenStore.get();
}

export function setAccessToken(token: string | null): void {
  getApiClientConfig().tokenStore.set(token);
}

export function onAccessTokenChange(listener: (token: string | null) => void): () => void {
  return getApiClientConfig().tokenStore.subscribe(listener);
}
