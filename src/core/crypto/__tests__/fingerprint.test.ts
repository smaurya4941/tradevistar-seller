import { fingerprint, sha256Hex } from '../fingerprint';

interface Hasher {
  update(text: string, encoding: string): { digest(format: string): string };
}
/** Node's own SHA-256, as the reference the hand-written one must match. */
const createHash = (
  jest.requireActual('crypto') as { createHash(name: string): Hasher }
).createHash;

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('matches the standard vector for %j', (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });

  it.each([
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(1000),
    'héllo wörld € \u{1F600}',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2ln',
  ])('agrees with Node crypto for %#', input => {
    expect(sha256Hex(input)).toBe(
      createHash('sha256').update(input, 'utf8').digest('hex'),
    );
  });
});

describe('fingerprint', () => {
  it('is the first 6 hex characters', () => {
    expect(fingerprint('abc')).toBe('ba7816');
  });

  it('is null without a secret', () => {
    expect(fingerprint(null)).toBeNull();
    expect(fingerprint('')).toBeNull();
  });

  it('differs for different tokens and never contains the token', () => {
    expect(fingerprint('token-one')).not.toBe(fingerprint('token-two'));
    expect(fingerprint('token-one')).not.toContain('token');
  });
});
