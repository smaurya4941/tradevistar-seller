/**
 * Change the login email or mobile. The seller enters the new address, a six-digit code goes to
 * it, and entering the code makes it the sign-in contact. The server signs every other device out;
 * this phone's session is renewed straight away. The new contact is never logged.
 */
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  confirmContactChange,
  contactKind,
  maskIdentifier,
  normalizeContactIdentifier,
  requestContactChange,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { track } from '@/core/analytics/analytics';
import { useSessionEngine } from '@/core/auth/SessionProvider';
import { logger } from '@/core/logger';
import {
  Banner,
  Button,
  Card,
  colors,
  Field,
  FormSection,
  InfoRow,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { ScrollView } from 'react-native';
import { confirmContactAndRenew } from './accountChanges';
import { CodePanel, type CodeTimings } from './components/CodePanel';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { StateBadge } from './components/StateBadge';
import { companyKeys, useAccount } from './data';
import { profileErrorMessage } from './errors';

export function ContactChangeScreen() {
  const t = useT();
  const navigation = useNavigation();
  const toast = useToast();
  const client = useQueryClient();
  const engine = useSessionEngine();
  const account = useAccount();
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{
    identifier: string;
    timings: CodeTimings;
  } | null>(null);

  const timingsOf = (answer: {
    expiresInSeconds?: number;
    resendAfterSeconds?: number;
  }): CodeTimings => ({
    expiresInSeconds: answer.expiresInSeconds ?? 600,
    resendAfterSeconds: answer.resendAfterSeconds ?? 30,
  });

  const send = async () => {
    const parsed = normalizeContactIdentifier(value);
    setFieldError(parsed.error ? t('contact.invalid') : null);
    setError(null);
    if (!parsed.identifier) return;
    setBusy(true);
    try {
      const answer = await requestContactChange(parsed.identifier);
      setStep({ identifier: parsed.identifier, timings: timingsOf(answer) });
    } catch (caught) {
      setError(profileErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="screen-contact-change"
    >
      <SecureScreen />
      <LoadGate query={account}>
        {data => (
          <>
            <Card style={styles.card}>
              <Text variant="section">{t('contact.current')}</Text>
              <InfoRow
                label={t('account.loginEmail')}
                value={data.emailAddress}
                trailing={
                  data.emailAddress ? (
                    <StateBadge
                      state={data.emailVerified ? 'VERIFIED' : 'PENDING'}
                      label={
                        data.emailVerified
                          ? t('hub.verified')
                          : t('hub.unverified')
                      }
                    />
                  ) : null
                }
              />
              <InfoRow
                label={t('account.loginMobile')}
                value={data.mobileNumber}
                trailing={
                  data.mobileNumber ? (
                    <StateBadge
                      state={data.mobileVerified ? 'VERIFIED' : 'PENDING'}
                      label={
                        data.mobileVerified
                          ? t('hub.verified')
                          : t('hub.unverified')
                      }
                    />
                  ) : null
                }
              />
            </Card>

            {error ? (
              <Banner tone="red" message={error} testID="contact-error" />
            ) : null}

            {step ? (
              <FormSection title={t('contact.enterCode')}>
                <CodePanel
                  testID="contact-code"
                  destination={maskIdentifier(step.identifier)}
                  timings={step.timings}
                  smsAutofill={contactKind(step.identifier) === 'mobile'}
                  submitLabel={t('contact.confirm')}
                  changeLabel={t('common.change')}
                  onChange={() => setStep(null)}
                  onSubmit={async code => {
                    await confirmContactAndRenew({
                      confirm: () =>
                        confirmContactChange(step.identifier, code),
                      renewSession: () => engine.renewSession(),
                      onRenewFailed: () =>
                        logger.info(
                          '[contact] renewing the session failed; the retry will cover it',
                        ),
                    });
                    track('contact_changed', {});
                    await Promise.all([
                      client.invalidateQueries({
                        queryKey: companyKeys.account,
                      }),
                      client.invalidateQueries({
                        queryKey: companyKeys.security,
                      }),
                      client.invalidateQueries({
                        queryKey: companyKeys.overview,
                      }),
                      client.invalidateQueries({
                        queryKey: companyKeys.sessions,
                      }),
                    ]);
                    toast.show(t('contact.done'), 'success');
                    navigation.goBack();
                  }}
                  onResend={async () => {
                    const answer = await requestContactChange(step.identifier);
                    const timings = timingsOf(answer);
                    setStep({ identifier: step.identifier, timings });
                    return timings;
                  }}
                />
              </FormSection>
            ) : (
              <FormSection
                title={t('contact.new')}
                description={t('contact.newHint')}
              >
                <Field
                  label={t('contact.newLabel')}
                  value={value}
                  onChangeText={text => {
                    setValue(text);
                    setFieldError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  maxLength={255}
                  error={fieldError}
                  testID="contact-new"
                />
                <Button
                  label={t('contact.sendCode')}
                  onPress={() => {
                    void send();
                  }}
                  loading={busy}
                  disabled={busy || value.trim().length === 0}
                  testID="contact-send"
                />
                <Text variant="small" color={colors.textMuted}>
                  {t('contact.signOutNote')}
                </Text>
              </FormSection>
            )}
          </>
        )}
      </LoadGate>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  card: { gap: spacing.sm },
});
