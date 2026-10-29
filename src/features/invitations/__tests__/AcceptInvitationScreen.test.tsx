import { ApiError } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SessionState } from '@/core/auth/sessionEngine';
import { translate } from '@/i18n';

const mockEngine = { signOut: jest.fn(async () => undefined) };
const mockNavigation = { navigate: jest.fn(), reset: jest.fn() };
let mockParams: { token?: string } | undefined;
let mockSession: SessionState;
const mockAccept = jest.fn();
const mockRefresh = jest.fn();
const mockInvalidate = jest.fn(async () => undefined);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/core/auth/SessionProvider', () => ({
  useSessionEngine: () => mockEngine,
  useSession: () => mockSession,
}));
jest.mock('@/core/query/queryClient', () => ({
  queryClient: { invalidateQueries: (...args: []) => mockInvalidate(...args) },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  acceptTeamInvitation: (...args: unknown[]) => mockAccept(...args),
  refresh: (...args: unknown[]) => mockRefresh(...args),
}));

import {
  clearInvitationToken,
  pendingInvitationStore,
} from '../pendingInvitation';
import { AcceptInvitationScreen } from '../AcceptInvitationScreen';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const signedIn: SessionState = {
  status: 'signedIn',
  activeRole: 'SELLER',
  user: {
    id: 'u1',
    publicId: null,
    email: 'invitee@example.com',
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

async function show() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<AcceptInvitationScreen />);
  });
  mounted.push(renderer);
  return renderer;
}

const has = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;
const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON());

async function press(renderer: ReactTestRenderer, id: string) {
  await act(async () => {
    renderer.root
      .find(
        node =>
          node.props.testID === id && typeof node.props.onPress === 'function',
      )
      .props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  clearInvitationToken();
  mockParams = { token: 'invite-token' };
  mockSession = signedIn;
  mockAccept.mockResolvedValue({ organizationId: 'org-1' });
  mockRefresh.mockResolvedValue({});
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

describe('AcceptInvitationScreen', () => {
  it('says the link is incomplete when there is no token', async () => {
    mockParams = undefined;
    const renderer = await show();

    expect(has(renderer, 'invite-incomplete')).toBe(true);
    expect(text(renderer)).toContain(t('invite.incomplete.title'));
  });

  it('signed out: keeps the token and offers sign-in and registration', async () => {
    mockSession = { status: 'signedOut', reason: 'noSession' };
    const renderer = await show();

    expect(has(renderer, 'invite-signed-out')).toBe(true);
    expect(pendingInvitationStore.get()).toBe('invite-token');
    await press(renderer, 'invite-sign-in');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SignIn');
    await press(renderer, 'invite-register');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('RegisterMobile');
  });

  it('signed in: shows the signed-in email and accepts', async () => {
    const renderer = await show();
    expect(text(renderer)).toContain('invitee@example.com');

    await press(renderer, 'invite-accept');

    expect(mockAccept).toHaveBeenCalledWith('invite-token');
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Main' }],
    });
    expect(pendingInvitationStore.get()).toBeNull();
  });

  it('still succeeds when the follow-up refresh fails', async () => {
    mockRefresh.mockRejectedValue(new Error('offline'));
    const renderer = await show();

    await press(renderer, 'invite-accept');

    expect(mockNavigation.reset).toHaveBeenCalled();
    expect(has(renderer, 'invite-error')).toBe(false);
  });

  it('shows the server message when the invitation is refused, with a way back', async () => {
    mockAccept.mockRejectedValue(
      new ApiError(400, {
        code: 'BAD_REQUEST',
        message: 'This invitation has expired',
      }),
    );
    const renderer = await show();

    await press(renderer, 'invite-accept');

    expect(text(renderer)).toContain('This invitation has expired');
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await press(renderer, 'invite-back');
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  });

  it('"Use a different account" signs out and keeps the token for the next sign-in', async () => {
    const renderer = await show();

    await press(renderer, 'invite-switch');

    expect(mockEngine.signOut).toHaveBeenCalled();
    expect(pendingInvitationStore.get()).toBe('invite-token');
  });
});
