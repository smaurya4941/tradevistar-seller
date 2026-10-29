/**
 * The second step of a sign-in for an account with two-factor on. The challenge (token, channel,
 * masked destination, timing) is parked in memory; leaving the screen discards it. The challenge
 * lasts ten minutes from the moment the password was accepted.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { useNow } from '@/core/useNow';
import { Button, colors, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { useAuth } from '../AuthProvider';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { CodeEntry } from '../components/CodeEntry';
import { useHeldChallenge } from '../twoFactorChallenge';

/** How long the server keeps a challenge. */
export const CHALLENGE_LIFETIME_MS = 10 * 60_000;
const DEFAULT_RESEND_SECONDS = 30;

type Navigation = NativeStackNavigationProp<RootStackParamList, 'TwoFactor'>;

const clock = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function TwoFactorScreen() {
  const t = useT();
  const auth = useAuth();
  const navigation = useNavigation<Navigation>();
  const held = useHeldChallenge();
  const now = useNow(1000, held !== null);

  const remaining = held ? held.receivedAt + CHALLENGE_LIFETIME_MS - now : 0;
  const expired = held !== null && remaining <= 0;

  // No challenge (cancelled, or the app was recreated) or an old one: back to sign-in.
  useEffect(() => {
    if (held && !expired) return;
    auth.cancelTwoFactor();
    navigation.navigate('SignIn', {
      identifier: held?.identifier,
      notice: expired ? 'twoFactorExpired' : undefined,
    });
  }, [auth, expired, held, navigation]);

  // Leaving by any route (Cancel, the system Back button) discards the challenge.
  useEffect(() => () => auth.cancelTwoFactor(), [auth]);

  if (!held || expired) return null;

  const { challenge } = held;
  const resendAfter = challenge.resendAfterSeconds ?? DEFAULT_RESEND_SECONDS;
  const elapsed = Math.floor((now - held.receivedAt) / 1000);
  const destination = challenge.destination ?? '';
  const description =
    challenge.channel === 'EMAIL'
      ? t('auth.twoFactor.email', { destination })
      : t('auth.twoFactor.sms', { destination });

  const cancel = () => {
    auth.cancelTwoFactor();
    navigation.navigate('SignIn', { identifier: held.identifier });
  };

  return (
    <AuthScreenLayout
      testID="screen-two-factor"
      title={t('auth.twoFactor.title')}
      icon="shield"
      showBack={false}
    >
      <CodeEntry
        description={description.trim()}
        smsAutofill={challenge.channel === 'SMS'}
        submitLabel={t('auth.twoFactor.verify')}
        errorContext="twoFactor"
        initialCooldown={Math.max(0, resendAfter - elapsed)}
        onSubmit={async code => {
          await auth.verifyTwoFactor(code);
        }}
        onResend={async () => {
          const timing = await auth.resendTwoFactor();
          return timing.resendAfterSeconds;
        }}
        testID="two-factor"
      />
      <View style={styles.footer}>
        <Text variant="small" color={colors.textMuted} align="center">
          {t('auth.twoFactor.expiresIn', { time: clock(remaining) })}
        </Text>
        <Button
          label={t('auth.twoFactor.cancel')}
          variant="ghost"
          onPress={cancel}
          fullWidth
          testID="two-factor-cancel"
        />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ footer: { gap: spacing.sm } });
