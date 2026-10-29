/**
 * Sign in with a one-time code. Stage 1 asks for the email or mobile number and requests a LOGIN
 * code; stage 2 takes the six digits. The server checks the code before it says anything about the
 * account, so a wrong code always looks the same.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  identifierKind,
  maskIdentifier,
  resolveAuthIdentifier,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { mapError, type MappedError } from '@/core/errors/errorMapper';
import { Button, Checkbox, Field, InlineLink, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { useAuth } from '../AuthProvider';
import { AuthErrorNotice } from '../components/AuthErrorNotice';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { CodeEntry } from '../components/CodeEntry';
import { RATE_LIMIT_COOLDOWN_S, useCountdown } from '../hooks';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'SignInOtp'>;

export function SignInOtpScreen() {
  const t = useT();
  const auth = useAuth();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'SignInOtp'>>();
  const initial = route.params?.identifier ?? '';
  const resolvedInitial = resolveAuthIdentifier(initial);
  const [identifier, setIdentifier] = useState(initial);
  // The resolved identifier a code was sent to; null while still on stage 1.
  const [sentTo, setSentTo] = useState<string | null>(
    route.params?.requested && resolvedInitial ? resolvedInitial : null,
  );
  const [rememberMe, setRememberMe] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<MappedError | null>(null);
  const cooldown = useCountdown(0);

  const send = async () => {
    if (sending || cooldown.seconds > 0) return;
    const resolved = resolveAuthIdentifier(identifier);
    if (!resolved) {
      setError(t('auth.invalidIdentifier'));
      return;
    }
    setError(null);
    setFailure(null);
    setSending(true);
    try {
      await auth.requestLoginOtp(resolved);
      setIdentifier(resolved);
      setSentTo(resolved);
    } catch (caught) {
      const mapped = mapError(caught, 'otpRequest', t);
      if (mapped.kind === 'rateLimited') cooldown.start(RATE_LIMIT_COOLDOWN_S);
      setFailure(mapped);
    } finally {
      setSending(false);
    }
  };

  const submitCode = async (code: string) => {
    if (!sentTo) return;
    const outcome = await auth.signInWithOtp(sentTo, code, rememberMe);
    if (outcome.kind === 'twoFactorRequired') navigation.navigate('TwoFactor');
  };

  return (
    <AuthScreenLayout
      testID="screen-sign-in-otp"
      title={t('auth.otp.title')}
      subtitle={t('auth.otp.subtitle')}
      footer={
        <InlineLink
          label={t('auth.signInWithPassword')}
          onPress={() => navigation.navigate('SignIn', { identifier })}
          testID="otp-use-password"
        />
      }
    >
      {sentTo ? (
        <>
          <CodeEntry
            description={t('auth.otp.sentTo', {
              target: maskIdentifier(sentTo),
            })}
            smsAutofill={identifierKind(sentTo) === 'mobile'}
            submitLabel={t('auth.otp.verify')}
            errorContext="otpLogin"
            onSubmit={submitCode}
            onResend={async () => {
              await auth.requestLoginOtp(sentTo);
              return 30;
            }}
            changeLabel={t('auth.otp.change')}
            onChange={() => setSentTo(null)}
            hint={t('auth.otp.hint')}
            testID="otp-login"
          />
          <Checkbox
            checked={rememberMe}
            onChange={setRememberMe}
            accessibilityLabel={t('auth.rememberMe')}
          >
            <Text variant="body">{t('auth.rememberMe')}</Text>
          </Checkbox>
        </>
      ) : (
        <View style={styles.stage}>
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
              void send();
            }}
            error={error}
            editable={!sending}
            testID="otp-identifier"
          />
          {failure ? <AuthErrorNotice error={failure} /> : null}
          <Button
            label={
              cooldown.seconds > 0
                ? t('auth.cooldown', { seconds: cooldown.seconds })
                : t('auth.otp.send')
            }
            onPress={() => {
              void send();
            }}
            loading={sending}
            disabled={cooldown.seconds > 0}
            fullWidth
            testID="otp-send"
          />
        </View>
      )}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ stage: { gap: spacing.lg } });
