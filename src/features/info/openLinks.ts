/**
 * Where taps on footer content go.
 *
 * - A footer page (`/info/<slug>`) opens in the app's own page screen, signed in or out.
 * - A seller-portal path (`/seller/dashboard/…`) goes through the route mapping, so it lands on the
 *   same screen a shared link would; a path the app has no screen for opens on the web.
 * - Outside addresses (http, https, mailto, tel) open in the browser, mail or phone app.
 *
 * Only links `safeLink` accepted ever reach here; anything else stays plain text.
 */
import type { SafeLink } from '@tradevistar/seller-api';
import { Linking } from 'react-native';
import { navigationRef } from '@/app/navigation/navigationRef';
import { openRoute } from '@/app/navigation/openHref';
import { routeForHref } from '@/app/navigation/routeMapping';
import { env } from '@/config/env';
import { logger } from '@/core/logger';

/** Opens an outside address; resolves false when nothing on the phone could. */
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    logger.warn('[info] could not open link', error);
    return false;
  }
}

/** Opens a footer page in the app; the web copy when navigation is not ready yet. */
export function openFooterPage(slug: string): void {
  if (navigationRef.isReady()) {
    openRoute({
      name: 'Shared',
      params: { screen: 'InfoPage', params: { slug } },
    });
    return;
  }
  void openExternal(`${env.webUrl}/info/${encodeURIComponent(slug)}`);
}

/** Follows a link from a page body or a footer list. Resolves false when it could not be opened. */
export async function openFooterLink(link: SafeLink): Promise<boolean> {
  if (link.kind === 'external') return openExternal(link.url);
  const route = routeForHref(link.href);
  if (route) {
    openRoute(route);
    return true;
  }
  return openExternal(`${env.webUrl}${link.href}`);
}
