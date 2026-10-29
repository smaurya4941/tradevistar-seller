/**
 * The six-digit code panel for every profile verification (contact, two-factor, login-contact
 * change). It is the Phase 1 code step, driven by the timings a send answers with: the panel's
 * first resend wait is `resendAfterSeconds`, and "expires in" comes from `expiresInSeconds`. A
 * wrong code shows inline, clears the boxes and keeps the panel open.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CodeEntry } from '@/features/auth/components/CodeEntry';
import { colors, spacing, Text } from '@/design';
import { useT } from '@/i18n';

export interface CodeTimings {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export function CodePanel({
  destination,
  timings,
  submitLabel,
  onSubmit,
  onResend,
  onChange,
  changeLabel,
  smsAutofill = false,
  testID = 'code-panel',
}: {
  /** Where the code went (already masked), or null when unknown. */
  destination: string | null;
  timings: CodeTimings;
  submitLabel?: string;
  onSubmit: (code: string) => Promise<void>;
  /** Asks for a new code; resolves with the new timings. */
  onResend: () => Promise<CodeTimings | void>;
  onChange?: () => void;
  changeLabel?: string;
  smsAutofill?: boolean;
  testID?: string;
}) {
  const t = useT();
  const minutes = Math.max(1, Math.round(timings.expiresInSeconds / 60));
  return (
    <View style={styles.root}>
      <CodeEntry
        testID={testID}
        description={
          destination
            ? t('form.codeSent', { destination })
            : t('form.codeSentGeneric')
        }
        smsAutofill={smsAutofill}
        submitLabel={submitLabel ?? t('form.verify')}
        errorContext="otpVerify"
        initialCooldown={timings.resendAfterSeconds}
        resendSeconds={timings.resendAfterSeconds}
        onSubmit={onSubmit}
        onResend={async () => {
          const next = await onResend();
          return next ? next.resendAfterSeconds : undefined;
        }}
        onChange={onChange}
        changeLabel={changeLabel}
        hint={t('form.codeExpires', {
          time: t('form.minutes', { count: minutes }),
        })}
      />
      <Text variant="small" color={colors.textMuted}>
        {t('form.codeNever')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: spacing.sm } });
