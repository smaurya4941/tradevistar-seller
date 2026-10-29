/**
 * One place that knows how web portal paths, deep links, notification targets and search results
 * relate to app routes.
 *
 * Accepted links:
 * - the custom scheme: `tradevistarseller://dashboard/orders` (host = first segment);
 * - the portal's https URL: `https://<web host>/seller/dashboard/orders`, and its public info
 *   pages `https://<web host>/info/<slug>`.
 * Both name the same portal path `/seller/dashboard/orders`, which maps to a route here. The query
 * (`?order=<id>`) travels with the route so the screen that owns the record can read it.
 */
import { parseQuery, type SearchDestination } from '@tradevistar/seller-api';
import { allSections, sectionById, type SectionId } from './sections';
import type {
  AppRoute,
  MainTabName,
  RouteQuery,
  SharedScreenName,
} from './types';

export const APP_SCHEME = 'tradevistarseller';

const DASHBOARD = '/seller/dashboard';

/** Portal path of each main tab (Home is the dashboard itself). */
export const TAB_WEB_PATHS: Record<Exclude<MainTabName, 'More'>, string> = {
  Home: DASHBOARD,
  Orders: `${DASHBOARD}/orders`,
  Products: `${DASHBOARD}/products`,
  Inbox: `${DASHBOARD}/messages`,
};

const NOTIFICATIONS_PATH = `${DASHBOARD}/notifications`;
const NOTIFICATION_PREFERENCES_PATH = `${DASHBOARD}/profile/notifications`;
const SUPPORT_PATH = `${DASHBOARD}/support`;
const SETTINGS_PATH = `${DASHBOARD}/settings`;
const ANALYTICS_PATH = `${DASHBOARD}/analytics`;
const INFO_PREFIXES = ['/info', '/seller/info'];
const PROFILE_PATH = `${DASHBOARD}/profile`;
const EXPORT_DOCUMENTS_PATH = `${DASHBOARD}/export-documents`;

/** The profile pages of the web portal and the app screen each one opens. */
const PROFILE_PAGES: readonly { suffix: string; screen: SharedScreenName }[] = [
  { suffix: '/account', screen: 'AccountDetails' },
  { suffix: '/business', screen: 'BusinessDetails' },
  { suffix: '/addresses', screen: 'Addresses' },
  { suffix: '/tax', screen: 'TaxGst' },
  { suffix: '/documents', screen: 'Documents' },
  { suffix: '/bank', screen: 'Bank' },
  { suffix: '/team', screen: 'Team' },
  { suffix: '/calendar', screen: 'Calendar' },
  { suffix: '/security', screen: 'Security' },
  { suffix: '/notifications', screen: 'NotificationSettings' },
];

/** `/seller/dashboard/profile/<page>` (and the profile home) to its screen, or null. */
export function profileRouteForPath(path: string): AppRoute | null {
  if (path === PROFILE_PATH) {
    return { name: 'Shared', params: { screen: 'ProfileHub' } };
  }
  if (!path.startsWith(`${PROFILE_PATH}/`)) return null;
  const page = PROFILE_PAGES.find(item =>
    matches(path, `${PROFILE_PATH}${item.suffix}`),
  );
  return page
    ? ({ name: 'Shared', params: { screen: page.screen } } as AppRoute)
    : { name: 'Shared', params: { screen: 'ProfileHub' } };
}

const hasQuery = (query: RouteQuery | undefined): query is RouteQuery =>
  Boolean(query && Object.keys(query).length > 0);

/** A route with its query attached only when there is one, so equal routes compare equal. */
const withQuery = <R extends AppRoute>(
  route: R,
  query: RouteQuery | undefined,
): R => {
  if (!hasQuery(query)) return route;
  return { ...route, params: { ...route.params, query } } as R;
};

function matches(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

/** `/info/<slug>` (or `/seller/info/<slug>`) to the page's slug; '' for the info index. */
function infoSlug(path: string): string | null {
  for (const prefix of INFO_PREFIXES) {
    if (path === prefix) return '';
    if (path.startsWith(`${prefix}/`)) {
      const slug = path.slice(prefix.length + 1).split('/')[0];
      try {
        return decodeURIComponent(slug);
      } catch {
        return slug;
      }
    }
  }
  return null;
}

/** Portal path (and query) to the route that shows it, or null when the app has no screen for it. */
export function routeForWebPath(
  rawPath: string,
  query?: RouteQuery,
): AppRoute | null {
  const path = normalizePath(rawPath);
  const info = infoSlug(path);
  if (info !== null) {
    return info
      ? {
          name: 'Shared',
          params: { screen: 'InfoPage', params: { slug: info } },
        }
      : { name: 'Shared', params: { screen: 'HelpAbout' } };
  }
  if (path === DASHBOARD) {
    return { name: 'Main', params: { screen: 'Home' } };
  }
  if (matches(path, EXPORT_DOCUMENTS_PATH)) {
    return { name: 'Shared', params: { screen: 'Documents' } };
  }
  const profile = profileRouteForPath(path);
  if (profile) return profile;
  if (matches(path, NOTIFICATION_PREFERENCES_PATH)) {
    return { name: 'Shared', params: { screen: 'NotificationSettings' } };
  }
  if (matches(path, NOTIFICATIONS_PATH)) {
    return { name: 'Main', params: { screen: 'Inbox' } };
  }
  if (matches(path, SUPPORT_PATH)) {
    const ticketId = query?.ticket;
    return ticketId
      ? {
          name: 'Shared',
          params: { screen: 'TicketThread', params: { ticketId } },
        }
      : { name: 'Shared', params: { screen: 'SupportHome' } };
  }
  if (matches(path, SETTINGS_PATH)) {
    return { name: 'Shared', params: { screen: 'AppSettings' } };
  }
  if (matches(path, ANALYTICS_PATH)) {
    return { name: 'Shared', params: { screen: 'Analytics' } };
  }
  for (const tab of ['Orders', 'Products', 'Inbox'] as const) {
    if (matches(path, TAB_WEB_PATHS[tab])) {
      return withQuery({ name: 'Main', params: { screen: tab } }, query);
    }
  }
  const section = allSections().find(item => matches(path, item.webPath));
  return section
    ? withQuery({ name: 'Section', params: { sectionId: section.id } }, query)
    : null;
}

/** A web href with its query (`/seller/dashboard/orders?order=1`) to a route. */
export function routeForHref(href: string): AppRoute | null {
  const queryAt = href.indexOf('?');
  const path = queryAt === -1 ? href : href.slice(0, queryAt);
  const hash = href.indexOf('#', queryAt === -1 ? 0 : queryAt);
  const search =
    queryAt === -1
      ? ''
      : href.slice(queryAt + 1, hash === -1 ? undefined : hash);
  return routeForWebPath(path, parseQuery(search));
}

/** A search result's destination to a route. */
export function routeForSearch(
  destination: SearchDestination,
): AppRoute | null {
  return routeForWebPath(destination.path, destination.query);
}

/**
 * The route a More-menu entry opens. Areas that have a real screen go there; the rest open their
 * placeholder section.
 */
export function routeForSection(id: SectionId): AppRoute {
  switch (id) {
    case 'analytics':
      return { name: 'Shared', params: { screen: 'Analytics' } };
    case 'support':
      return { name: 'Shared', params: { screen: 'SupportHome' } };
    case 'settings':
      return { name: 'Shared', params: { screen: 'AppSettings' } };
    case 'notifications':
      return { name: 'Main', params: { screen: 'Inbox' } };
    case 'profile':
      return { name: 'Shared', params: { screen: 'ProfileHub' } };
    case 'exportDocuments':
      return { name: 'Shared', params: { screen: 'Documents' } };
    default:
      return { name: 'Section', params: { sectionId: id } };
  }
}

/** The portal page for a section, for "Open on the web". */
export function webPathForSection(id: SectionId): string | null {
  return sectionById(id)?.webPath ?? null;
}

function normalizePath(path: string): string {
  const withoutQuery = path.replace(/[?#].*$/, '');
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Reads a link into the portal path it names. Returns null for anything that is not this app's
 * (another scheme, another host), so a foreign link never navigates.
 */
export function portalPathFromUrl(url: string, webHost: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i.exec(url.trim());
  if (!match) return null;
  const [, scheme, host, rest] = match;
  if (scheme.toLowerCase() === APP_SCHEME) {
    if (!host) return null;
    if (host === 'info') return normalizePath(`/info${rest}`);
    return normalizePath(`/seller/${host}${rest}`);
  }
  if (
    (scheme.toLowerCase() === 'https' || scheme.toLowerCase() === 'http') &&
    host.toLowerCase() === webHost.toLowerCase()
  ) {
    return normalizePath(rest || '/');
  }
  return null;
}

const INVITATION_PATH = '/seller/invitations/accept';
const REGISTER_PATH = '/seller/register';

/** The value of one query parameter in a link, decoded; undefined when absent or empty. */
export function queryParam(url: string, name: string): string | undefined {
  const query = /\?([^#]*)/.exec(url)?.[1];
  if (!query) return undefined;
  for (const pair of query.split('&')) {
    const [key, ...rest] = pair.split('=');
    if (key === name) {
      try {
        const value = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
        return value || undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * Routes that open without a session: a team invitation (the seller signs in first, then accepts),
 * the registration form (with an optional staff onboarding invitation), and the help and legal
 * pages, which anyone may read.
 */
export function isPublicRoute(route: AppRoute): boolean {
  if (route.name === 'AcceptInvitation' || route.name === 'RegisterMobile') {
    return true;
  }
  return (
    route.name === 'Shared' &&
    (route.params.screen === 'HelpAbout' ||
      route.params.screen === 'InfoPage' ||
      route.params.screen === 'SuccessStories')
  );
}

/** A link to the route it opens, or null. */
export function routeForUrl(url: string, webHost: string): AppRoute | null {
  const path = portalPathFromUrl(url, webHost);
  if (!path) return null;
  if (path === INVITATION_PATH) {
    return {
      name: 'AcceptInvitation',
      params: { token: queryParam(url, 'token') },
    };
  }
  if (path === REGISTER_PATH) {
    return {
      name: 'RegisterMobile',
      params: { onboardingInvite: queryParam(url, 'onboardingInvite') },
    };
  }
  const queryAt = url.indexOf('?');
  const hashAt = url.indexOf('#');
  const search =
    queryAt === -1
      ? ''
      : url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined);
  return routeForWebPath(path, parseQuery(search));
}

export function webHostOf(webUrl: string): string {
  const match = /^https?:\/\/([^/?#]+)/i.exec(webUrl);
  return match ? match[1] : '';
}
