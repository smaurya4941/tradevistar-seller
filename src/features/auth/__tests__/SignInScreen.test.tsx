import { ApiError } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SessionState } from '@/core/auth/sessionEngine';
import { translate } from '@/i18n';
import {
  clearInvitationToken,
  holdInvitationToken,
} from '@/features/invitations/pendingInvitation';

const mockAuth = { signIn: jest.fn() };
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => false,
  reset: jest.fn(),
};
let mockParams: Record<string, unknown> | undefined;
let mockSession: SessionState = { status: 'signedOut', reason: 'noSession' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('../AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('@/core/auth/SessionProvider', () => ({
  useSession: () => mockSession,
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import { SignInScreen } from '../SignInScreen';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

/** The host (native) node with a testID; composite wrappers share the same id. */
function host(renderer: ReactTestRenderer, id: string) {
  return renderer.root.find(
    node => node.props.testID === id && typeof node.type === 'string',
  );
}

const has = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;

function textOf(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

const mounted: ReactTestRenderer[] = [];

async function render(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<SignInScreen />);
  });
  mounted.push(renderer);
  return renderer;
}

async function fill(renderer: ReactTestRenderer, id: string, value: string) {
  await act(async () => {
    host(renderer, id).props.onChangeText(value);
  });
}

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

const submit = (renderer: ReactTestRenderer) =>
  press(renderer, 'sign-in-submit');

async function signInWith(renderer: ReactTestRenderer, password = 'secret') {
  await fill(renderer, 'sign-in-identifier', 'seller@example.com');
  await fill(renderer, 'sign-in-password', password);
  await submit(renderer);
}

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockSession = { status: 'signedOut', reason: 'noSession' };
  clearInvitationToken();
});

describe('SignInScreen', () => {
  it('asks for both fields without calling the API', async () => {
    const renderer = await render();

    await submit(renderer);

    expect(textOf(renderer)).toContain(t('auth.required.identifier'));
    expect(textOf(renderer)).toContain(t('auth.required.password'));
    expect(mockAuth.signIn).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed identifier, the password as typed, and remember-me on', async () => {
    mockAuth.signIn.mockResolvedValue({ kind: 'signedIn' });
    const renderer = await render();

    await fill(renderer, 'sign-in-identifier', '  seller@example.com ');
    await fill(renderer, 'sign-in-password', ' pass word ');
    await submit(renderer);

    expect(mockAuth.signIn).toHaveBeenCalledWith(
      'seller@example.com',
      ' pass word ',
      true,
    );
  });

  it('can sign in without being remembered', async () => {
    mockAuth.signIn.mockResolvedValue({ kind: 'signedIn' });
    const renderer = await render();

    await press(renderer, 'sign-in-remember');
    await signInWith(renderer);

    expect(mockAuth.signIn).toHaveBeenCalledWith(
      'seller@example.com',
      'secret',
      false,
    );
  });

  it('never says which part of a failed sign-in was wrong', async () => {
    mockAuth.signIn.mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHORIZED', message: 'No such user' }),
    );
    const renderer = await render();

    await signInWith(renderer, 'wrong');

    const text = textOf(renderer);
    expect(text).toContain(t('error.invalidCredentials'));
    expect(text).not.toContain('No such user');
  });

  it('shows the server message for a buyer-only account and offers to create a seller account', async () => {
    mockAuth.signIn.mockRejectedValue(
      new ApiError(403, {
        code: 'FORBIDDEN',
        message:
          'This account has no seller access — register as a seller first',
      }),
    );
    const renderer = await render();

    await signInWith(renderer);

    expect(textOf(renderer)).toContain('This account has no seller access');
    await press(renderer, 'auth-error-create');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('RegisterMobile');
  });

  it('shows the lockout message with reset and support links', async () => {
    mockAuth.signIn.mockRejectedValue(
      new ApiError(423, {
        code: 'ACCOUNT_LOCKED',
        message: 'Locked until 10:30.',
      }),
    );
    const renderer = await render();

    await signInWith(renderer);

    expect(textOf(renderer)).toContain('Locked until 10:30.');
    expect(has(renderer, 'auth-error-reset')).toBe(true);
    expect(has(renderer, 'auth-error-support')).toBe(true);
  });

  it('cools down after too many attempts', async () => {
    mockAuth.signIn.mockRejectedValue(
      new ApiError(429, { code: 'THROTTLED', message: 'ThrottlerException' }),
    );
    const renderer = await render();

    await signInWith(renderer);

    expect(textOf(renderer)).toContain(t('error.tooManyAttempts'));
    mockAuth.signIn.mockClear();
    await submit(renderer);
    expect(mockAuth.signIn).not.toHaveBeenCalled();
  });

  it('moves to the two-factor screen and clears the password', async () => {
    mockAuth.signIn.mockResolvedValue({
      kind: 'twoFactorRequired',
      challenge: { twoFactorRequired: true },
    });
    const renderer = await render();

    await signInWith(renderer);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('TwoFactor');
    expect(host(renderer, 'sign-in-password').props.value).toBe('');
  });

  it('shows no error when approval is pending: the session state takes over', async () => {
    mockAuth.signIn.mockResolvedValue({
      kind: 'approval',
      approval: 'pending',
      message: 'pending',
    });
    const renderer = await render();

    await signInWith(renderer);

    expect(has(renderer, 'sign-in-error')).toBe(false);
  });

  it('keeps what was typed when the network is down', async () => {
    mockAuth.signIn.mockRejectedValue(
      new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' }),
    );
    const renderer = await render();

    await signInWith(renderer);

    expect(textOf(renderer)).toContain(t('error.network'));
    expect(host(renderer, 'sign-in-identifier').props.value).toBe(
      'seller@example.com',
    );
    expect(host(renderer, 'sign-in-password').props.value).toBe('secret');
  });

  it('links to sign-in with a code, forgot password and registration', async () => {
    const renderer = await render();

    await press(renderer, 'sign-in-otp-link');
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('SignInOtp', {
      identifier: '',
    });
    await press(renderer, 'sign-in-forgot');
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('ForgotPassword', {
      identifier: '',
    });
    await press(renderer, 'sign-in-register');
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('RegisterMobile');
  });

  it('prefills the identifier and shows the password-updated notice after a reset', async () => {
    mockParams = { identifier: 'seller@example.com', notice: 'passwordReset' };
    const renderer = await render();

    expect(host(renderer, 'sign-in-identifier').props.value).toBe(
      'seller@example.com',
    );
    expect(textOf(renderer)).toContain(t('auth.passwordUpdated'));
  });

  it('tells a seller who followed an invitation which email to use', async () => {
    holdInvitationToken('invite-token');
    const renderer = await render();

    expect(textOf(renderer)).toContain(t('auth.invitation.hint'));
  });

  it('shows why the seller was signed out', async () => {
    mockSession = { status: 'signedOut', reason: 'expired' };
    const renderer = await render();

    expect(textOf(renderer)).toContain(t('auth.reason.expired'));
  });

  it('shows nothing extra on a plain first launch', async () => {
    const renderer = await render();

    expect(has(renderer, 'sign-in-reason')).toBe(false);
    expect(has(renderer, 'sign-in-notice')).toBe(false);
  });

  it('hides the password until asked', async () => {
    const renderer = await render();

    expect(host(renderer, 'sign-in-password').props.secureTextEntry).toBe(true);
    await act(async () => {
      renderer.root
        .find(
          node =>
            node.props.accessibilityLabel === t('password.show') &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });
    expect(host(renderer, 'sign-in-password').props.secureTextEntry).toBe(
      false,
    );
  });
});
