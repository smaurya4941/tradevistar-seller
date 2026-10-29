/**
 * Listens for the custom scheme and the portal's https links, turns each into an app route
 * (routeMapping.ts) and opens it, or holds it until the seller is signed in.
 *
 * Two kinds of link are public and open at once, signed in or not:
 * - a team invitation (`/seller/invitations/accept?token=`): the token is remembered in memory so
 *   a seller who has to sign in first is brought back to accept it;
 * - the registration form (`/seller/register?onboardingInvite=`): only while signed out, since a
 *   signed-in seller has nothing to register.
 * Every other link needs a session and waits for sign-in.
 */
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { env } from '@/config/env';
import { useSession } from '@/core/auth/SessionProvider';
import { logger } from '@/core/logger';
import {
  holdInvitationToken,
  usePendingInvitation,
} from '@/features/invitations/pendingInvitation';
import { navigateToRoute, navigationRef } from './navigationRef';
import { holdRoute, takePendingRoute } from './pendingRoute';
import { isPublicRoute, routeForUrl, webHostOf } from './routeMapping';
import type { AppRoute } from './types';

const WEB_HOST = webHostOf(env.webUrl);

/** The navigator may still be mounting when a launch link arrives; try for a couple of seconds. */
function navigateWhenReady(route: AppRoute, attempts = 20): void {
  if (navigateToRoute(route)) return;
  if (attempts <= 0) {
    holdRoute(route);
    return;
  }
  setTimeout(() => navigateWhenReady(route, attempts - 1), 100);
}

export function DeepLinkBridge(): null {
  const session = useSession();
  const signedIn = session.status === 'signedIn';
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  const pendingInvitation = usePendingInvitation();
  const invitationOpened = useRef<string | null>(null);

  // The listener and the launch link are set up once; they read the latest sign-in state.
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (!url) return;
      const route = routeForUrl(url, WEB_HOST);
      if (!route) {
        logger.info('[links] ignored a link this app does not handle');
        return;
      }
      if (isPublicRoute(route)) {
        if (route.name === 'AcceptInvitation' && route.params.token) {
          holdInvitationToken(route.params.token);
        }
        // A signed-in seller has nothing to register.
        if (route.name === 'RegisterMobile' && signedInRef.current) return;
        navigateWhenReady(route);
        return;
      }
      if (!signedInRef.current || !navigateToRoute(route)) holdRoute(route);
    };
    Linking.getInitialURL()
      .then(open)
      .catch(error => logger.warn('[links] initial link unreadable', error));
    const subscription = Linking.addEventListener('url', event =>
      open(event.url),
    );
    return () => subscription.remove();
  }, []);

  // After sign-in, bring a held invitation to its accept screen, then open whatever else arrived.
  useEffect(() => {
    if (!signedIn) {
      invitationOpened.current = null;
      return;
    }
    if (
      pendingInvitation &&
      invitationOpened.current !== pendingInvitation &&
      navigationRef.isReady()
    ) {
      invitationOpened.current = pendingInvitation;
      navigateToRoute({
        name: 'AcceptInvitation',
        params: { token: pendingInvitation },
      });
      return;
    }
    const route = takePendingRoute();
    if (route) navigateToRoute(route);
  }, [signedIn, pendingInvitation]);

  return null;
}
