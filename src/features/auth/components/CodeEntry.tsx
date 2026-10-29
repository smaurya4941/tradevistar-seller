/**
 * The six-digit code step shared by OTP sign-in, two-factor, password reset and the registration
 * verifications: the boxes, a verify button, a resend countdown and the error handling that is the
 * same everywhere.
 *
 * - The sixth digit submits by itself; a wrong code clears the boxes and says "Invalid or expired
 *   code." (the server answers a wrong code the same way every time).
 * - A 429 disables verify and resend for a minute with a plain message.
 * - Anything else (offline, a server error) keeps what was typed so the seller can press Verify.
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { mapError, type ErrorContext } from '@/core/errors/errorMapper';
import { Button, colors, InlineLink, spacing, Text, useToast } from '@/design';
import { useT } from '@/i18n';
import { RATE_LIMIT_COOLDOWN_S, useCountdown } from '../hooks';
import { OTP_LENGTH, OtpInput, type OtpInputHandle } from './OtpInput';

export interface CodeEntryProps {
  /** One sentence saying where the code went. */
  description: string;
  /** Listen for the code SMS (Android SMS User Consent). Off for email codes. */
  smsAutofill: boolean;
  submitLabel: string;
  /** Checks the code; throw (an ApiError) when it fails. */
  onSubmit: (code: string) => Promise<void>;
  /** Asks for a new code; resolves with the seconds until another may be requested. */
  onResend: () => Promise<number | void>;
  errorContext: ErrorContext;
  /** Seconds before "Resend" is available, counted from now. */
  initialCooldown?: number;
  resendSeconds?: number;
  /** Offered beside the description ("Change email/mobile"). */
  changeLabel?: string;
  onChange?: () => void;
  /** An error the caller wants shown under the boxes (e.g. a rejected reset code). */
  externalError?: string | null;
  /** A line under the boxes while there is no error. */
  hint?: string;
  /** Hide the verify button when the caller continues with a different button. */
  hideSubmit?: boolean;
  /** Called with the typed code as it changes (the reset flow keeps it). */
  onCodeChange?: (code: string) => void;
  /** Report a failed submit to the caller (analytics). */
  onFailure?: (error: unknown) => void;
  autoFocus?: boolean;
  testID?: string;
}

export function CodeEntry({
  description,
  smsAutofill,
  submitLabel,
  onSubmit,
  onResend,
  errorContext,
  initialCooldown = 30,
  resendSeconds = 30,
  changeLabel,
  onChange,
  externalError,
  hint,
  hideSubmit = false,
  onCodeChange,
  onFailure,
  autoFocus = true,
  testID = 'code-entry',
}: CodeEntryProps) {
  const t = useT();
  const toast = useToast();
  const inputRef = useRef<OtpInputHandle>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [listenKey, setListenKey] = useState(0);
  const resendCountdown = useCountdown(initialCooldown);
  const throttle = useCountdown(0);
  const throttled = throttle.seconds > 0;

  const update = useCallback(
    (value: string) => {
      setCode(value);
      onCodeChange?.(value);
    },
    [onCodeChange],
  );

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== OTP_LENGTH) {
        setError(t('auth.otp.incomplete'));
        return;
      }
      if (busy || throttled) return;
      setBusy(true);
      setError(null);
      try {
        await onSubmit(value);
      } catch (caught) {
        onFailure?.(caught);
        const mapped = mapError(caught, errorContext, t);
        setError(mapped.message);
        if (mapped.kind === 'rateLimited') {
          throttle.start(RATE_LIMIT_COOLDOWN_S);
        } else if (mapped.kind === 'otpInvalid') {
          inputRef.current?.clear();
          update('');
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, errorContext, onFailure, onSubmit, t, throttle, throttled, update],
  );

  const resend = useCallback(async () => {
    if (resendCountdown.seconds > 0 || resending || throttled) return;
    setResending(true);
    setError(null);
    try {
      const next = await onResend();
      resendCountdown.start(
        typeof next === 'number' && next > 0 ? next : resendSeconds,
      );
      inputRef.current?.clear();
      update('');
      setListenKey(key => key + 1);
      toast.show(t('auth.otp.resent'), 'success');
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (caught) {
      const mapped = mapError(caught, 'otpRequest', t);
      if (mapped.kind === 'rateLimited') {
        throttle.start(RATE_LIMIT_COOLDOWN_S);
        resendCountdown.start(RATE_LIMIT_COOLDOWN_S);
      }
      setError(mapped.message);
    } finally {
      setResending(false);
    }
  }, [
    onResend,
    resendCountdown,
    resendSeconds,
    resending,
    t,
    throttle,
    throttled,
    toast,
    update,
  ]);

  const shownError = externalError ?? error;

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.sentRow}>
        <Text
          variant="body"
          color={colors.onSurfaceVariant}
          style={styles.flex}
        >
          {description}
        </Text>
        {changeLabel && onChange ? (
          <InlineLink
            label={changeLabel}
            onPress={onChange}
            testID={`${testID}-change`}
          />
        ) : null}
      </View>

      <OtpInput
        ref={inputRef}
        testID={`${testID}-input`}
        value={code}
        onChange={value => {
          update(value);
          if (error && value.length < OTP_LENGTH) setError(null);
        }}
        onComplete={value => {
          void submit(value);
        }}
        disabled={busy || throttled}
        invalid={Boolean(shownError)}
        autoFocus={autoFocus}
        smsAutofill={smsAutofill}
        listenKey={listenKey}
        accessibilityLabel={t('auth.otp.label')}
        accessibilityProgress={t('auth.otp.progress', { count: code.length })}
      />

      {shownError ? (
        <Text
          variant="small"
          color={colors.error}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          testID={`${testID}-error`}
        >
          {shownError}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}

      {throttled ? (
        <Text variant="meta" color={colors.textMuted}>
          {t('auth.cooldown', { seconds: throttle.seconds })}
        </Text>
      ) : null}

      {hideSubmit ? null : (
        <Button
          testID={`${testID}-verify`}
          label={submitLabel}
          onPress={() => {
            void submit(code);
          }}
          loading={busy}
          disabled={code.length !== OTP_LENGTH || throttled}
          variant="secondary"
          fullWidth
        />
      )}

      <View style={styles.resendRow}>
        {resendCountdown.seconds > 0 ? (
          <Text variant="meta" color={colors.textMuted}>
            {t('auth.otp.resendIn', { seconds: resendCountdown.seconds })}
          </Text>
        ) : (
          <Button
            testID={`${testID}-resend`}
            label={t('auth.otp.resend')}
            onPress={() => {
              void resend();
            }}
            loading={resending}
            disabled={throttled}
            variant="ghost"
            size="sm"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  flex: { flex: 1 },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  resendRow: { alignItems: 'center', minHeight: 40, justifyContent: 'center' },
});
