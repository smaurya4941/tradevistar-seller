/**
 * Pieces shared by the registration steps: the progress label, the "existing account" notice, and
 * the verify-a-mobile-or-email block (field, Get OTP, code boxes, verified state).
 */
import { maskIdentifier } from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { mapError } from '@/core/errors/errorMapper';
import {
  Banner,
  Button,
  colors,
  Field,
  Icon,
  InlineLink,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { CodeEntry } from '../components/CodeEntry';
import { RATE_LIMIT_COOLDOWN_S, useCountdown } from '../hooks';
import { useDraft } from './registrationDraft';

export const RESEND_SECONDS = 30;

/** "Step 2 of 4". The password step is skipped for an account that already has one. */
export function StepLabel({
  step,
  needsPasswordStep,
}: {
  step: 'mobile' | 'email' | 'password' | 'business';
  needsPasswordStep: boolean;
}) {
  const t = useT();
  const order = needsPasswordStep
    ? ['mobile', 'email', 'password', 'business']
    : ['mobile', 'email', 'business'];
  return (
    <Text variant="badge" color={colors.textMuted} testID="register-step">
      {t('register.step', {
        current: order.indexOf(step) + 1,
        total: order.length,
      })}
    </Text>
  );
}

/** Green notice shown once either verification reports an account that already exists. */
export function LinkedAccountNotice() {
  const t = useT();
  const draft = useDraft();
  if (!draft.phoneExisting && !draft.emailExisting) return null;
  return (
    <Banner
      tone="green"
      icon="check_circle"
      message={
        draft.phonePasswordSet || draft.emailPasswordSet
          ? t('register.linked.withPassword')
          : t('register.linked.noPassword')
      }
      testID="register-linked-notice"
    />
  );
}

export interface VerifyIdentifierProps {
  kind: 'mobile' | 'email';
  label: string;
  placeholder: string;
  value: string;
  onChangeValue: (value: string) => void;
  /** Shown before the field, e.g. the +91 prefix. */
  prefix?: string;
  keyboardType: 'phone-pad' | 'email-address';
  /** Device clock when a code was sent for this value; null before. */
  sentAt: number | null;
  verified: boolean;
  /** An error from the server for this field (e.g. already in use). */
  serverError?: string | null;
  /** Returns the problem with the value, or null. */
  validate: (value: string) => string | null;
  /** Asks for a code. */
  onSend: () => Promise<void>;
  /** Checks the code; throws when it is wrong. */
  onVerify: (code: string) => Promise<void>;
  /** Unlocks the field and forgets the verification. */
  onReset: () => void;
  testID: string;
}

export function VerifyIdentifier({
  kind,
  label,
  placeholder,
  value,
  onChangeValue,
  prefix,
  keyboardType,
  sentAt,
  verified,
  serverError,
  validate,
  onSend,
  onVerify,
  onReset,
  testID,
}: VerifyIdentifierProps) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const cooldown = useCountdown(0);
  const sent = sentAt !== null;
  const locked = sent || verified;

  const send = async () => {
    if (sending || cooldown.seconds > 0) return;
    const problem = validate(value);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSend();
    } catch (caught) {
      const mapped = mapError(caught, 'otpRequest', t);
      if (mapped.kind === 'rateLimited') cooldown.start(RATE_LIMIT_COOLDOWN_S);
      setError(mapped.message);
    } finally {
      setSending(false);
    }
  };

  const shownError = error ?? serverError ?? null;
  const elapsed = sentAt ? Math.floor((Date.now() - sentAt) / 1000) : 0;

  return (
    <View style={styles.root}>
      <Field
        label={label}
        value={value}
        onChangeText={next => {
          onChangeValue(next);
          setError(null);
        }}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        autoComplete={kind === 'mobile' ? 'tel' : 'email'}
        textContentType={kind === 'mobile' ? 'telephoneNumber' : 'emailAddress'}
        editable={!locked && !sending}
        error={shownError}
        returnKeyType="send"
        onSubmitEditing={() => {
          void send();
        }}
        leading={
          prefix ? (
            <Text variant="bodyStrong" color={colors.textMuted}>
              {prefix}
            </Text>
          ) : undefined
        }
        trailing={
          verified ? (
            <View style={styles.verified}>
              <Icon name="check_circle" size={18} color={colors.success} />
              <Text variant="badge" color={colors.success}>
                {t('register.verified')}
              </Text>
            </View>
          ) : undefined
        }
        testID={`${testID}-field`}
      />

      {verified ? (
        <InlineLink
          label={t('register.change')}
          onPress={onReset}
          testID={`${testID}-change`}
        />
      ) : sent ? (
        <CodeEntry
          description={t(
            kind === 'mobile'
              ? 'register.enterOtp.mobile'
              : 'register.enterOtp.email',
          ).concat(` (${maskIdentifier(value)})`)}
          smsAutofill={kind === 'mobile'}
          submitLabel={t('auth.otp.verify')}
          errorContext="otpVerify"
          initialCooldown={Math.max(0, RESEND_SECONDS - elapsed)}
          onSubmit={onVerify}
          onResend={async () => {
            await onSend();
            return RESEND_SECONDS;
          }}
          changeLabel={t('register.change')}
          onChange={onReset}
          testID={`${testID}-code`}
        />
      ) : (
        <Button
          label={
            cooldown.seconds > 0
              ? t('auth.cooldown', { seconds: cooldown.seconds })
              : t('register.getOtp')
          }
          onPress={() => {
            void send();
          }}
          loading={sending}
          disabled={cooldown.seconds > 0}
          variant="secondary"
          fullWidth
          testID={`${testID}-send`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  verified: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
