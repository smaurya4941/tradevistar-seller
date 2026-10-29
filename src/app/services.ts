/**
 * The composition root: builds the app's long-lived services with their real dependencies.
 * Tests build the same classes with fakes instead.
 */
import {
  ensureFreshAccessToken,
  loginWithOtp,
  loginWithPassword,
  logout,
  refresh,
  resendTwoFactor,
  setAccessToken,
  verifyTwoFactor,
  type AuthUser,
} from '@tradevistar/seller-api';
import { setupApiClient } from '@/core/api/apiClient';
import { wireMaintenanceEvents } from '@/core/appConfig/appConfigStore';
import { SessionEngine } from '@/core/auth/sessionEngine';
import { logger } from '@/core/logger';
import { queryClient, wireQueryLifecycle } from '@/core/query/queryClient';
import {
  clearUserStorage,
  readJson,
  userStorage,
  UserKeys,
  writeJson,
} from '@/core/storage/kv';
import { hasRefreshToken, setRefreshToken } from '@/core/storage/secureStore';
import { clearViewedDocuments } from '@/core/files/privateViewer';
import { clearPushPresentation } from '@/core/push/launcherBadge';
import { unregisterFromPush } from '@/core/push/pushRegistration';
import { clearTwoFactorChallenge } from '@/features/auth/twoFactorChallenge';
import { wireVerificationRefusals } from '@/features/access/verificationSheetStore';
import { clearMapBridge } from '@/features/profile/mapPinBridge';
import { clearInvitationToken } from '@/features/invitations/pendingInvitation';

setupApiClient();
wireQueryLifecycle();
wireMaintenanceEvents();
wireVerificationRefusals();
// A document viewed last time is not left in the cache after a restart.
void clearViewedDocuments();

export const sessionEngine = new SessionEngine({
  hasRefreshToken,
  clearRefreshToken: () => setRefreshToken(null),
  refresh,
  // "Remember me" decides how long the server keeps the session; the Keychain protects it at rest.
  loginWithPassword: (identifier, password, rememberMe) =>
    loginWithPassword({ identifier, password, rememberMe }),
  loginWithOtp: (identifier, code, rememberMe) =>
    loginWithOtp({ identifier, code, rememberMe }),
  verifyTwoFactor,
  resendTwoFactor,
  readCachedUser: () =>
    readJson<AuthUser>(userStorage, UserKeys.cachedUser) ?? null,
  writeCachedUser: user => writeJson(userStorage, UserKeys.cachedUser, user),
  logout,
  setAccessToken,
  ensureFreshAccessToken,
  // While the session is still valid, so the server stops sending to this phone.
  beforeSignOut: () =>
    unregisterFromPush().catch(error =>
      logger.info('[push] could not unregister the device', error),
    ),
  clearUserData: () => {
    queryClient.clear();
    clearUserStorage();
    clearTwoFactorChallenge();
    clearInvitationToken();
    // Documents viewed by the previous seller, and a half-finished address pin, do not carry over.
    void clearViewedDocuments();
    clearMapBridge();
    // Nothing about the previous seller stays in the notification shade or on the launcher icon.
    void clearPushPresentation();
  },
  log: (message, error) => logger.warn(`[session] ${message}`, error),
});
