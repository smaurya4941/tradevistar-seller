import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { translate } from '@/i18n';

const mockEngine = { dismissApproval: jest.fn() };

jest.mock('@/core/auth/SessionProvider', () => ({
  useSessionEngine: () => mockEngine,
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

import { ApprovalStatusScreen } from '../ApprovalStatusScreen';

const t = (key: Parameters<typeof translate>[1]) => translate('en', key);

const has = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON());

async function show(approval: 'pending' | 'rejected', message: string) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <ApprovalStatusScreen approval={approval} message={message} />,
    );
  });
  return renderer;
}

beforeEach(() => jest.clearAllMocks());

describe('ApprovalStatusScreen', () => {
  it('pending: shows the server message, the steps, and a way to try again', async () => {
    const renderer = await show('pending', 'Pending approval from the admin.');

    expect(has(renderer, 'screen-approval-pending')).toBe(true);
    expect(text(renderer)).toContain('Pending approval from the admin.');
    expect(text(renderer)).toContain(t('approval.pending.step2'));
    expect(has(renderer, 'approval-retry')).toBe(true);

    await act(async () => {
      renderer.root
        .find(
          node =>
            node.props.testID === 'approval-retry' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });
    expect(mockEngine.dismissApproval).toHaveBeenCalledTimes(1);
  });

  it('pending: falls back to its own wording when the server sent none', async () => {
    const renderer = await show('pending', '  ');
    expect(text(renderer)).toContain(t('approval.pending.fallback'));
  });

  it('rejected: shows the reason and does not offer to try again', async () => {
    const renderer = await show(
      'rejected',
      'Your seller registration was not approved: GST certificate unclear',
    );

    expect(has(renderer, 'screen-approval-rejected')).toBe(true);
    expect(text(renderer)).toContain('GST certificate unclear');
    expect(has(renderer, 'approval-retry')).toBe(false);
    expect(has(renderer, 'approval-support')).toBe(true);
  });

  it('"Use another account" leaves the screen', async () => {
    const renderer = await show('rejected', 'no');
    await act(async () => {
      renderer.root
        .find(
          node =>
            node.props.testID === 'approval-other' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });
    expect(mockEngine.dismissApproval).toHaveBeenCalledTimes(1);
  });
});
