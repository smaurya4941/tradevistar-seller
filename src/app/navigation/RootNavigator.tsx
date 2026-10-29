/**
 * The root stack. What it shows follows the session:
 * - restoring: a quiet loading view while the Keychain is read and the session refreshed;
 * - signed out: the sign-in screens (password, code, two-factor, forgot password, registration);
 * - signed out because approval is pending or was refused: the approval screen, shown once and not
 *   stored (it is not part of the navigator, so leaving it returns to sign-in);
 * - signed in: the five tabs, with More-menu sections and Diagnostics pushed above them;
 * - offline with a stored session: the signed-in app (the seller is not signed out for lack of
 *   network); offline with nothing cached, a reconnect screen.
 */
import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession, useSessionEngine } from '@/core/auth/SessionProvider';
import { useScreenTracking } from '@/core/observability';
import { focusedRouteStore } from '@/core/realtime/focusedRoute';
import { refreshAccessOnNavigation } from '@/features/access/useAccess';
import { ApprovalStatusScreen } from '@/features/auth/ApprovalStatusScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
import { SignInOtpScreen } from '@/features/auth/screens/SignInOtpScreen';
import { TwoFactorScreen } from '@/features/auth/screens/TwoFactorScreen';
import { RegisterBusinessScreen } from '@/features/auth/registration/RegisterBusinessScreen';
import { RegisterEmailScreen } from '@/features/auth/registration/RegisterEmailScreen';
import { RegisterMobileScreen } from '@/features/auth/registration/RegisterMobileScreen';
import { RegisterPasswordScreen } from '@/features/auth/registration/RegisterPasswordScreen';
import { RegisterSubmittedScreen } from '@/features/auth/registration/RegisterSubmittedScreen';
import { AcceptInvitationScreen } from '@/features/invitations/AcceptInvitationScreen';
import { Button, colors, EmptyState, fonts } from '@/design';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { HelpAboutScreen } from '@/features/info/HelpAboutScreen';
import { InfoPageScreen } from '@/features/info/InfoPageScreen';
import { SuccessStoriesScreen } from '@/features/info/SuccessStoriesScreen';
import { useT } from '@/i18n';
import { DeepLinkBridge } from './DeepLinkBridge';
import { MainTabs } from './MainTabs';
import { currentRouteName, navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.onSurface,
    border: colors.divider,
    notification: colors.error,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: '400' },
    medium: { fontFamily: fonts.medium, fontWeight: '500' },
    bold: { fontFamily: fonts.semibold, fontWeight: '600' },
    heavy: { fontFamily: fonts.bold, fontWeight: '700' },
  },
};

const currentRoute = () =>
  navigationRef.isReady() ? { name: currentRouteName() ?? '' } : undefined;

export function RootNavigator() {
  const t = useT();
  const engine = useSessionEngine();
  const session = useSession();
  const track = useScreenTracking(currentRoute);
  const onStateChange = React.useCallback(() => {
    track();
    const route = currentRouteName();
    focusedRouteStore.set(route);
    refreshAccessOnNavigation(route);
  }, [track]);

  if (session.status === 'restoring') {
    return (
      <View style={styles.center} testID="session-restoring">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session.status === 'offline' && !session.user) {
    return (
      <View style={styles.center} testID="session-offline">
        <EmptyState
          icon="cloud_off"
          title={t('auth.offline.title')}
          message={t('auth.offline.body')}
        />
        <Button
          label={t('common.tryAgain')}
          onPress={() => {
            void engine.retry();
          }}
        />
      </View>
    );
  }

  if (
    session.status === 'signedOut' &&
    (session.reason === 'approvalPending' ||
      session.reason === 'approvalRejected')
  ) {
    return (
      <ApprovalStatusScreen
        approval={session.reason === 'approvalPending' ? 'pending' : 'rejected'}
        message={session.message ?? ''}
      />
    );
  }

  const authenticated =
    session.status === 'signedIn' || session.status === 'offline';

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme}
      onStateChange={onStateChange}
    >
      <DeepLinkBridge />
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.secondary,
          headerTitleStyle: { fontFamily: fonts.semibold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {authenticated ? (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AcceptInvitation"
              component={AcceptInvitationScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignInOtp" component={SignInOtpScreen} />
            <Stack.Screen
              name="TwoFactor"
              component={TwoFactorScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
            <Stack.Screen
              name="RegisterMobile"
              component={RegisterMobileScreen}
            />
            <Stack.Screen
              name="RegisterEmail"
              component={RegisterEmailScreen}
            />
            <Stack.Screen
              name="RegisterPassword"
              component={RegisterPasswordScreen}
            />
            <Stack.Screen
              name="RegisterBusiness"
              component={RegisterBusinessScreen}
            />
            <Stack.Screen
              name="RegisterSubmitted"
              component={RegisterSubmittedScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="AcceptInvitation"
              component={AcceptInvitationScreen}
            />
          </Stack.Group>
        )}
        {/* Help and legal pages open signed in or out; signed in they live in each tab's stack. */}
        {authenticated ? null : (
          <Stack.Group
            screenOptions={{
              headerShown: true,
              headerTintColor: colors.secondary,
            }}
          >
            <Stack.Screen
              name="HelpAbout"
              component={HelpAboutScreen}
              options={{ title: t('info.helpAbout.title') }}
            />
            <Stack.Screen
              name="InfoPage"
              component={InfoPageScreen}
              options={{ title: t('info.page.title') }}
            />
            <Stack.Screen
              name="SuccessStories"
              component={SuccessStoriesScreen}
              options={{ title: t('info.stories.title') }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.background,
  },
});
