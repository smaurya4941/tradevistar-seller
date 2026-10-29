/**
 * Forgot password, stage 1: where to send the reset code. The code itself and the new password are
 * on the next screen. "Sign in with a code instead" requests a login code and jumps straight to
 * the code step, as the web does.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { resolveAuthIdentifier } from '@tradevistar/seller-api';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { mapError, type MappedError } from '@/core/errors/errorMapper';
import { Button, Field, spacing } from '@/design';
import { useT } from '@/i18n';
import { useAuth } from '../AuthProvider';
import { AuthErrorNotice } from '../components/AuthErrorNotice';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { RATE_LIMIT_COOLDOWN_S, useCountdown } from '../hooks';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'ForgotPassword'
>;

export function ForgotPasswordScreen() {
  const t = useT();
  const auth = useAuth();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'ForgotPassword'>>();
  const [identifier, setIdentifier] = useState(route.params?.identifier ?? '');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<MappedError | null>(null);
  const [busy, setBusy] = useState<'reset' | 'otp' | null>(null);
  const cooldown = useCountdown(0);

  useEffect(() => {
    track('forgot_password_started', {});
  }, []);

  const resolve = (): string | null => {
    const resolved = resolveAuthIdentifier(identifier);
    if (!resolved) setError(t('auth.invalidIdentifier'));
    else setError(null);
    return resolved;
  };

  const run = async (kind: 'reset' | 'otp') => {
    if (busy || cooldown.seconds > 0) return;
    const resolved = resolve();
    if (!resolved) return;
    setFailure(null);
    setBusy(kind);
    try {
      if (kind === 'reset') {
        await auth.requestForgotPassword(resolved);
        navigation.navigate('ResetPassword', { identifier: resolved });
      } else {
        await auth.requestLoginOtp(resolved);
        navigation.navigate('SignInOtp', {
          identifier: resolved,
          requested: true,
        });
      }
    } catch (caught) {
      const mapped = mapError(caught, 'otpRequest', t);
      if (mapped.kind === 'rateLimited') cooldown.start(RATE_LIMIT_COOLDOWN_S);
      setFailure(mapped);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthScreenLayout
      testID="screen-forgot-password"
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}
      icon="lock_reset"
    >
      <View style={styles.form}>
        <Field
          label={t('auth.identifier')}
          value={identifier}
          onChangeText={value => {
            setIdentifier(value);
            setError(null);
          }}
          placeholder={t('auth.identifier.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={() => {
            void run('reset');
          }}
          error={error}
          editable={busy === null}
          testID="forgot-identifier"
        />
        {failure ? <AuthErrorNotice error={failure} /> : null}
        <Button
          label={
            cooldown.seconds > 0
              ? t('auth.cooldown', { seconds: cooldown.seconds })
              : t('forgot.send')
          }
          onPress={() => {
            void run('reset');
          }}
          loading={busy === 'reset'}
          disabled={cooldown.seconds > 0 || busy === 'otp'}
          fullWidth
          testID="forgot-send"
        />
        <Button
          label={t('forgot.useOtp')}
          variant="ghost"
          onPress={() => {
            void run('otp');
          }}
          loading={busy === 'otp'}
          disabled={cooldown.seconds > 0 || busy === 'reset'}
          fullWidth
          testID="forgot-use-otp"
        />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.lg } });
