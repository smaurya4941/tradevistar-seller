/**
 * When to ask the API to register this phone for push. The route does not exist yet (gap 3), so a
 * 404 is recorded and not asked again for a day, instead of every launch calling a missing
 * endpoint. Pure, so the rule is tested without a device.
 */

export const UNSUPPORTED_RETRY_MS = 24 * 60 * 60 * 1000;

/** Whether to try registering, given when the API last said it does not support it. */
export function shouldAttemptRegistration(
  unsupportedAt: number | undefined,
  now: number = Date.now(),
): boolean {
  if (unsupportedAt === undefined || unsupportedAt <= 0) return true;
  // A clock that moved backwards must not block registration for ever.
  if (unsupportedAt > now) return true;
  return now - unsupportedAt >= UNSUPPORTED_RETRY_MS;
}

/** A status that means "this API has no push-device route". */
export function isUnsupportedStatus(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 405 || statusCode === 501;
}
