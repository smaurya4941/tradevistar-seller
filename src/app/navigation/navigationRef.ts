/**
 * Navigation from outside React (a link, a notification tap, a search result). Calls made before
 * the navigator has mounted, or while signed out, are held and replayed by DeepLinkBridge.
 *
 * Screens that any tab can open are opened here in the More tab's stack, so a link from outside
 * always lands somewhere with the tab bar and a Back button; inside the app a screen opens in the
 * stack of the tab it is on, with `navigation.navigate`.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { AppRoute, MainTabName, RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** The name of the screen in front, for analytics (never its params). */
export function currentRouteName(): string | undefined {
  return navigationRef.isReady()
    ? navigationRef.getCurrentRoute()?.name
    : undefined;
}

/** True when the signed-in navigator (the tabs) is mounted. */
export function isSignedInNavigator(): boolean {
  return (
    navigationRef.isReady() &&
    Boolean(navigationRef.getRootState()?.routeNames.includes('Main'))
  );
}

/** The first screen of each tab's stack. */
export const TAB_ROOT_SCREEN: Record<MainTabName, string> = {
  Home: 'HomeMain',
  Orders: 'OrdersMain',
  Products: 'ProductsMain',
  Inbox: 'InboxMain',
  More: 'MoreMain',
};

/**
 * React Navigation types a nested navigate call by walking the whole param tree; a route that is
 * built from data at run time cannot satisfy that, so the one place that does it is loosely typed.
 */
const go = (name: string, params?: object): void => {
  (navigationRef.navigate as (name: string, params?: object) => void)(
    name,
    params,
  );
};

/** Opens a route. Returns false when the navigator is not ready to take it. */
export function navigateToRoute(route: AppRoute): boolean {
  if (!navigationRef.isReady()) return false;
  const signedIn = isSignedInNavigator();
  switch (route.name) {
    case 'AcceptInvitation':
      go('AcceptInvitation', route.params);
      return true;
    case 'RegisterMobile':
      go('RegisterMobile', route.params);
      return true;
    case 'Main': {
      if (!signedIn) return false;
      const { screen, query } = route.params;
      go('Main', {
        screen,
        params: query
          ? { screen: TAB_ROOT_SCREEN[screen], params: { query } }
          : undefined,
      });
      return true;
    }
    case 'Section':
      if (!signedIn) return false;
      go('Main', {
        screen: 'More',
        params: { screen: 'Section', params: route.params },
      });
      return true;
    case 'Diagnostics':
      if (!signedIn) return false;
      go('Main', { screen: 'More', params: { screen: 'Diagnostics' } });
      return true;
    case 'Shared': {
      const { screen, params } = route.params;
      if (signedIn) {
        go('Main', { screen: 'More', params: { screen, params } });
        return true;
      }
      // Signed out, only the public help pages exist.
      if (
        screen === 'HelpAbout' ||
        screen === 'InfoPage' ||
        screen === 'SuccessStories'
      ) {
        go(screen, params);
        return true;
      }
      return false;
    }
  }
}
