import type { FooterContent } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { translate } from '@/i18n';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockOpenURL = jest.fn(async () => undefined);
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: {
    openURL: (...args: unknown[]) => mockOpenURL(...(args as [])),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    getInitialURL: jest.fn(async () => null),
  },
}));

const mockOpenRoute = jest.fn();
jest.mock('@/app/navigation/openHref', () => ({
  openRoute: (...args: unknown[]) => mockOpenRoute(...args),
}));
jest.mock('@/app/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true },
}));

let mockSession: unknown = { status: 'signedOut', reason: 'signedOut' };
jest.mock('@/core/auth/SessionProvider', () => ({
  useSession: () => mockSession,
}));
let mockOffline = false;
jest.mock('@/core/network/useIsOffline', () => ({
  useIsOffline: () => mockOffline,
}));

const mockSendEnquiry = jest.fn();
const mockGetFooter = jest.fn();
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  sendFooterEnquiry: (...args: unknown[]) => mockSendEnquiry(...args),
  getFooter: (...args: unknown[]) => mockGetFooter(...args),
}));

import { ApiError } from '@tradevistar/seller-api';
import { ToastProvider } from '@/design';
import { queryClient } from '@/core/query/queryClient';
import { deviceStorage } from '@/core/storage/kv';
import { EnquiryForm } from '../components/EnquiryForm';
import { FooterPageBody } from '../components/FooterPageBody';
import { legalColumnHas, openLegalDocument } from '../legal';
import { openFooterLink, openFooterPage } from '../openLinks';

const t = (key: Parameters<typeof translate>[1]) => translate('en', key);

function collect(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(child => collect(child, out));
  else collect((node as { children?: unknown }).children, out);
}
const words = (renderer: ReactTestRenderer) => {
  const out: string[] = [];
  collect(renderer.toJSON(), out);
  return out.join(' ');
};
const has = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;
const field = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.find(
    node =>
      node.props.testID === id && typeof node.props.onChangeText === 'function',
  );
const button = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.find(
    node =>
      node.props.testID === id && typeof node.props.onPress === 'function',
  );

const mounted: ReactTestRenderer[] = [];

// Toast timers must not outlive the test that raised them.
afterEach(() => {
  act(() => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
});

async function mount(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ToastProvider>{element}</ToastProvider>);
  });
  mounted.push(renderer);
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockSession = { status: 'signedOut', reason: 'signedOut' };
  queryClient.clear();
  deviceStorage.clearAll();
});

describe('FooterPageBody', () => {
  it('draws headings, paragraphs, lists and bold as plain native text', async () => {
    const renderer = await mount(
      <FooterPageBody
        body={
          '## Fees\n\nWe charge **2%** commission.\n\n- Plan fee\n- GST\n\n1. Sell\n2. Get paid'
        }
      />,
    );
    const out = words(renderer);
    expect(out).toContain('Fees');
    expect(out).toContain('We charge');
    expect(out).toContain('2%');
    expect(out).toContain('Plan fee');
    expect(out).toContain('Get paid');
    expect(out).toContain('•');
    expect(out).toContain('2.');
  });

  it('opens a safe link and ignores an unsafe one', async () => {
    const renderer = await mount(
      <FooterPageBody
        body={'[Call us](tel:+911234567890) and [bad](javascript:alert)'}
      />,
    );
    const links = renderer.root.findAll(
      node =>
        node.props.accessibilityRole === 'link' &&
        typeof node.props.onPress === 'function',
    );
    const labels = new Set(
      links.map(node => {
        const out: string[] = [];
        collect(
          node.children.map(child =>
            typeof child === 'string' ? child : child.props?.children,
          ),
          out,
        );
        return out.join('');
      }),
    );
    expect([...labels]).toEqual(['Call us']);
    await act(async () => links[0].props.onPress());
    expect(mockOpenURL).toHaveBeenCalledWith('tel:+911234567890');
  });

  it('opens an /info link inside the app', async () => {
    const renderer = await mount(
      <FooterPageBody body={'[Terms](/info/terms-of-use)'} />,
    );
    const link = renderer.root.find(
      node =>
        node.props.accessibilityRole === 'link' &&
        typeof node.props.onPress === 'function',
    );
    await act(async () => link.props.onPress());
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Shared',
      params: { screen: 'InfoPage', params: { slug: 'terms-of-use' } },
    });
    expect(mockOpenURL).not.toHaveBeenCalled();
  });
});

describe('opening footer links', () => {
  it('sends outside addresses to the phone and portal paths to the app', async () => {
    await expect(
      openFooterLink({ kind: 'external', url: 'https://tradevistar.com' }),
    ).resolves.toBe(true);
    expect(mockOpenURL).toHaveBeenCalledWith('https://tradevistar.com');
    await expect(
      openFooterLink({ kind: 'site', href: '/seller/dashboard/wallet' }),
    ).resolves.toBe(true);
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Section',
      params: { sectionId: 'wallet' },
    });
  });

  it('opens a site path the app has no screen for on the web', async () => {
    await openFooterLink({ kind: 'site', href: '/pricing' });
    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://seller.tradevistar.com/pricing',
    );
  });

  it('reports false when the phone cannot open the link', async () => {
    mockOpenURL.mockRejectedValueOnce(new Error('no app'));
    await expect(
      openFooterLink({ kind: 'external', url: 'mailto:a@b.com' }),
    ).resolves.toBe(false);
  });

  it('opens a footer page as an info route', () => {
    openFooterPage('faqs');
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Shared',
      params: { screen: 'InfoPage', params: { slug: 'faqs' } },
    });
  });
});

describe('EnquiryForm', () => {
  const fill = async (renderer: ReactTestRenderer) => {
    await act(async () =>
      field(renderer, 'enquiry-name').props.onChangeText('Asha Rao'),
    );
    await act(async () =>
      field(renderer, 'enquiry-email').props.onChangeText('asha@example.com'),
    );
    await act(async () =>
      field(renderer, 'enquiry-message').props.onChangeText(
        'I need help with my account',
      ),
    );
  };

  it('works signed out and sends what was typed, trimmed, for this page', async () => {
    mockSendEnquiry.mockResolvedValue({ id: 'e1', received: true });
    const renderer = await mount(<EnquiryForm pageSlug="help-support" />);
    await fill(renderer);
    await act(async () => button(renderer, 'enquiry-send').props.onPress());
    expect(mockSendEnquiry).toHaveBeenCalledTimes(1);
    expect(mockSendEnquiry.mock.calls[0][0]).toEqual({
      pageSlug: 'help-support',
      name: 'Asha Rao',
      email: 'asha@example.com',
      message: 'I need help with my account',
    });
    expect(has(renderer, 'enquiry-sent')).toBe(true);
  });

  it('pre-fills from the signed-in seller', async () => {
    mockSession = {
      status: 'signedIn',
      user: {
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'a@b.co',
        phone: '9876543210',
      },
    };
    const renderer = await mount(<EnquiryForm pageSlug="help-support" />);
    expect(field(renderer, 'enquiry-name').props.value).toBe('Asha Rao');
    expect(field(renderer, 'enquiry-email').props.value).toBe('a@b.co');
    expect(field(renderer, 'enquiry-phone').props.value).toBe('9876543210');
  });

  it('shows what is wrong after a send attempt and sends nothing', async () => {
    const renderer = await mount(<EnquiryForm pageSlug="help-support" />);
    await act(async () => button(renderer, 'enquiry-send').props.onPress());
    expect(mockSendEnquiry).not.toHaveBeenCalled();
    const out = words(renderer);
    expect(out).toContain(t('enq.err.nameInvalid'));
    expect(out).toContain(t('enq.err.emailInvalid'));
    expect(out).toContain(t('enq.err.messageShort'));
  });

  it('checks the optional phone number against the 7 to 19 character rule', async () => {
    const renderer = await mount(<EnquiryForm pageSlug="help-support" />);
    await fill(renderer);
    await act(async () =>
      field(renderer, 'enquiry-phone').props.onChangeText('12345'),
    );
    await act(async () => button(renderer, 'enquiry-send').props.onPress());
    expect(mockSendEnquiry).not.toHaveBeenCalled();
    expect(words(renderer)).toContain(t('enq.err.phoneInvalid'));
  });

  it('keeps the form and shows the error when sending fails, reusing the key on retry', async () => {
    mockSendEnquiry
      .mockRejectedValueOnce(
        new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' }),
      )
      .mockResolvedValueOnce({ id: 'e2', received: true });
    const renderer = await mount(<EnquiryForm pageSlug="help-support" />);
    await fill(renderer);
    await act(async () => button(renderer, 'enquiry-send').props.onPress());
    expect(words(renderer)).toContain(t('enq.failed'));
    expect(field(renderer, 'enquiry-name').props.value).toBe('Asha Rao');
    await act(async () => button(renderer, 'enquiry-send').props.onPress());
    expect(mockSendEnquiry.mock.calls[1][1]).toBe(
      mockSendEnquiry.mock.calls[0][1],
    );
    expect(has(renderer, 'enquiry-sent')).toBe(true);
  });

  it("shows the server's own words for a refusal such as the rate limit", async () => {
    mockSendEnquiry.mockRejectedValue(
      new ApiError(429, {
        code: 'THROTTLED',
        message: 'Too many messages. Try again in a minute.',
      }),
    );
    const renderer = await mount(<EnquiryForm pageSlug="help-support" />);
    await fill(renderer);
    await act(async () => button(renderer, 'enquiry-send').props.onPress());
    expect(words(renderer)).toContain(
      'Too many messages. Try again in a minute.',
    );
  });

  it('cannot send while offline', async () => {
    mockOffline = true;
    const renderer = await mount(<EnquiryForm pageSlug="help-support" />);
    await fill(renderer);
    expect(button(renderer, 'enquiry-send').props.disabled).toBe(true);
    expect(words(renderer)).toContain(t('enq.offline'));
  });
});

describe('Terms and Privacy links', () => {
  const footer = (legal: string[]): FooterContent =>
    ({
      settings: {} as FooterContent['settings'],
      columns: {
        PLATFORM: [],
        COMPANY: [],
        SUPPORT: [],
        LEGAL: legal.map(slug => ({ slug, label: slug })),
      },
    } as FooterContent);

  it('reads the Legal column only', () => {
    expect(legalColumnHas(footer(['terms-of-use']), 'terms-of-use')).toBe(true);
    expect(legalColumnHas(footer(['privacy-policy']), 'terms-of-use')).toBe(
      false,
    );
    expect(legalColumnHas(null, 'terms-of-use')).toBe(false);
  });

  it('opens the in-app page when the footer lists it', async () => {
    mockGetFooter.mockResolvedValue(footer(['terms-of-use', 'privacy-policy']));
    await openLegalDocument('terms');
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Shared',
      params: { screen: 'InfoPage', params: { slug: 'terms-of-use' } },
    });
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('falls back to the environment address when the page is not in the footer', async () => {
    mockGetFooter.mockResolvedValue(footer(['something-else']));
    await openLegalDocument('privacy');
    expect(mockOpenRoute).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://seller.tradevistar.com/info/privacy-policy',
    );
  });

  it('falls back to the environment address when the footer cannot be read at all', async () => {
    mockGetFooter.mockRejectedValue(new Error('offline'));
    await openLegalDocument('terms');
    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://seller.tradevistar.com/info/terms-of-use',
    );
  });

  it('uses the saved footer when offline', async () => {
    mockGetFooter.mockRejectedValue(new Error('offline'));
    deviceStorage.set(
      'qcache.footer.content',
      JSON.stringify({
        at: Date.now() - 60_000,
        data: footer(['terms-of-use']),
      }),
    );
    await openLegalDocument('terms');
    expect(mockOpenRoute).toHaveBeenCalled();
  });
});
