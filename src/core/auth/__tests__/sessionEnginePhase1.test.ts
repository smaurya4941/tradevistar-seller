import {
  ApiError,
  type AuthResponse,
  type AuthUser,
  type TwoFactorChallenge,
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
const buyerOnly: AuthUser = { ...seller, id: 'u2', roles: ['BUYER'] };

const session = (user: AuthUser = seller): AuthResponse => ({
  accessToken: 'access',
  activeRole: user.roles[0],
  user,
});

const challenge: TwoFactorChallenge = {
  twoFactorRequired: true,
  challengeToken: 'c'.repeat(30),
  channel: 'SMS',
  destination: '******10',
  expiresInSeconds: 300,
  resendAfterSeconds: 30,
};

const approvalError = (code: string, message: string) =>
  new ApiError(403, { code, message });

function makeDeps(overrides: Partial<SessionDeps> = {}) {
  const calls: string[] = [];
  const deps: SessionDeps = {
    hasRefreshToken: jest.fn(async () => false),
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
    setAccessToken: jest.fn(),
    ensureFreshAccessToken: jest.fn(async () => 'access'),
    clearUserData: jest.fn(() => {
      calls.push('clearUserData');
    }),
    ...overrides,
  };
  return { deps, calls };
}

describe('password sign-in options', () => {
  it('passes "remember me" through, on by default', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);
    await engine.signInWithPassword('a@b.co', 'pw');
    await engine.signInWithPassword('a@b.co', 'pw', false);
    expect(deps.loginWithPassword).toHaveBeenNthCalledWith(
      1,
      'a@b.co',
      'pw',
      true,
    );
    expect(deps.loginWithPassword).toHaveBeenNthCalledWith(
      2,
      'a@b.co',
      'pw',
      false,
    );
  });
});

describe('OTP sign-in', () => {
  it('signs a seller in with a code', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);

    const outcome = await engine.signInWithOtp('9876543210', '123456');

    expect(outcome).toEqual({ kind: 'signedIn', user: seller });
    expect(deps.loginWithOtp).toHaveBeenCalledWith(
      '9876543210',
      '123456',
      true,
    );
    expect(engine.getState().status).toBe('signedIn');
  });

  it('can still ask for a different second factor', async () => {
    const { deps } = makeDeps({ loginWithOtp: jest.fn(async () => challenge) });
    const engine = new SessionEngine(deps);

    const outcome = await engine.signInWithOtp('a@b.co', '123456');

    expect(outcome).toEqual({ kind: 'twoFactorRequired', challenge });
    expect(engine.getState().status).not.toBe('signedIn');
  });

  it('lets the screen show a wrong code', async () => {
    const { deps } = makeDeps({
      loginWithOtp: jest.fn(async () => {
        throw new ApiError(401, {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired code',
        });
      }),
    });
    const engine = new SessionEngine(deps);
    await expect(
      engine.signInWithOtp('a@b.co', '000000'),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe('two-factor completion', () => {
  it('signs in once the code is accepted', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);

    const outcome = await engine.verifyTwoFactor(
      challenge.challengeToken,
      '123456',
    );

    expect(outcome).toEqual({ kind: 'signedIn', user: seller });
    expect(deps.verifyTwoFactor).toHaveBeenCalledWith(
      challenge.challengeToken,
      '123456',
    );
  });

  it('drops a session that does not belong to a seller and clears the Keychain', async () => {
    const { deps, calls } = makeDeps({
      verifyTwoFactor: jest.fn(async () => session(buyerOnly)),
    });
    const engine = new SessionEngine(deps);

    await expect(
      engine.verifyTwoFactor(challenge.challengeToken, '123456'),
    ).rejects.toThrow(/not registered as a seller/);

    expect(engine.getState().status).not.toBe('signedIn');
    expect(calls).toEqual(
      expect.arrayContaining(['logout', 'clearRefreshToken']),
    );
  });

  it('resends through the dependency', async () => {
    const { deps } = makeDeps();
    const engine = new SessionEngine(deps);
    await expect(engine.resendTwoFactor('tok')).resolves.toEqual({
      expiresInSeconds: 300,
      resendAfterSeconds: 30,
    });
  });
});

describe('approval', () => {
  const pending = approvalError(
    'SELLER_APPROVAL_PENDING',
    'Your seller account is pending approval. You can sign in once it is approved.',
  );
  const rejected = approvalError(
    'SELLER_REJECTED',
    'Your seller registration was not approved: GST certificate unclear',
  );

  it('a pending seller at sign-in moves to the approval state with the server message', async () => {
    const { deps, calls } = makeDeps({
      loginWithPassword: jest.fn(async () => {
        throw pending;
      }),
    });
    const engine = new SessionEngine(deps);

    const outcome = await engine.signInWithPassword('a@b.co', 'pw');

    expect(outcome).toEqual({
      kind: 'approval',
      approval: 'pending',
      message: pending.message,
    });
    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'approvalPending',
      message: pending.message,
    });
    // Nothing from the failed attempt stays on the device.
    expect(calls).toEqual(
      expect.arrayContaining(['clearRefreshToken', 'clearUserData']),
    );
  });

  it('a rejected seller at OTP sign-in carries the admin reason', async () => {
    const { deps } = makeDeps({
      loginWithOtp: jest.fn(async () => {
        throw rejected;
      }),
    });
    const engine = new SessionEngine(deps);

    const outcome = await engine.signInWithOtp('a@b.co', '123456');

    expect(outcome).toMatchObject({ kind: 'approval', approval: 'rejected' });
    expect(engine.getState()).toMatchObject({
      reason: 'approvalRejected',
      message: expect.stringContaining('GST certificate unclear'),
    });
  });

  it('approval at two-factor completion is handled the same way', async () => {
    const { deps } = makeDeps({
      verifyTwoFactor: jest.fn(async () => {
        throw pending;
      }),
    });
    const engine = new SessionEngine(deps);
    const outcome = await engine.verifyTwoFactor('tok', '123456');
    expect(outcome).toMatchObject({ kind: 'approval', approval: 'pending' });
  });

  it('a 403 that is not an approval code is an ordinary error', async () => {
    const { deps } = makeDeps({
      loginWithPassword: jest.fn(async () => {
        throw new ApiError(403, {
          code: 'FORBIDDEN',
          message:
            'This account has no seller access — register as a seller first',
        });
      }),
    });
    const engine = new SessionEngine(deps);
    await expect(
      engine.signInWithPassword('a@b.co', 'pw'),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(engine.getState().status).not.toBe('signedOut');
  });

  it('a stored session whose approval was withdrawn is signed out at restore', async () => {
    const { deps } = makeDeps({
      hasRefreshToken: jest.fn(async () => true),
      refresh: jest.fn(async () => {
        throw rejected;
      }),
    });
    const engine = new SessionEngine(deps);

    await engine.start();

    expect(engine.getState()).toMatchObject({
      status: 'signedOut',
      reason: 'approvalRejected',
    });
    expect(deps.clearRefreshToken).toHaveBeenCalled();
  });

  it('a session ended by the server for approval shows the right screen', async () => {
    const { deps } = makeDeps({ hasRefreshToken: jest.fn(async () => true) });
    const engine = new SessionEngine(deps);
    await engine.start();
    expect(engine.getState().status).toBe('signedIn');

    await engine.onSessionEnded('approval_pending', {
      code: 'SELLER_APPROVAL_PENDING',
      message: pending.message,
    });

    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'approvalPending',
      message: pending.message,
    });
    expect(deps.clearUserData).toHaveBeenCalled();
  });

  it('an ordinary expiry is not an approval hold', async () => {
    const { deps } = makeDeps({ hasRefreshToken: jest.fn(async () => true) });
    const engine = new SessionEngine(deps);
    await engine.start();
    await engine.onSessionEnded('refresh_rejected');
    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'expired',
    });
  });

  it('a role mismatch is reported as such', async () => {
    const { deps } = makeDeps({ hasRefreshToken: jest.fn(async () => true) });
    const engine = new SessionEngine(deps);
    await engine.start();
    await engine.onSessionEnded('role_mismatch');
    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'roleRejected',
    });
  });

  it('leaving the approval screen returns to plain sign-out, and only from there', async () => {
    const { deps } = makeDeps({
      loginWithPassword: jest.fn(async () => {
        throw pending;
      }),
    });
    const engine = new SessionEngine(deps);
    await engine.signInWithPassword('a@b.co', 'pw');

    engine.dismissApproval();
    expect(engine.getState()).toEqual({
      status: 'signedOut',
      reason: 'noSession',
    });

    // Not on the approval screen: nothing changes.
    const listener = jest.fn();
    engine.subscribe(listener);
    engine.dismissApproval();
    expect(listener).not.toHaveBeenCalled();
  });
});
