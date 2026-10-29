/**
 * RFC 4122 v4 UUIDs from the platform's secure random source. React Native has no
 * `crypto.randomUUID`; `react-native-get-random-values` (imported first in index.js) provides
 * `crypto.getRandomValues`. Every Idempotency-Key depends on this, so a weak source would let two
 * distinct actions collapse into one server-side.
 */
type CryptoLike = {
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

export function uuidv4(): string {
  const cryptoObj = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error(
      'Secure random source unavailable: import react-native-get-random-values first.',
    );
  }
  /* eslint-disable no-bitwise -- RFC 4122 sets the version and variant bits. */
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  /* eslint-enable no-bitwise */
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
