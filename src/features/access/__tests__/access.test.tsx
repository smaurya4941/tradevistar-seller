import { QueryClientProvider } from '@tanstack/react-query';
import { emitSellerEvent, type AccountAccess } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SessionState } from '@/core/auth/sessionEngine';
import { queryClient, wireQueryLifecycle } from '@/core/query/queryClient';

let mockSession: SessionState = { status: 'signedOut', reason: 'noSession' };
const mockGetMyAccess = jest.fn<Promise<AccountAccess>, []>();

jest.mock('@/core/auth/SessionProvider', () => ({
  useSession: () => mockSession,
}));
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  getMyAccess: (...args: []) => mockGetMyAccess(...args),
}));

import {
  refreshAccessOnNavigation,
  resetAccessNavigation,
  useAccess,
  type AccessInfo,
} from '../useAccess';
import {
  closeVerificationSheet,
  verificationSheetStore,
  wireVerificationRefusals,
} from '../verificationSheetStore';
import { useVerifiedWrite, VerifiedButton } from '../useVerifiedWrite';

const signedIn: SessionState = {
  status: 'signedIn',
  activeRole: 'SELLER',
  user: {
    id: 'u1',
    publicId: null,
    email: 'a@b.co',
    phone: null,
    firstName: null,
    lastName: null,
    avatarUrl: null,
    roles: ['SELLER'],
    status: 'ACTIVE',
    hasBuyerProfile: false,
    hasSellerProfile: true,
  },
};

const mounted: ReactTestRenderer[] = [];

/** Lets the query answer and React re-render with it. */
async function settle() {
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 10));
  });
}

async function mount(node: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
    );
  });
  mounted.push(renderer);
  await settle();
  return renderer;
}

async function readAccess(): Promise<{ current: AccessInfo }> {
  const box = {} as { current: AccessInfo };
  function Probe() {
    box.current = useAccess();
    return null;
  }
  await mount(<Probe />);
  return box;
}

const access = (extra: Partial<AccountAccess> = {}): AccountAccess => ({
  role: 'SELLER',
  verified: false,
  kycStatus: 'PENDING',
  ...extra,
});

beforeAll(() => {
  wireQueryLifecycle();
  wireVerificationRefusals();
});

beforeEach(() => {
  queryClient.clear();
  mockGetMyAccess.mockReset();
  mockSession = signedIn;
  resetAccessNavigation();
  closeVerificationSheet();
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
  queryClient.clear();
});

describe('useAccess', () => {
  it('does not ask while signed out', async () => {
    mockSession = { status: 'signedOut', reason: 'noSession' };
    const box = await readAccess();

    expect(mockGetMyAccess).not.toHaveBeenCalled();
    expect(box.current.canWrite).toBe(true);
    expect(box.current.state).toBeNull();
  });

  it('treats verified as writable', async () => {
    mockGetMyAccess.mockResolvedValue(
      access({ verified: true, kycStatus: 'VERIFIED' }),
    );
    const box = await readAccess();

    expect(box.current.verified).toBe(true);
    expect(box.current.canWrite).toBe(true);
  });

  it('limits an unverified seller and reports the KYC status', async () => {
    mockGetMyAccess.mockResolvedValue(access({ kycStatus: 'SUBMITTED' }));
    const box = await readAccess();

    expect(box.current.canWrite).toBe(false);
    expect(box.current.state).toBe('underReview');
    expect(box.current.kycStatus).toBe('SUBMITTED');
  });

  it('applies no gating when the role is null', async () => {
    mockGetMyAccess.mockResolvedValue(access({ role: null, kycStatus: null }));
    const box = await readAccess();

    expect(box.current.canWrite).toBe(true);
    expect(box.current.state).toBeNull();
  });

  it('applies no gating while the answer is unknown or failed', async () => {
    mockGetMyAccess.mockRejectedValue(new Error('offline'));
    const box = await readAccess();

    expect(box.current.access).toBeNull();
    expect(box.current.canWrite).toBe(true);
  });

  it('re-reads when the screen in front changes, but not for the first screen or the same one', async () => {
    mockGetMyAccess.mockResolvedValue(access());
    await readAccess();
    mockGetMyAccess.mockClear();

    await act(async () => {
      refreshAccessOnNavigation('Home');
    });
    expect(mockGetMyAccess).not.toHaveBeenCalled();

    await act(async () => {
      refreshAccessOnNavigation('Home');
      refreshAccessOnNavigation('Orders');
    });
    expect(mockGetMyAccess).toHaveBeenCalledTimes(1);
  });

  it('sees the seller become verified after a refusal-triggered re-read', async () => {
    mockGetMyAccess.mockResolvedValue(access());
    const box = await readAccess();
    expect(box.current.canWrite).toBe(false);

    mockGetMyAccess.mockResolvedValue(
      access({ verified: true, kycStatus: 'VERIFIED' }),
    );
    await act(async () => {
      emitSellerEvent('access:verification-required', {
        code: 'ACCOUNT_VERIFICATION_REQUIRED',
        message: 'x',
        details: { role: 'SELLER', kycStatus: 'PENDING' },
      });
    });
    await settle();

    expect(box.current.canWrite).toBe(true);
  });
});

describe('an unexpected verification refusal', () => {
  it('opens the same sheet using the status in the error', async () => {
    await act(async () => {
      emitSellerEvent('access:verification-required', {
        code: 'ACCOUNT_VERIFICATION_REQUIRED',
        message: 'x',
        details: { role: 'SELLER', kycStatus: 'REJECTED' },
      });
    });

    expect(verificationSheetStore.get()).toEqual({
      open: true,
      kycStatus: 'REJECTED',
    });
  });
});

describe('write guard', () => {
  it('runs the action for a verified seller', async () => {
    mockGetMyAccess.mockResolvedValue(access({ verified: true }));
    const action = jest.fn();
    function Probe() {
      const { guard } = useVerifiedWrite();
      return (
        <VerifiedButton label="Save" onPress={guard(action)} testID="save" />
      );
    }
    const renderer = await mount(<Probe />);

    await act(async () => {
      renderer.root.findByProps({ testID: 'save' }).props.onPress();
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(verificationSheetStore.get().open).toBe(false);
  });

  it('opens the sheet instead of acting for a view-only seller', async () => {
    mockGetMyAccess.mockResolvedValue(access({ kycStatus: 'SUBMITTED' }));
    const action = jest.fn();
    const renderer = await mount(
      <VerifiedButton label="Save" onPress={action} testID="save" />,
    );

    await act(async () => {
      renderer.root.findByProps({ testID: 'save-locked' }).props.onPress();
    });

    expect(action).not.toHaveBeenCalled();
    expect(verificationSheetStore.get()).toEqual({
      open: true,
      kycStatus: 'SUBMITTED',
    });
  });

  it('keeps a button enabled when it writes to an area unverified sellers may use', async () => {
    mockGetMyAccess.mockResolvedValue(access());
    const action = jest.fn();
    const renderer = await mount(
      <VerifiedButton
        label="Upload"
        onPress={action}
        path="/me/kyc/documents"
        testID="upload"
      />,
    );

    expect(
      renderer.root.findAllByProps({ testID: 'upload-locked' }),
    ).toHaveLength(0);
  });

  it('guard() blocks and explains for a view-only seller', async () => {
    mockGetMyAccess.mockResolvedValue(access());
    const action = jest.fn();
    const box = {} as { run: () => void };
    function Probe() {
      const { guard } = useVerifiedWrite();
      box.run = guard(action);
      return null;
    }
    await mount(<Probe />);

    await act(async () => {
      box.run();
    });

    expect(action).not.toHaveBeenCalled();
    expect(verificationSheetStore.get().open).toBe(true);
  });
});
