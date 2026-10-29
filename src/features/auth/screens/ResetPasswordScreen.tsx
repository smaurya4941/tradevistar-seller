/**
 * Forgot password, stages 2 and 3: the six-digit code, then the new password.
 *
 * The server only checks the code when the password is set, so a wrong or expired code surfaces at
 * the last step. The whole reset is rejected then; the entered password is kept, the seller goes
 * back to the code step with the reason, and can resend.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { identifierKind, maskIdentifier } from '@tradevistar/seller-api';
import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { mapError, type MappedError } from '@/core/errors/errorMapper';
import { Button, InlineLink, spacing } from '@/design';
import { useT } from '@/i18n';
import { useAuth } from '../AuthProvider';
import { AuthErrorNotice } from '../components/AuthErrorNotice';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { CodeEntry } from '../components/CodeEntry';
import { PasswordField } from '../components/PasswordField';
import { newPasswordError } from '../passwordForm';
import { RATE_LIMIT_COOLDOWN_S, useCountdown } from '../hooks';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'ResetPassword'
>;

export function ResetPasswordScreen() {
  const t = useT();
  const auth = useAuth();
  const navigation = useNavigation<Navigation>();
  const { identifier } =
    useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>().params;
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [stage, setStage] = useState<'code' | 'password'>('code');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const [failure, setFailure] = useState<MappedError | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCountdown(0);

  const kind = identifierKind(identifier);

  const save = async () => {
    if (busy || cooldown.seconds > 0) return;
    const found = newPasswordError(password, confirm, t);
    setErrors(found);
    setFailure(null);
    if (found.password || found.confirm) return;
    setBusy(true);
    try {
      await auth.resetPassword(identifier, code, password);
      navigation.reset({
        index: 0,
        routes: [
          { name: 'SignIn', params: { identifier, notice: 'passwordReset' } },
        ],
      });
    } catch (caught) {
      const mapped = mapError(caught, 'reset', t);
      if (mapped.kind === 'otpInvalid') {
        // Keep the password; only the code needs another go.
        setCodeError(t('forgot.codeRejected'));
        setStage('code');
      } else {
        if (mapped.kind === 'rateLimited')
          cooldown.start(RATE_LIMIT_COOLDOWN_S);
        setErrors({ password: mapped.fieldErrors?.newPassword });
        setFailure(mapped);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenLayout
      testID="screen-reset-password"
      title={
        stage === 'code' ? t('forgot.codeTitle') : t('forgot.passwordTitle')
      }
      icon="lock_reset"
    >
      {stage === 'code' ? (
        <CodeEntry
          description={
            t('forgot.codeSent', {
              kind: t(
                kind === 'email' ? 'forgot.kind.email' : 'forgot.kind.mobile',
              ),
            }) + ` ${maskIdentifier(identifier)}`
          }
          smsAutofill={kind === 'mobile'}
          submitLabel={t('forgot.codeContinue')}
          errorContext="reset"
          onSubmit={async value => {
            // The server checks the code with the new password; this only moves on.
            setCode(value);
            setCodeError(null);
            setStage('password');
          }}
          onCodeChange={value => {
            setCode(value);
            if (codeError && value.length < 6) setCodeError(null);
          }}
          onResend={async () => {
            await auth.requestForgotPassword(identifier);
            setCodeError(null);
            return 30;
          }}
          externalError={codeError}
          initialCooldown={codeError ? 0 : 30}
          testID="reset-code"
        />
      ) : (
        <View style={styles.form}>
          <PasswordField
            isNew
            label={t('forgot.newPassword')}
            value={password}
            onChangeText={setPassword}
            maxLength={128}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={errors.password}
            editable={!busy}
            testID="reset-password"
          />
          <PasswordField
            ref={confirmRef}
            isNew
            label={t('forgot.confirmPassword')}
            value={confirm}
            onChangeText={setConfirm}
            maxLength={128}
            returnKeyType="go"
            onSubmitEditing={() => {
              void save();
            }}
            error={errors.confirm}
            editable={!busy}
            testID="reset-confirm"
          />
          {failure ? <AuthErrorNotice error={failure} /> : null}
          <Button
            label={
              cooldown.seconds > 0
                ? t('auth.cooldown', { seconds: cooldown.seconds })
                : t('forgot.save')
            }
            onPress={() => {
              void save();
            }}
            loading={busy}
            disabled={cooldown.seconds > 0}
            fullWidth
            testID="reset-save"
          />
          <InlineLink
            label={t('forgot.changeCode')}
            onPress={() => setStage('code')}
            testID="reset-change-code"
          />
        </View>
      )}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.lg } });
