/**
 * The short-lived access token. Each app supplies the store; both keep it in memory only, so a
 * stolen disk image never carries a usable bearer token.
 */
export interface TokenStore {
  get(): string | null;
  set(token: string | null): void;
  subscribe(listener: (token: string | null) => void): () => void;
}

export function createMemoryTokenStore(): TokenStore {
  let token: string | null = null;
  const listeners = new Set<(token: string | null) => void>();
  return {
    get: () => token,
    set(next) {
      token = next;
      for (const listener of listeners) {
        listener(next);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
