import glyphs from '@/design/icons/glyphMap';
import { translate } from '@/i18n';
import {
  isPublicRoute,
  portalPathFromUrl,
  queryParam,
  routeForUrl,
  routeForHref,
  routeForSearch,
  routeForSection,
  routeForWebPath,
  TAB_WEB_PATHS,
  webHostOf,
  webPathForSection,
} from '../routeMapping';
import { allSections, MORE_GROUPS } from '../sections';

const HOST = 'seller.tradevistar.com';

describe('routeForWebPath', () => {
  it('maps the dashboard to Home', () => {
    expect(routeForWebPath('/seller/dashboard')).toEqual({
      name: 'Main',
      params: { screen: 'Home' },
    });
  });

  it.each([
    ['/seller/dashboard/orders', 'Orders'],
    ['/seller/dashboard/orders/ord_123', 'Orders'],
    ['/seller/dashboard/products', 'Products'],
    ['/seller/dashboard/products/new', 'Products'],
    ['/seller/dashboard/messages', 'Inbox'],
  ])('maps %s to the %s tab', (path, screen) => {
    expect(routeForWebPath(path)).toEqual({ name: 'Main', params: { screen } });
  });

  it('maps a More-menu area to its section', () => {
    expect(routeForWebPath('/seller/dashboard/inventory')).toEqual({
      name: 'Section',
      params: { sectionId: 'inventory' },
    });
    expect(
      routeForWebPath('/seller/dashboard/marketing/ads-campaigns/new'),
    ).toEqual({
      name: 'Section',
      params: { sectionId: 'adsCampaigns' },
    });
  });

  it('ignores a trailing slash, a query and a fragment', () => {
    expect(
      routeForWebPath('/seller/dashboard/wallet/?tab=history#top'),
    ).toEqual({
      name: 'Section',
      params: { sectionId: 'wallet' },
    });
  });

  it('does not match a path that merely starts with the same letters', () => {
    expect(routeForWebPath('/seller/dashboard/ordersX')).toBeNull();
  });

  it('returns null for pages the app has no screen for', () => {
    expect(routeForWebPath('/seller/register')).toBeNull();
    expect(routeForWebPath('/')).toBeNull();
  });
});

describe('links', () => {
  it('reads the portal https URL', () => {
    expect(
      portalPathFromUrl(
        'https://seller.tradevistar.com/seller/dashboard/orders?x=1',
        HOST,
      ),
    ).toBe('/seller/dashboard/orders');
  });

  it('reads the custom scheme', () => {
    expect(
      portalPathFromUrl('tradevistarseller://dashboard/orders', HOST),
    ).toBe('/seller/dashboard/orders');
    expect(routeForUrl('tradevistarseller://dashboard', HOST)).toEqual({
      name: 'Main',
      params: { screen: 'Home' },
    });
  });

  it('never navigates for another host or scheme', () => {
    expect(
      routeForUrl('https://evil.example.com/seller/dashboard/orders', HOST),
    ).toBeNull();
    expect(routeForUrl('tradevistar://orders', HOST)).toBeNull();
    expect(routeForUrl('not a url', HOST)).toBeNull();
    expect(routeForUrl('tradevistarseller://', HOST)).toBeNull();
  });

  it('compares hosts case-insensitively', () => {
    expect(
      routeForUrl(
        'https://SELLER.tradevistar.com/seller/dashboard/wallet',
        HOST,
      ),
    ).toEqual({
      name: 'Section',
      params: { sectionId: 'wallet' },
    });
  });

  it('extracts the host from the configured web origin', () => {
    expect(webHostOf('https://seller.example.com/')).toBe('seller.example.com');
    expect(webHostOf('http://10.0.2.2:3001')).toBe('10.0.2.2:3001');
    expect(webHostOf('nonsense')).toBe('');
  });
});

describe('the More menu', () => {
  it('has the six groups, each with items', () => {
    expect(MORE_GROUPS.map(group => group.id)).toEqual([
      'catalog',
      'sales',
      'money',
      'marketing',
      'company',
      'support',
    ]);
    for (const group of MORE_GROUPS)
      expect(group.items.length).toBeGreaterThan(0);
  });

  it('has unique section ids and unique, rooted web paths', () => {
    const sections = allSections();
    expect(new Set(sections.map(s => s.id)).size).toBe(sections.length);
    expect(new Set(sections.map(s => s.webPath)).size).toBe(sections.length);
    for (const section of sections) {
      expect(section.webPath.startsWith('/seller/dashboard/')).toBe(true);
    }
  });

  it('every section routes back to itself from its own web path', () => {
    for (const section of allSections()) {
      // Areas with a real screen open it; the rest open their placeholder section.
      expect(routeForWebPath(section.webPath)).toEqual(
        routeForSection(section.id),
      );
      expect(webPathForSection(section.id)).toBe(section.webPath);
    }
  });

  it('uses only icons that exist in the font, and labels that exist in the messages', () => {
    for (const section of allSections()) {
      expect(glyphs[section.icon]).toBeDefined();
      expect(translate('en', section.labelKey)).not.toBe(section.labelKey);
    }
    for (const group of MORE_GROUPS) {
      expect(translate('en', group.labelKey)).not.toBe(group.labelKey);
    }
  });

  it('keeps tab paths distinct from section paths', () => {
    const tabPaths = Object.values(TAB_WEB_PATHS);
    for (const section of allSections()) {
      expect(tabPaths).not.toContain(section.webPath);
    }
  });
});

describe('Phase 1 links', () => {
  it('opens an invitation link with its token, from the portal URL and the custom scheme', () => {
    const expected = { name: 'AcceptInvitation', params: { token: 'abc123' } };
    expect(
      routeForUrl(
        `https://${HOST}/seller/invitations/accept?token=abc123`,
        HOST,
      ),
    ).toEqual(expected);
    expect(
      routeForUrl('tradevistarseller://invitations/accept?token=abc123', HOST),
    ).toEqual(expected);
  });

  it('decodes the token and keeps a link without one so the screen can say it is incomplete', () => {
    expect(
      routeForUrl(
        `https://${HOST}/seller/invitations/accept?token=a%2Bb%3D&x=1`,
        HOST,
      ),
    ).toEqual({ name: 'AcceptInvitation', params: { token: 'a+b=' } });
    expect(
      routeForUrl(`https://${HOST}/seller/invitations/accept`, HOST),
    ).toEqual({ name: 'AcceptInvitation', params: { token: undefined } });
    expect(
      routeForUrl(`https://${HOST}/seller/invitations/accept?token=`, HOST),
    ).toEqual({ name: 'AcceptInvitation', params: { token: undefined } });
  });

  it('opens registration with a staff onboarding invitation', () => {
    expect(
      routeForUrl(
        `https://${HOST}/seller/register?onboardingInvite=tok-1`,
        HOST,
      ),
    ).toEqual({
      name: 'RegisterMobile',
      params: { onboardingInvite: 'tok-1' },
    });
    expect(routeForUrl(`https://${HOST}/seller/register`, HOST)).toEqual({
      name: 'RegisterMobile',
      params: { onboardingInvite: undefined },
    });
  });

  it('reads query parameters wherever they sit', () => {
    expect(queryParam('x://h/p?a=1&token=t&b=2#frag', 'token')).toBe('t');
    expect(queryParam('x://h/p?a=1', 'token')).toBeUndefined();
    expect(queryParam('x://h/p', 'token')).toBeUndefined();
  });

  it('knows which routes open without a session', () => {
    expect(isPublicRoute({ name: 'AcceptInvitation', params: {} })).toBe(true);
    expect(isPublicRoute({ name: 'RegisterMobile', params: {} })).toBe(true);
    expect(isPublicRoute({ name: 'Main', params: { screen: 'Home' } })).toBe(
      false,
    );
  });

  it('ignores another host', () => {
    expect(
      routeForUrl(
        'https://evil.example/seller/invitations/accept?token=x',
        HOST,
      ),
    ).toBeNull();
  });
});

describe('Phase 2 links', () => {
  it.each([
    [
      '/seller/dashboard/analytics',
      { name: 'Shared', params: { screen: 'Analytics' } },
    ],
    [
      '/seller/dashboard/notifications',
      { name: 'Main', params: { screen: 'Inbox' } },
    ],
    [
      '/seller/dashboard/support',
      { name: 'Shared', params: { screen: 'SupportHome' } },
    ],
    [
      '/seller/dashboard/settings',
      { name: 'Shared', params: { screen: 'AppSettings' } },
    ],
    [
      '/seller/dashboard/profile/notifications',
      { name: 'Shared', params: { screen: 'NotificationSettings' } },
    ],
    [
      '/info/terms-of-use',
      {
        name: 'Shared',
        params: { screen: 'InfoPage', params: { slug: 'terms-of-use' } },
      },
    ],
    [
      '/seller/info/privacy-policy',
      {
        name: 'Shared',
        params: { screen: 'InfoPage', params: { slug: 'privacy-policy' } },
      },
    ],
    ['/info', { name: 'Shared', params: { screen: 'HelpAbout' } }],
  ])('maps %s', (path, route) => {
    expect(routeForWebPath(path)).toEqual(route);
  });

  it.each([
    ['/seller/dashboard/profile', 'ProfileHub'],
    ['/seller/dashboard/profile/account', 'AccountDetails'],
    ['/seller/dashboard/profile/business', 'BusinessDetails'],
    ['/seller/dashboard/profile/addresses', 'Addresses'],
    ['/seller/dashboard/profile/tax', 'TaxGst'],
    ['/seller/dashboard/profile/documents', 'Documents'],
    ['/seller/dashboard/profile/bank', 'Bank'],
    ['/seller/dashboard/profile/team', 'Team'],
    ['/seller/dashboard/profile/calendar', 'Calendar'],
    ['/seller/dashboard/profile/security', 'Security'],
    ['/seller/dashboard/profile/notifications', 'NotificationSettings'],
    ['/seller/dashboard/export-documents', 'Documents'],
    // A profile page the app has no screen for lands on the hub instead of a dead end.
    ['/seller/dashboard/profile/unknown-page', 'ProfileHub'],
  ])('maps the profile page %s to %s', (path, screen) => {
    expect(routeForWebPath(path)).toEqual({
      name: 'Shared',
      params: { screen },
    });
  });

  it('maps the profile checklist links the backend sends', () => {
    for (const href of [
      '/seller/dashboard/profile/business',
      '/seller/dashboard/profile/account',
      '/seller/dashboard/profile/tax',
      '/seller/dashboard/profile/bank',
      '/seller/dashboard/profile/documents',
      '/seller/dashboard/profile/addresses',
    ]) {
      expect(routeForHref(href)?.name).toBe('Shared');
    }
  });

  it('opens the real screens from the More menu entries', () => {
    expect(routeForSection('profile')).toEqual({
      name: 'Shared',
      params: { screen: 'ProfileHub' },
    });
    expect(routeForSection('exportDocuments')).toEqual({
      name: 'Shared',
      params: { screen: 'Documents' },
    });
  });

  it('opens a support ticket from its link', () => {
    expect(routeForHref('/seller/dashboard/support?ticket=t-1')).toEqual({
      name: 'Shared',
      params: { screen: 'TicketThread', params: { ticketId: 't-1' } },
    });
  });

  it('carries the query to the tab or section that will read it', () => {
    expect(routeForHref('/seller/dashboard/orders?order=o-1')).toEqual({
      name: 'Main',
      params: { screen: 'Orders', query: { order: 'o-1' } },
    });
    expect(routeForHref('/seller/dashboard/orders?buyer=b-9')).toEqual({
      name: 'Main',
      params: { screen: 'Orders', query: { buyer: 'b-9' } },
    });
    expect(routeForHref('/seller/dashboard/products?q=Steel%20pipe')).toEqual({
      name: 'Main',
      params: { screen: 'Products', query: { q: 'Steel pipe' } },
    });
    expect(routeForHref('/seller/dashboard/inquiries?rfq=r-2')).toEqual({
      name: 'Section',
      params: { sectionId: 'inquiries', query: { rfq: 'r-2' } },
    });
    expect(routeForHref('/seller/dashboard/wallet?txn=t-3#x')).toEqual({
      name: 'Section',
      params: { sectionId: 'wallet', query: { txn: 't-3' } },
    });
    expect(routeForHref('/seller/dashboard/payments')).toEqual({
      name: 'Section',
      params: { sectionId: 'payments' },
    });
  });

  it('routes search destinations like links', () => {
    expect(
      routeForSearch({
        path: '/seller/dashboard/quotations',
        query: { q: 'Rice' },
      }),
    ).toEqual({
      name: 'Section',
      params: { sectionId: 'quotations', query: { q: 'Rice' } },
    });
    expect(
      routeForSearch({ path: '/seller/dashboard/unknown', query: {} }),
    ).toBeNull();
  });

  it('reads info links over https and the custom scheme', () => {
    const slug = (slugName: string) => ({
      name: 'Shared',
      params: { screen: 'InfoPage', params: { slug: slugName } },
    });
    expect(
      routeForUrl('https://seller.tradevistar.com/info/faqs', HOST),
    ).toEqual(slug('faqs'));
    expect(routeForUrl('tradevistarseller://info/faqs', HOST)).toEqual(
      slug('faqs'),
    );
    expect(routeForUrl('https://seller.tradevistar.com/info', HOST)).toEqual({
      name: 'Shared',
      params: { screen: 'HelpAbout' },
    });
    expect(routeForUrl('https://evil.example.com/info/faqs', HOST)).toBeNull();
  });

  it('opens help and legal pages without a session', () => {
    expect(
      isPublicRoute({ name: 'Shared', params: { screen: 'HelpAbout' } }),
    ).toBe(true);
    expect(
      isPublicRoute({
        name: 'Shared',
        params: { screen: 'InfoPage', params: { slug: 'x' } },
      }),
    ).toBe(true);
    expect(
      isPublicRoute({ name: 'Shared', params: { screen: 'Analytics' } }),
    ).toBe(false);
    expect(
      isPublicRoute({ name: 'Shared', params: { screen: 'SupportHome' } }),
    ).toBe(false);
  });

  it('sends More entries with a real screen there, and the rest to their section', () => {
    expect(routeForSection('analytics')).toEqual({
      name: 'Shared',
      params: { screen: 'Analytics' },
    });
    expect(routeForSection('support')).toEqual({
      name: 'Shared',
      params: { screen: 'SupportHome' },
    });
    expect(routeForSection('settings')).toEqual({
      name: 'Shared',
      params: { screen: 'AppSettings' },
    });
    expect(routeForSection('notifications')).toEqual({
      name: 'Main',
      params: { screen: 'Inbox' },
    });
    expect(routeForSection('wallet')).toEqual({
      name: 'Section',
      params: { sectionId: 'wallet' },
    });
  });
});
