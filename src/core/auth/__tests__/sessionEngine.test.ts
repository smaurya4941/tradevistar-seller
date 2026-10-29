import {
  ApiError,
  type AuthResponse,
  type AuthUser,
  type TwoFactorChallenge,
} from '@tradevistar/seller-api';
import {
  FOREGROUND_REFRESH_AHEAD_MS,
  NotASellerError,
  SessionEngine,
  type SessionDeps,
  type SessionState,
} from '../sessionEngine';

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

const buyerOnly: AuthUser = { ...seller, id: 'u2', roles: ['BUYER'] };

const session = (user: AuthUser = seller): AuthResponse => ({
  accessToken: 'access',
  activeRole: user.roles[0],
  user,
});

function makeDeps(overrides: Partial<SessionDeps> = {}) {
  const calls: string[] = [];
  const deps: SessionDeps = {
    hasRefreshToken: jest.fn(async () => true),
    clearRefreshToken: jest.fn(async () => {
      calls.push('clearRefreshToken');
    }),
    refresh: jest.fn(async () => session()),
    loginWithPassword: jest.fn(async () => session()),
    loginWithOtp: jest.fn(async () => session()),
    verifyTwoFactor: jest.fn(async () => session()),
    resendTwoFactor: jest.fn(async () => ({
      expiresInSeconds: 300,
      resendAfterSeconds: 30,
    })),
    logout: jest.fn(async () => {
      calls.push('logout');
    }),
    setAccessToken: jest.fn((token: string | null) => {
      if (token === null) calls.push('clearAccessToken');
    }),
    ensureFreshAccessToken: jest.fn(async () => 'access'),
    clearUserData: jest.fn(() => {
      calls.push('clearUserData');
    }),
    afterSignIn: jest.fn(async () => undefined),
    beforeSignOut: jest.fn(async () => {
      calls.push('beforeSignOut');
    }),
    ...overrides,
  };
  return { deps, calls };
}

const apiError = (status: number, code = 'ERR') =>
  new ApiError(status, { code, message: 'x' });

describe('restore at launch', () => {
  it('restores a stored seller session', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toEqual({
      status: 'signedIn',
      user: seller,
      activeRole: 'SELLER',
    });
    expect(deps.setAccessToken).toHaveBeenCalledWith('access');
    expect(deps.afterSignIn).toHaveBeenCalledWith(seller);
  });

  it('is signed out without calling the API when nothing is stored', async () => {
    const { deps } = makeDeps({ hasRefreshToken: jest.fn(async () => false) });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'noSession',
    });
    expect(deps.refresh).not.toHaveBeenCalled();
  });

  it('starts in the restoring state', () => {
    const engine = new SessionEngine(makeDeps().deps);
    expect(engine.getState()).toEqual({ status: 'restoring' });
  });

  it('shares one run between concurrent starts', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);

    await Promise.all([engine.start(), engine.start(), engine.retry()]);

    expect(deps.refresh).toHaveBeenCalledTimes(1);
  });

  it('wipes everything and signs out when the refresh token is rejected', async () => {
    const { deps, calls } = makeDeps({
      refresh: jest.fn(async () => {
        throw apiError(401, 'INVALID_REFRESH');
      }),
    });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'expired',
    });
    expect(calls).toEqual([
      'clearAccessToken',
      'clearRefreshToken',
      'clearUserData',
    ]);
  });

  it('stays signed in (offline) when the network is down, keeping the stored token', async () => {
    const { deps } = makeDeps({
      refresh: jest.fn(async () => {
        throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' });
      }),
      readCachedUser: () => seller,
    });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toMatchObject({
      status: 'offline',
      user: seller,
    });
    expect(deps.clearRefreshToken).not.toHaveBeenCalled();
  });

  it.each([500, 503, 429])(
    'treats a %s as temporary, not as a sign-out',
    async status => {
      const { deps } = makeDeps({
        refresh: jest.fn(async () => {
          throw apiError(status);
        }),
      });
      const engine = new SessionEngine(deps);

      await engine.start();

      expect(engine.getState().status).toBe('offline');
      expect(deps.clearRefreshToken).not.toHaveBeenCalled();
    },
  );

  it('does not offer a cached user who is not a seller', async () => {
    const { deps } = makeDeps({
      refresh: jest.fn(async () => {
        throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' });
      }),
      readCachedUser: () => buyerOnly,
    });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toMatchObject({ status: 'offline', user: null });
  });

  it('retries a restore once the network is back', async () => {
    let online = false;
    const { deps } = makeDeps({
      refresh: jest.fn(async () => {
        if (!online)
          throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' });
        return session();
      }),
    });
    const engine = new SessionEngine(deps);
    await engine.start();
    expect(engine.getState().status).toBe('offline');

    online = true;
    await engine.onForeground();

    expect(engine.getState().status).toBe('signedIn');
  });

  it('signs out with roleRejected when the client refuses a non-seller refresh', async () => {
    const { deps } = makeDeps({
      refresh: jest.fn(async () => {
        throw apiError(403, 'ROLE_NOT_ALLOWED');
      }),
    });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'roleRejected',
    });
    expect(deps.clearRefreshToken).toHaveBeenCalled();
  });

  it('wipes the Keychain when it cannot be read', async () => {
    const { deps } = makeDeps({
      hasRefreshToken: jest.fn(async () => {
        throw new Error('keystore corrupt');
      }),
    });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'noSession',
    });
    expect(deps.clearRefreshToken).toHaveBeenCalled();
  });

  it('remembers the user for the next offline launch', async () => {
    const writeCachedUser = jest.fn();
    const engine = new SessionEngine(makeDeps({ writeCachedUser }).deps);

    await engine.start();

    expect(writeCachedUser).toHaveBeenCalledWith(seller);
  });
});

describe('sign-in', () => {
  it('signs a seller in', async () => {
    const { deps } = makeDeps({ hasRefreshToken: jest.fn(async () => false) });
    const engine = new SessionEngine(deps);
    await engine.start();

    const outcome = await engine.signInWithPassword('seller@example.com', 'pw');

    expect(outcome).toEqual({ kind: 'signedIn', user: seller });
    expect(engine.getState().status).toBe('signedIn');
    expect(deps.loginWithPassword).toHaveBeenCalledWith(
      'seller@example.com',
      'pw',
      true,
    );
  });

  it('rejects a buyer-only account, revokes it and keeps nothing', async () => {
    const { deps, calls } = makeDeps({
      loginWithPassword: jest.fn(async () => session(buyerOnly)),
    });
    const engine = new SessionEngine(deps);

    await expect(
      engine.signInWithPassword('b@example.com', 'pw'),
    ).rejects.toBeInstanceOf(NotASellerError);

    expect(engine.getState().status).not.toBe('signedIn');
    expect(calls).toContain('logout');
    expect(calls).toContain('clearRefreshToken');
    expect(calls).toContain('clearUserData');
    expect(deps.afterSignIn).not.toHaveBeenCalled();
  });

  it('reports a second factor without signing in', async () => {
    const challenge: TwoFactorChallenge = {
      twoFactorRequired: true,
      challengeToken: 'c'.repeat(30),
      channel: 'SMS',
      destination: '+91******10',
    };
    const { deps } = makeDeps({
      loginWithPassword: jest.fn(async () => challenge),
    });
    const engine = new SessionEngine(deps);

    const outcome = await engine.signInWithPassword('s@example.com', 'pw');

    expect(outcome).toEqual({ kind: 'twoFactorRequired', challenge });
    expect(engine.getState().status).not.toBe('signedIn');
    expect(deps.setAccessToken).not.toHaveBeenCalledWith('access');
  });

  it('lets the screen show the API error', async () => {
    const { deps } = makeDeps({
      loginWithPassword: jest.fn(async () => {
        throw apiError(401);
      }),
    });
    const engine = new SessionEngine(deps);

    await expect(
      engine.signInWithPassword('s@example.com', 'bad'),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('does not let a failing post-sign-in task break sign-in', async () => {
    const { deps } = makeDeps({
      afterSignIn: jest.fn(async () => {
        throw new Error('boom');
      }),
    });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState().status).toBe('signedIn');
  });
});

describe('foreground and server-ended sessions', () => {
  it('refreshes ahead of expiry when the app returns', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);
    await engine.start();

    await engine.onForeground();

    expect(deps.ensureFreshAccessToken).toHaveBeenCalledWith(
      FOREGROUND_REFRESH_AHEAD_MS,
    );
  });

  it('survives a failed foreground refresh', async () => {
    const { deps } = makeDeps({
      ensureFreshAccessToken: jest.fn(async () => {
        throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' });
      }),
    });
    const engine = new SessionEngine(deps);
    await engine.start();

    await expect(engine.onForeground()).resolves.toBeUndefined();
    expect(engine.getState().status).toBe('signedIn');
  });

  it('does nothing on foreground when signed out', async () => {
    const { deps } = makeDeps({ hasRefreshToken: jest.fn(async () => false) });
    const engine = new SessionEngine(deps);
    await engine.start();

    await engine.onForeground();

    expect(deps.ensureFreshAccessToken).not.toHaveBeenCalled();
  });

  it('signs out cleanly when the server ends the session (revoked from the web)', async () => {
    const { deps, calls } = makeDeps();
    const engine = new SessionEngine(deps);
    await engine.start();
    calls.length = 0;

    await engine.onSessionEnded();

    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'expired',
    });
    expect(calls).toEqual([
      'clearAccessToken',
      'clearRefreshToken',
      'clearUserData',
    ]);
    // The server already ended it: no logout call that would only 401.
    expect(deps.logout).not.toHaveBeenCalled();
  });

  it('ignores a session-ended signal while signed out', async () => {
    const { deps } = makeDeps({ hasRefreshToken: jest.fn(async () => false) });
    const engine = new SessionEngine(deps);
    await engine.start();
    const states: SessionState[] = [];
    engine.subscribe(state => states.push(state));

    await engine.onSessionEnded();

    expect(states).toHaveLength(0);
  });
});

describe('sign-out', () => {
  it('revokes server-side, then wipes the Keychain, cache and preferences', async () => {
    const { deps, calls } = makeDeps();
    const engine = new SessionEngine(deps);
    await engine.start();
    calls.length = 0;

    await engine.signOut();

    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'signedOut',
    });
    expect(calls).toEqual([
      'beforeSignOut',
      'logout',
      'clearAccessToken',
      'clearRefreshToken',
      'clearUserData',
    ]);
  });

  it('signs out locally even when the server cannot be reached', async () => {
    const { deps } = makeDeps({
      logout: jest.fn(async () => {
        throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' });
      }),
    });
    const engine = new SessionEngine(deps);
    await engine.start();

    await engine.signOut();

    expect(engine.getState().status).toBe('signedOut');
    expect(deps.clearRefreshToken).toHaveBeenCalled();
  });

  it('shares one run between concurrent sign-outs', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);
    await engine.start();

    await Promise.all([engine.signOut(), engine.signOut()]);

    expect(deps.logout).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers of every state change and lets them unsubscribe', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);
    const seen: string[] = [];
    const stop = engine.subscribe(state => seen.push(state.status));

    await engine.start();
    stop();
    await engine.signOut();

    expect(seen).toEqual(['restoring', 'signedIn']);
  });
});
