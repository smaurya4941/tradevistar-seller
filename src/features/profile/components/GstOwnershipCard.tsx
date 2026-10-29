/**
 * GST ownership: the proof that the seller controls the GSTIN, by two one-time codes (one to the
 * GST-registered email, one to the GST-registered mobile) or, when that is not possible, by
 * uploading the certificate for review.
 *
 * The card shows only when a GSTIN is saved, it is not verified yet, and the form has no unsaved
 * edits (the codes belong to the saved GSTIN). The state machine is `gstOwnershipView`; this file
 * is its screen. SMS autofill is off on purpose: two codes arrive from two channels.
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  GST_MANUAL_FALLBACK_CODES,
  gstOwnershipView,
  secondsUntil,
  sendGstOwnershipOtp,
  verifyGstOwnershipOtp,
  type GstOwnershipChallenge,
  type TaxDetailView,
} from '@tradevistar/seller-api';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { track } from '@/core/analytics/analytics';
import { useNow } from '@/core/useNow';
import { queryKeys } from '@/core/query/queryClient';
import {
  Banner,
  Button,
  Card,
  colors,
  Icon,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import {
  companyKeys,
  useGstManual,
  useGstMode,
  useGstOwnership,
  useScope,
} from '../data';
import { profileErrorMessage } from '../errors';
import { CodePanel } from './CodePanel';
import { GstManualCard } from './GstManualCard';

export function GstOwnershipCard({
  tax,
  hasUnsavedEdits,
}: {
  tax: TaxDetailView;
  hasUnsavedEdits: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const client = useQueryClient();
  const scope = useScope();
  const hasGstin = Boolean(tax.gstin);
  const active = hasGstin && tax.verificationState !== 'VERIFIED';
  const mode = useGstMode(active);
  const challengeQuery = useGstOwnership(active);
  const manual = useGstManual(active);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceManual, setForceManual] = useState(false);

  const challenge = challengeQuery.data ?? null;
  const live = challenge?.status === 'PENDING';
  const now = useNow(1000, live);

  // The last answer is for the GSTIN that was saved when it was made; a different GSTIN needs new codes.
  const sameGstin = challenge && challenge.gstin === tax.gstin;
  const view = gstOwnershipView({
    hasGstin,
    taxState: tax.verificationState,
    hasUnsavedEdits,
    otpAvailable: mode.data?.otpAvailable,
    challenge: sameGstin ? challenge : null,
  });

  const setChallenge = (next: GstOwnershipChallenge) => {
    client.setQueryData([...companyKeys.gst, scope], next);
  };

  const refreshTax = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.tax }),
      client.invalidateQueries({ queryKey: companyKeys.overview }),
      client.invalidateQueries({ queryKey: companyKeys.taxHistory }),
      client.invalidateQueries({ queryKey: queryKeys.access }),
    ]);
  };

  // Verified through the other channel or on another device: pick up the new state.
  useEffect(() => {
    if (
      challenge?.status === 'VERIFIED' &&
      tax.verificationState !== 'VERIFIED'
    ) {
      void refreshTax();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.status]);

  if (view.kind === 'hidden') return null;

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const next = await sendGstOwnershipOtp();
      setChallenge(next);
      track('gst_otp_sent', {});
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        GST_MANUAL_FALLBACK_CODES.includes(caught.code)
      ) {
        setForceManual(true);
      }
      setError(profileErrorMessage(caught, t));
    } finally {
      setSending(false);
    }
  };

  const confirm = async (field: 'emailCode' | 'mobileCode', code: string) => {
    if (!challenge) return;
    const next = await verifyGstOwnershipOtp({
      challengeId: challenge.id,
      [field]: code,
    });
    setChallenge(next);
    if (next.status === 'VERIFIED') {
      track('gst_verified', {});
      toast.show(t('gst.verified'), 'success');
      await refreshTax();
    }
  };

  if (view.kind === 'verified') {
    return (
      <Card style={styles.card} testID="gst-verified">
        <View style={styles.head}>
          <Icon name="verified" size={22} color={colors.success} />
          <Text variant="cardTitle">{t('gst.verified')}</Text>
        </View>
      </Card>
    );
  }

  if (view.kind === 'manual' || forceManual) {
    return (
      <GstManualCard
        gstin={tax.gstin ?? ''}
        reason={view.kind === 'manual' ? view.reason : 'contactUnavailable'}
        caseQuery={manual}
        onSubmitted={refreshTax}
      />
    );
  }

  return (
    <Card style={styles.card} testID="gst-ownership">
      <View style={styles.head}>
        <Icon name="shield" size={22} color={colors.secondary} />
        <Text variant="cardTitle" style={styles.flex}>
          {t('gst.own.title')}
        </Text>
      </View>
      <Text variant="meta" color={colors.textMuted}>
        {t('gst.own.body')}
      </Text>
      {error ? (
        <Banner tone="red" message={error} testID="gst-own-error" />
      ) : null}

      {view.kind === 'start' ? (
        <>
          <Text variant="small" color={colors.textMuted}>
            {t('gst.own.limits')}
          </Text>
          <Button
            label={t('gst.own.send')}
            onPress={send}
            loading={sending}
            disabled={sending}
            icon="sms"
            testID="gst-send"
          />
          <Button
            label={t('gst.own.useManual')}
            variant="ghost"
            onPress={() => setForceManual(true)}
          />
        </>
      ) : null}

      {view.kind === 'expired' ? (
        <>
          <Banner tone="amber" message={t('gst.own.expired')} />
          <Button
            label={t('gst.own.sendNew')}
            onPress={send}
            loading={sending}
            disabled={sending}
            testID="gst-send"
          />
        </>
      ) : null}

      {view.kind === 'failed' ? (
        <>
          <Banner tone="red" message={view.message} />
          <Button
            label={t('gst.own.sendNew')}
            onPress={send}
            loading={sending}
            disabled={sending}
            testID="gst-send"
          />
          <Button
            label={t('gst.own.useManual')}
            variant="ghost"
            onPress={() => setForceManual(true)}
          />
        </>
      ) : null}

      {view.kind === 'codes' && challenge ? (
        <>
          <Text
            variant="small"
            color={colors.textMuted}
            accessibilityLiveRegion="polite"
          >
            {t('gst.own.attempts', { count: challenge.attemptsRemaining })}
            {' · '}
            {t('gst.own.expiresIn', {
              time: clock(secondsUntil(challenge.expiresAt, now)),
            })}
          </Text>
          <ChannelPanel
            kind="email"
            done={challenge.emailVerified}
            masked={challenge.emailMasked}
            challenge={challenge}
            onSubmit={code => confirm('emailCode', code)}
            onResend={send}
          />
          <ChannelPanel
            kind="mobile"
            done={challenge.mobileVerified}
            masked={challenge.mobileMasked}
            challenge={challenge}
            onSubmit={code => confirm('mobileCode', code)}
            onResend={send}
          />
          <Button
            label={t('gst.own.useManual')}
            variant="ghost"
            onPress={() => setForceManual(true)}
          />
        </>
      ) : null}
    </Card>
  );
}

function ChannelPanel({
  kind,
  done,
  masked,
  challenge,
  onSubmit,
  onResend,
}: {
  kind: 'email' | 'mobile';
  done: boolean;
  masked: string | null;
  challenge: GstOwnershipChallenge;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}) {
  const t = useT();
  const title =
    kind === 'email' ? t('gst.own.emailCode') : t('gst.own.mobileCode');
  if (done) {
    return (
      <View style={styles.done} testID={`gst-${kind}-done`}>
        <Icon name="check_circle" size={20} color={colors.success} />
        <Text variant="label">
          {t('gst.own.confirmed', { channel: title })}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <Text variant="label">{title}</Text>
      <CodePanel
        testID={`gst-${kind}-code`}
        destination={masked}
        timings={{
          expiresInSeconds: secondsUntil(challenge.expiresAt),
          resendAfterSeconds: secondsUntil(challenge.resendAvailableAt),
        }}
        onSubmit={onSubmit}
        onResend={onResend}
        submitLabel={t('gst.own.confirm')}
      />
    </View>
  );
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  panel: { gap: spacing.sm },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
