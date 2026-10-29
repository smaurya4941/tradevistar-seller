/**
 * Seller sign-in with a password. Links lead to sign-in with a code, forgot password and
 * registration. A seller who is pending or rejected never sees an error here: the session state
 * moves to the approval screen. An account with two-factor on moves on to the TwoFactor screen.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { useSession } from '@/core/auth/SessionProvider';
import type { SignedOutReason } from '@/core/auth/sessionEngine';
import { mapError, type MappedError } from '@/core/errors/errorMapper';
import {
  Banner,
  Button,
  Checkbox,
  colors,
  Field,
  InlineLink,
  spacing,
  Text,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { usePendingInvitation } from '@/features/invitations/pendingInvitation';
import { useAuth } from './AuthProvider';
import { AuthErrorNotice } from './components/AuthErrorNotice';
import { AuthScreenLayout } from './components/AuthScreenLayout';
import { PasswordField } from './components/PasswordField';
import { RATE_LIMIT_COOLDOWN_S, useCountdown } from './hooks';

const REASON_KEYS: Partial<Record<SignedOutReason, TranslationKey>> = {
  expired: 'auth.reason.expired',
  roleRejected: 'auth.reason.roleRejected',
  signedOut: 'auth.reason.signedOut',
};

type Navigation = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

export function SignInScreen() {
  const t = useT();
  const auth = useAuth();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'SignIn'>>();
  const session = useSession();
  const invitation = usePendingInvitation();
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [identifier, setIdentifier] = useState(route.params?.identifier ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});
  const [failure, setFailure] = useState<MappedError | null>(null);
  const cooldown = useCountdown(0);

  const reasonKey =
    session.status === 'signedOut' ? REASON_KEYS[session.reason] : undefined;

  const submit = async () => {
    if (submitting || cooldown.seconds > 0) return;
    // Sent as typed (trimmed): the backend normalises it, as it does for the web.
    const trimmed = identifier.trim();
    const next: typeof fieldErrors = {};
    if (!trimmed) next.identifier = t('auth.required.identifier');
    if (!password) next.password = t('auth.required.password');
    setFieldErrors(next);
    setFailure(null);
    if (next.identifier || next.password) return;

    setSubmitting(true);
    try {
      const outcome = await auth.signIn(trimmed, password, rememberMe);
      if (outcome.kind === 'twoFactorRequired') {
        setPassword('');
        navigation.navigate('TwoFactor');
      }
      // signedIn / approval: the session state swaps the whole stack; nothing to do here.
    } catch (error) {
      const mapped = mapError(error, 'passwordLogin', t);
      setFieldErrors({
        identifier: mapped.fieldErrors?.identifier,
        password: mapped.fieldErrors?.password,
      });
      setFailure(mapped);
      if (mapped.kind === 'rateLimited') cooldown.start(RATE_LIMIT_COOLDOWN_S);
      if (mapped.kind === 'invalidCredentials') setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const goRegister = () => navigation.navigate('RegisterMobile');
  const goReset = () => navigation.navigate('ForgotPassword', { identifier });

  return (
    <AuthScreenLayout
      testID="screen-sign-in"
      title={t('auth.title')}
      subtitle={t('auth.subtitle')}
      showBack={false}
      footer={
        <View style={styles.footer}>
          <Text variant="body" color={colors.textMuted} align="center">
            {t('auth.createAccount')}
          </Text>
          <Button
            label={t('auth.createAccount.action')}
            variant="outline"
            onPress={goRegister}
            fullWidth
            testID="sign-in-register"
          />
          <InlineLink
            label={t('auth.needHelp')}
            onPress={() => navigation.navigate('HelpAbout')}
            testID="sign-in-need-help"
          />
        </View>
      }
    >
      {route.params?.notice === 'passwordReset' ? (
        <Banner
          tone="green"
          message={t('auth.passwordUpdated')}
          testID="sign-in-notice"
        />
      ) : null}
      {route.params?.notice === 'twoFactorExpired' ? (
        <Banner
          tone="amber"
          message={t('auth.twoFactor.expired')}
          testID="sign-in-two-factor-expired"
        />
      ) : null}
      {invitation ? (
        <Banner
          tone="blue"
          message={t('auth.invitation.hint')}
          testID="sign-in-invitation"
        />
      ) : null}
      {reasonKey ? (
        <Banner tone="amber" message={t(reasonKey)} testID="sign-in-reason" />
      ) : null}

      <Field
        label={t('auth.identifier')}
        value={identifier}
        onChangeText={setIdentifier}
        placeholder={t('auth.identifier.placeholder')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={fieldErrors.identifier}
        editable={!submitting}
        testID="sign-in-identifier"
      />
      <PasswordField
        ref={passwordRef}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        returnKeyType="go"
        onSubmitEditing={() => {
          void submit();
        }}
        error={fieldErrors.password}
        editable={!submitting}
        testID="sign-in-password"
      />

      <View style={styles.optionsRow}>
        <Checkbox
          checked={rememberMe}
          onChange={setRememberMe}
          accessibilityLabel={t('auth.rememberMe')}
          testID="sign-in-remember"
        >
          <Text variant="body">{t('auth.rememberMe')}</Text>
        </Checkbox>
        <InlineLink
          label={t('auth.forgotPassword')}
          onPress={goReset}
          testID="sign-in-forgot"
        />
      </View>

      {failure ? (
        <AuthErrorNotice
          error={failure}
          onResetPassword={goReset}
          onCreateAccount={goRegister}
          testID="sign-in-error"
        />
      ) : null}

      <Button
        label={
          cooldown.seconds > 0
            ? t('auth.cooldown', { seconds: cooldown.seconds })
            : t('auth.signIn')
        }
        onPress={() => {
          void submit();
        }}
        loading={submitting}
        disabled={cooldown.seconds > 0}
        fullWidth
        testID="sign-in-submit"
      />
      <Button
        label={t('auth.signInWithOtp')}
        variant="ghost"
        onPress={() =>
          navigation.navigate('SignInOtp', { identifier: identifier.trim() })
        }
        fullWidth
        testID="sign-in-otp-link"
      />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footer: { gap: spacing.md, alignSelf: 'stretch' },
});
