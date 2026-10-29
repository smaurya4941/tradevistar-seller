/**
 * The refresh token, in the platform keystore (Android Keystore / iOS Keychain).
 *
 * It is the one long-lived credential the app holds, so it never touches MMKV, logs or JS state
 * beyond the moment it is read. Writes are serialised: a rotation must land after the write it
 * replaces, or a stale token would be presented next time and trip the server's reuse detection.
 */
import * as Keychain from 'react-native-keychain';

export const KEYCHAIN_SERVICE = 'com.tradevistar.seller.session';
const ACCOUNT = 'refresh-token';

const OPTIONS: Keychain.SetOptions = {
  service: KEYCHAIN_SERVICE,
  // Readable after the first unlock so a background refresh can still run; never migrates to
  // another device through backups.
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
};

let queue: Promise<unknown> = Promise.resolve();

function serialised<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export function getRefreshToken(): Promise<string | null> {
  return serialised(async () => {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });
    return credentials ? credentials.password : null;
  });
}

export function setRefreshToken(token: string | null): Promise<void> {
  return serialised(async () => {
    if (token) {
      const saved = await Keychain.setGenericPassword(ACCOUNT, token, OPTIONS);
      if (!saved) {
        throw new Error(
          'The session could not be saved securely on this device.',
        );
      }
    } else {
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    }
  });
}

export async function hasRefreshToken(): Promise<boolean> {
  return (await getRefreshToken()) !== null;
}
