import * as Keychain from 'react-native-keychain';
import {
  getRefreshToken,
  hasRefreshToken,
  KEYCHAIN_SERVICE,
  setRefreshToken,
} from '../secureStore';

const keychain = Keychain as unknown as {
  setGenericPassword: jest.Mock;
  getGenericPassword: jest.Mock;
  resetGenericPassword: jest.Mock;
};

beforeEach(async () => {
  jest.clearAllMocks();
  await setRefreshToken(null);
  jest.clearAllMocks();
});

describe('refresh token storage', () => {
  it('stores under the seller service, readable after first unlock and not backed up', async () => {
    await setRefreshToken('token-1');

    expect(keychain.setGenericPassword).toHaveBeenCalledWith(
      'refresh-token',
      'token-1',
      expect.objectContaining({
        service: 'com.tradevistar.seller.session',
        accessible: 'AccessibleAfterFirstUnlockThisDeviceOnly',
      }),
    );
    expect(KEYCHAIN_SERVICE).toBe('com.tradevistar.seller.session');
    await expect(getRefreshToken()).resolves.toBe('token-1');
    await expect(hasRefreshToken()).resolves.toBe(true);
  });

  it('removes the entry when set to null', async () => {
    await setRefreshToken('token-1');
    await setRefreshToken(null);

    expect(keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'com.tradevistar.seller.session',
    });
    await expect(getRefreshToken()).resolves.toBeNull();
    await expect(hasRefreshToken()).resolves.toBe(false);
  });

  it('fails loudly when the keystore refuses the write', async () => {
    keychain.setGenericPassword.mockResolvedValueOnce(false);
    await expect(setRefreshToken('t')).rejects.toThrow(
      /could not be saved securely/,
    );
  });

  it('applies writes in the order they were issued, even when the first is slow', async () => {
    const applied: string[] = [];
    keychain.setGenericPassword.mockImplementationOnce(
      async (_user: string, token: string) => {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 30));
        applied.push(token);
        return { service: 's', storage: 'x' };
      },
    );
    keychain.setGenericPassword.mockImplementationOnce(
      async (_user: string, token: string) => {
        applied.push(token);
        return { service: 's', storage: 'x' };
      },
    );

    // A rotation lands right behind the write it replaces; the stale token must never win.
    await Promise.all([setRefreshToken('old'), setRefreshToken('rotated')]);

    expect(applied).toEqual(['old', 'rotated']);
  });

  it('runs a read after the write queued before it', async () => {
    const order: string[] = [];
    keychain.setGenericPassword.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 20));
      order.push('write');
      return { service: 's', storage: 'x' };
    });
    keychain.getGenericPassword.mockImplementationOnce(async () => {
      order.push('read');
      return { username: 'refresh-token', password: 'new', service: 's' };
    });

    const [, read] = await Promise.all([
      setRefreshToken('new'),
      getRefreshToken(),
    ]);

    expect(order).toEqual(['write', 'read']);
    expect(read).toBe('new');
  });

  it('keeps working after a failed write', async () => {
    keychain.setGenericPassword.mockRejectedValueOnce(new Error('locked'));

    await expect(setRefreshToken('a')).rejects.toThrow('locked');
    await expect(setRefreshToken('b')).resolves.toBeUndefined();
    await expect(getRefreshToken()).resolves.toBe('b');
  });
});
