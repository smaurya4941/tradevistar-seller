/**
 * The two account changes that bump the account version on the server — a password change and a
 * login email or mobile change. Both leave this phone's access token unusable, so the session is
 * renewed straight away (refresh now, as the buyer app does) instead of letting the next request
 * fail once and rely on the retry. Other devices are signed out by the server.
 *
 * A renew that fails does not undo the change: the change went through, and the API client's own
 * retry on a 401 is the fallback. The dependencies are passed in so the order is tested.
 */
export interface PasswordChangeDeps {
  change(): Promise<{ otherSessionsRevoked: number }>;
  renewSession(): Promise<void>;
  onRenewFailed?(error: unknown): void;
}

export async function changePasswordAndRenew(
  deps: PasswordChangeDeps,
): Promise<number> {
  const result = await deps.change();
  await renew(deps.renewSession, deps.onRenewFailed);
  return result.otherSessionsRevoked;
}

export interface ContactChangeDeps<T> {
  confirm(): Promise<T>;
  renewSession(): Promise<void>;
  onRenewFailed?(error: unknown): void;
}

export async function confirmContactAndRenew<T>(
  deps: ContactChangeDeps<T>,
): Promise<T> {
  const result = await deps.confirm();
  await renew(deps.renewSession, deps.onRenewFailed);
  return result;
}

async function renew(
  renewSession: () => Promise<void>,
  onFailed?: (error: unknown) => void,
) {
  try {
    await renewSession();
  } catch (error) {
    onFailed?.(error);
  }
}
