/**
 * Where a seller lands when sign-in, OTP sign-in, two-factor completion or a session refresh says
 * the account is waiting for approval (SELLER_APPROVAL_PENDING) or was turned down
 * (SELLER_REJECTED). The server's message is shown as sent: for a rejection it carries the admin's
 * reason.
 *
 * It is driven by the session state, not by a stored flag: leaving the screen (or restarting the
 * app) returns to sign-in, and nothing from the failed attempt remains on the device.
 */
import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '@/core/analytics/analytics';
import { useSessionEngine } from '@/core/auth/SessionProvider';
import type { ApprovalKind } from '@/core/auth/sessionEngine';
import { env } from '@/config/env';
import { Button, colors, Icon, palette, radii, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { openSupportEmail, openSupportPhone } from './support';

export function ApprovalStatusScreen({
  approval,
  message,
}: {
  approval: ApprovalKind;
  message: string;
}) {
  const t = useT();
  const engine = useSessionEngine();
  const pending = approval === 'pending';

  useEffect(() => {
    // The sign-in that led here already counted it; a refresh-time hold is counted once here.
    track(pending ? 'approval_pending_seen' : 'approval_rejected_seen', {});
  }, [pending]);

  const shown =
    message.trim() ||
    t(pending ? 'approval.pending.fallback' : 'approval.rejected.fallback');

  return (
    <SafeAreaView
      style={styles.root}
      testID={pending ? 'screen-approval-pending' : 'screen-approval-rejected'}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View
          style={[
            styles.badge,
            { backgroundColor: pending ? palette.amber100 : palette.red100 },
          ]}
        >
          <Icon
            name={pending ? 'hourglass_top' : 'block'}
            size={36}
            color={pending ? palette.amber700 : palette.red700}
          />
        </View>
        <Text
          variant="h1"
          color={colors.secondary}
          align="center"
          accessibilityRole="header"
        >
          {t(pending ? 'approval.pending.title' : 'approval.rejected.title')}
        </Text>
        <Text
          variant="body"
          color={colors.onSurfaceVariant}
          align="center"
          testID="approval-message"
        >
          {shown}
        </Text>

        {pending ? (
          <View style={styles.steps}>
            {(
              [
                'approval.pending.step1',
                'approval.pending.step2',
                'approval.pending.step3',
              ] as const
            ).map((key, index) => (
              <View key={key} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text variant="badge" color={palette.white}>
                    {index + 1}
                  </Text>
                </View>
                <Text variant="body" style={styles.stepText}>
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          {pending ? (
            <Button
              label={t('approval.pending.retry')}
              onPress={() => engine.dismissApproval()}
              fullWidth
              testID="approval-retry"
            />
          ) : null}
          <Button
            label={t('approval.contactSupport')}
            variant={pending ? 'outline' : 'primary'}
            onPress={() => openSupportEmail()}
            fullWidth
            testID="approval-support"
          />
          {env.supportPhone ? (
            <Button
              label={env.supportPhone}
              variant="ghost"
              icon="call"
              onPress={openSupportPhone}
              fullWidth
              testID="approval-phone"
            />
          ) : null}
          <Button
            label={t('approval.useAnother')}
            variant="ghost"
            onPress={() => engine.dismissApproval()}
            fullWidth
            testID="approval-other"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
});
