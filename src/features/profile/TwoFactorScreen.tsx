/**
 * Two-factor sign-in. Turning it on: choose a verified channel (SMS or email), a code is sent,
 * the seller enters it, and from then on sign-in asks for a code. Turning it off: confirm, a code
 * is sent, the seller enters it. If neither channel is verified, the screen says to verify one
 * first. Both flows use the code panel, driven by the send answer's timings.
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  confirmTwoFactor,
  disableTwoFactor,
  requestTwoFactor,
  requestTwoFactorDisable,
  type CodeSentView,
  type SecurityChannel,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { track } from '@/core/analytics/analytics';
import {
  Banner,
  Button,
  Card,
  ChoiceRow,
  colors,
  ConfirmDialog,
  spacing,
  StatusBadge,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { CodePanel } from './components/CodePanel';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { companyKeys, useSecurity } from './data';
import { profileErrorMessage } from './errors';

type Step =
  | { kind: 'idle' }
  | { kind: 'enable'; channel: SecurityChannel; sent: CodeSentView }
  | { kind: 'disable'; sent: CodeSentView };

export function TwoFactorScreen() {
  const t = useT();
  const toast = useToast();
  const client = useQueryClient();
  const query = useSecurity();
  const [channel, setChannel] = useState<SecurityChannel | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.security }),
      client.invalidateQueries({ queryKey: companyKeys.overview }),
    ]);

  const sendOn = async (selected: SecurityChannel) => {
    setBusy(true);
    setError(null);
    try {
      setStep({
        kind: 'enable',
        channel: selected,
        sent: await requestTwoFactor(selected),
      });
    } catch (caught) {
      setError(profileErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const sendOff = async () => {
    setConfirmOff(false);
    setBusy(true);
    setError(null);
    try {
      setStep({ kind: 'disable', sent: await requestTwoFactorDisable() });
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
      testID="screen-two-factor"
    >
      <SecureScreen />
      <LoadGate query={query}>
        {security => {
          const options: {
            value: SecurityChannel;
            label: string;
            verified: boolean;
            destination: string | null;
          }[] = [
            {
              value: 'SMS',
              label: t('sec.channel.sms'),
              verified: security.mobileVerified,
              destination: security.mobile,
            },
            {
              value: 'EMAIL',
              label: t('sec.channel.email'),
              verified: security.emailVerified,
              destination: security.email,
            },
          ];
          const usable = options.filter(option => option.verified);
          return (
            <>
              <Card style={styles.card}>
                <Text variant="section">{t('sec.twoFactor')}</Text>
                <StatusBadge
                  status={
                    security.twoFactor.enabled ? t('sec.on') : t('sec.off')
                  }
                  tone={security.twoFactor.enabled ? 'green' : 'gray'}
                />
                <Text variant="meta" color={colors.textMuted}>
                  {security.twoFactor.enabled
                    ? t('tf.onBody')
                    : t('tf.offBody')}
                </Text>
              </Card>
              {error ? (
                <Banner tone="red" message={error} testID="tf-error" />
              ) : null}

              {step.kind === 'idle' && !security.twoFactor.enabled ? (
                usable.length === 0 ? (
                  <Banner
                    tone="amber"
                    message={t('tf.verifyFirst')}
                    testID="tf-verify-first"
                  />
                ) : (
                  <Card style={styles.card}>
                    <Text variant="label">{t('tf.chooseChannel')}</Text>
                    {usable.map(option => (
                      <ChoiceRow
                        key={option.value}
                        label={option.label}
                        description={option.destination ?? undefined}
                        selected={channel === option.value}
                        onPress={() => setChannel(option.value)}
                        testID={`tf-channel-${option.value}`}
                      />
                    ))}
                    <Text variant="small" color={colors.textMuted}>
                      {t('tf.signInNote')}
                    </Text>
                    <Button
                      label={t('tf.sendCode')}
                      onPress={() => {
                        if (channel) void sendOn(channel);
                      }}
                      loading={busy}
                      disabled={busy || !channel}
                      testID="tf-send"
                    />
                  </Card>
                )
              ) : null}

              {step.kind === 'idle' && security.twoFactor.enabled ? (
                <Button
                  label={t('tf.turnOff')}
                  variant="danger"
                  onPress={() => setConfirmOff(true)}
                  loading={busy}
                  disabled={busy}
                  testID="tf-off"
                />
              ) : null}

              {step.kind === 'enable' ? (
                <Card style={styles.card}>
                  <CodePanel
                    testID="tf-code"
                    destination={step.sent.destination}
                    timings={step.sent}
                    smsAutofill={step.channel === 'SMS'}
                    submitLabel={t('tf.turnOn')}
                    onChange={() => setStep({ kind: 'idle' })}
                    changeLabel={t('common.change')}
                    onSubmit={async code => {
                      await confirmTwoFactor(step.channel, code);
                      track('two_factor_enabled', {});
                      setStep({ kind: 'idle' });
                      await refresh();
                      toast.show(t('tf.enabled'), 'success');
                    }}
                    onResend={async () => {
                      const sent = await requestTwoFactor(step.channel);
                      setStep({ kind: 'enable', channel: step.channel, sent });
                      return sent;
                    }}
                  />
                </Card>
              ) : null}

              {step.kind === 'disable' ? (
                <Card style={styles.card}>
                  <CodePanel
                    testID="tf-code"
                    destination={step.sent.destination}
                    timings={step.sent}
                    smsAutofill={step.sent.channel === 'SMS'}
                    submitLabel={t('tf.turnOff')}
                    onSubmit={async code => {
                      await disableTwoFactor(code);
                      setStep({ kind: 'idle' });
                      await refresh();
                      toast.show(t('tf.disabled'), 'success');
                    }}
                    onResend={async () => {
                      const sent = await requestTwoFactorDisable();
                      setStep({ kind: 'disable', sent });
                      return sent;
                    }}
                  />
                </Card>
              ) : null}
            </>
          );
        }}
      </LoadGate>
      <ConfirmDialog
        visible={confirmOff}
        title={t('tf.off.title')}
        message={t('tf.off.body')}
        confirmLabel={t('tf.off.send')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          void sendOff();
        }}
        onCancel={() => setConfirmOff(false)}
      />
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
  card: { gap: spacing.md },
});
