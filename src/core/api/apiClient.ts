/**
 * Configures the shared API client once, at app start, before anything issues a request.
 */
import {
  configureApiClient,
  createMemoryTokenStore,
  type SessionEndDetail,
  type SessionEndReason,
} from '@tradevistar/seller-api';
import { env } from '@/config/env';
import { userAgent } from '@/core/device/deviceInfo';
import { getRefreshToken, setRefreshToken } from '@/core/storage/secureStore';
import { uuidv4 } from './randomId';

type SessionEndedListener = (
  reason: SessionEndReason,
  detail?: SessionEndDetail,
) => void;

const sessionEndedListeners = new Set<SessionEndedListener>();

/** The session engine subscribes here to learn that the server ended the session. */
export function onSessionEnded(listener: SessionEndedListener): () => void {
  sessionEndedListeners.add(listener);
  return () => {
    sessionEndedListeners.delete(listener);
  };
}

let configured = false;

export function setupApiClient(): void {
  if (configured) return;
  configured = true;
  configureApiClient({
    baseUrl: env.apiBaseUrl,
    portal: 'seller',
    clientKind: 'mobile',
    defaultHeaders: { 'User-Agent': userAgent() },
    // The access token stays in memory only; a restart restores it from the refresh token.
    tokenStore: createMemoryTokenStore(),
    refreshTransport: { kind: 'native', getRefreshToken, setRefreshToken },
    randomId: uuidv4,
    onSessionEnded: (reason, detail) => {
      for (const listener of sessionEndedListeners) listener(reason, detail);
    },
  });
}
