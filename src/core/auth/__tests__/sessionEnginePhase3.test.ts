import {
  ApiError,
  type AuthResponse,
  type AuthUser,
} from '@tradevistar/seller-api';
import { SessionEngine, type SessionDeps } from '../sessionEngine';

const seller: AuthUser = {
  id: 'u1',
  publicId: 'TV-S-1',
  email: 'seller@example.com',
  phone: null,
  firstName: 'Ravi',
  lastName: 'Shah',
  avatarUrl: null,
  roles: ['SELLER'],
  status: 'ACTIVE',
  hasBuyerProfile: false,
  hasSellerProfile: true,
};

const session = (
  user: AuthUser = seller,
  accessToken = 'access',
): AuthResponse => ({
  accessToken,
  activeRole: 'SELLER',
  user,
});

function make(overrides: Partial<SessionDeps> = {}) {
  const written: AuthUser[] = [];
  const deps: SessionDeps = {
    hasRefreshToken: jest.fn(async () => true),
    clearRefreshToken: jest.fn(async () => undefined),
    refresh: jest.fn(async () => session()),
    loginWithPassword: jest.fn(async () => session()),
    loginWithOtp: jest.fn(async () => session()),
    verifyTwoFactor: jest.fn(async () => session()),
    resendTwoFactor: jest.fn(async () => ({
      expiresInSeconds: 300,
      resendAfterSeconds: 30,
    })),
    writeCachedUser: user => {
      written.push(user);
    },
    logout: jest.fn(async () => undefined),
    setAccessToken: jest.fn(),
    ensureFreshAccessToken: jest.fn(async () => 'access'),
    clearUserData: jest.fn(),
    afterSignIn: jest.fn(async () => undefined),
    ...overrides,
  };
  return { deps, written };
}

describe('renewSession', () => {
  it('refreshes at once and keeps the new access token and profile', async () => {
    const renewedUser = { ...seller, firstName: 'Ravi K' };
    const { deps } = make();
    const engine = new SessionEngine(deps);
    await engine.start();
    (deps.refresh as jest.Mock).mockResolvedValueOnce(
      session(renewedUser, 'renewed'),
    );
    (deps.afterSignIn as jest.Mock).mockClear();

    await engine.renewSession();

    expect(deps.setAccessToken).toHaveBeenLastCalledWith('renewed');
    expect(engine.getState()).toEqual({
      status: 'signedIn',
      user: renewedUser,
      activeRole: 'SELLER',
    });
    // Renewing is not a new sign-in: push registration and the like do not run again.
    expect(deps.afterSignIn).not.toHaveBeenCalled();
  });

  it('does nothing when signed out', async () => {
    const { deps } = make({ hasRefreshToken: jest.fn(async () => false) });
    const engine = new SessionEngine(deps);
    await engine.start();
    await engine.renewSession();
    expect(deps.refresh).not.toHaveBeenCalled();
  });

  it('refuses a refreshed session that is not a seller', async () => {
    const { deps } = make();
    const engine = new SessionEngine(deps);
    await engine.start();
    (deps.refresh as jest.Mock).mockResolvedValueOnce(
      session({ ...seller, roles: ['BUYER'] }, 'buyer'),
    );
    await engine.renewSession();
    expect(engine.getState()).toMatchObject({
      status: 'signedIn',
      user: seller,
    });
    expect(deps.setAccessToken).not.toHaveBeenCalledWith('buyer');
  });

  it('lets a failed refresh surface to the caller', async () => {
    const { deps } = make();
    const engine = new SessionEngine(deps);
    await engine.start();
    (deps.refresh as jest.Mock).mockRejectedValueOnce(
      new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' }),
    );
    await expect(engine.renewSession()).rejects.toBeInstanceOf(ApiError);
    expect(engine.getState().status).toBe('signedIn');
  });
});

describe('adoptUser', () => {
  it('takes a new picture into the signed-in state and remembers it', async () => {
    const { deps, written } = make();
    const engine = new SessionEngine(deps);
    await engine.start();
    written.length = 0;

    engine.adoptUser({ ...seller, avatarUrl: 'https://cdn/a.jpg' });

    expect(engine.getState()).toMatchObject({
      status: 'signedIn',
      user: { avatarUrl: 'https://cdn/a.jpg' },
    });
    expect(written).toHaveLength(1);
  });

  it('ignores a profile for another user', async () => {
    const { deps } = make();
    const engine = new SessionEngine(deps);
    await engine.start();
    engine.adoptUser({ ...seller, id: 'someone-else', avatarUrl: 'x' });
    expect(engine.getState()).toMatchObject({
      user: { id: 'u1', avatarUrl: null },
    });
  });
});
