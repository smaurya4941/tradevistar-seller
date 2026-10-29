/**
 * A team invitation link (`…/seller/invitations/accept?token=…`).
 *
 * - No token: "Invitation link is incomplete".
 * - Signed out: the token is held in memory and the seller is asked to sign in with the address the
 *   invitation went to (or create a seller account first). After sign-in the app comes back here.
 * - Signed in: "Join this company's team" with Accept and "Use a different account".
 *
 * Accepting makes the company the seller's workspace; the session is refreshed so its token
 * carries the new organization (harmless if that fails), cached data is dropped, and the seller
 * goes Home. A refusal (expired, revoked, wrong email) shows the server's message with Back.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  acceptTeamInvitation,
  errorMessage,
  refresh,
} from '@tradevistar/seller-api';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { useSession, useSessionEngine } from '@/core/auth/SessionProvider';
import { logger } from '@/core/logger';
import { queryClient } from '@/core/query/queryClient';
import { Button, colors, Icon, palette, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import {
  clearInvitationToken,
  holdInvitationToken,
  usePendingInvitation,
} from './pendingInvitation';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'AcceptInvitation'
>;

export function AcceptInvitationScreen() {
  const t = useT();
  const engine = useSessionEngine();
  const session = useSession();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'AcceptInvitation'>>();
  const pending = usePendingInvitation();
  const token = route.params?.token ?? pending ?? '';
  const signedIn = session.status === 'signedIn';
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the token for the sign-in that may come next.
  useEffect(() => {
    if (token) holdInvitationToken(token);
  }, [token]);

  useEffect(() => {
    if (token) track('invitation_opened', { signed_in: signedIn });
  }, [signedIn, token]);

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const back = () => {
    clearInvitationToken();
    if (signedIn) goHome();
    else navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
  };

  const accept = async () => {
    if (accepting || !token) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptTeamInvitation(token);
      track('invitation_accepted', {});
      clearInvitationToken();
      setAccepted(true);
      // A new organization context rides in the token: take a fresh one. The accept already
      // happened, so a failure here must not look like one.
      await refresh().catch(refreshError =>
        logger.info('[invite] refresh after accept failed', refreshError),
      );
      await queryClient.invalidateQueries();
      goHome();
    } catch (caught) {
      setError(errorMessage(caught, t('invite.failed')));
      setAccepting(false);
    }
  };

  const switchAccount = async () => {
    const held = token;
    setAccepting(true);
    await engine.signOut();
    // Sign-out clears everything about the old session, including the pending token; this one
    // belongs to the invitation, not to the account.
    holdInvitationToken(held);
  };

  if (!token) {
    return (
      <Panel
        testID="invite-incomplete"
        icon="warning"
        tone="amber"
        title={t('invite.incomplete.title')}
        body={t('invite.incomplete.body')}
      >
        <Button label={t('invite.back')} onPress={back} fullWidth />
      </Panel>
    );
  }

  if (session.status === 'restoring') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <Panel
        testID="invite-signed-out"
        icon="group_add"
        tone="blue"
        title={t('invite.signedOut.title')}
        body={t('invite.signedOut.body')}
      >
        <Button
          label={t('invite.signIn')}
          onPress={() => navigation.navigate('SignIn')}
          fullWidth
          testID="invite-sign-in"
        />
        <Button
          label={t('invite.createAccount')}
          variant="outline"
          onPress={() => navigation.navigate('RegisterMobile')}
          fullWidth
          testID="invite-register"
        />
      </Panel>
    );
  }

  const email =
    session.status === 'signedIn' && session.user.email
      ? session.user.email
      : t('invite.join.account');

  return (
    <Panel
      testID="invite-join"
      icon={accepted ? 'check_circle' : 'group'}
      tone={accepted ? 'green' : 'blue'}
      title={accepted ? t('invite.accepted.title') : t('invite.join.title')}
      body={
        accepted ? t('invite.accepted.body') : t('invite.join.body', { email })
      }
      error={error}
    >
      {accepted ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Button
            label={t('invite.accept')}
            onPress={() => {
              void accept();
            }}
            loading={accepting}
            fullWidth
            testID="invite-accept"
          />
          <Button
            label={t('invite.switch')}
            variant="outline"
            onPress={() => {
              void switchAccount();
            }}
            disabled={accepting}
            fullWidth
            testID="invite-switch"
          />
          {error ? (
            <Button
              label={t('invite.back')}
              variant="ghost"
              onPress={back}
              fullWidth
              testID="invite-back"
            />
          ) : null}
        </>
      )}
    </Panel>
  );
}

function Panel({
  icon,
  tone,
  title,
  body,
  error,
  children,
  testID,
}: {
  icon: string;
  tone: 'amber' | 'blue' | 'green';
  title: string;
  body: string;
  error?: string | null;
  children?: React.ReactNode;
  testID: string;
}) {
  const background = {
    amber: palette.amber100,
    blue: palette.blue50,
    green: palette.green50,
  }[tone];
  const foreground = {
    amber: palette.amber700,
    blue: palette.blue700,
    green: palette.green700,
  }[tone];
  return (
    <SafeAreaView style={styles.root} testID={testID}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={[styles.badge, { backgroundColor: background }]}>
          <Icon name={icon} size={34} color={foreground} />
        </View>
        <Text
          variant="h2"
          color={colors.secondary}
          align="center"
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text variant="body" color={colors.textMuted} align="center">
          {body}
        </Text>
        {error ? (
          <Text
            variant="meta"
            color={colors.error}
            align="center"
            accessibilityRole="alert"
            testID="invite-error"
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
});
