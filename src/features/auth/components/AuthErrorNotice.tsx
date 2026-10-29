/**
 * A failed attempt, shown as a red banner with the way forward that fits it: a lockout offers
 * password reset and support; a buyer-only account offers to create a seller account.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { MappedError } from '@/core/errors/errorMapper';
import { Banner, InlineLink, spacing, Text, colors } from '@/design';
import { useT } from '@/i18n';
import { openSupportEmail } from '../support';

export function AuthErrorNotice({
  error,
  onResetPassword,
  onCreateAccount,
  testID = 'auth-error',
}: {
  error: MappedError;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
  testID?: string;
}) {
  const t = useT();
  return (
    <View style={styles.root}>
      <Banner tone="red" message={error.message} testID={testID} />
      {error.action === 'recoverAccount' ? (
        <View style={styles.links}>
          <Text variant="small" color={colors.textMuted}>
            {t('auth.locked.help')}
          </Text>
          <View style={styles.row}>
            {onResetPassword ? (
              <InlineLink
                label={t('auth.resetPassword')}
                onPress={onResetPassword}
                testID="auth-error-reset"
              />
            ) : null}
            <InlineLink
              label={t('auth.contactSupport')}
              onPress={() => openSupportEmail()}
              testID="auth-error-support"
            />
          </View>
        </View>
      ) : null}
      {error.action === 'createSellerAccount' && onCreateAccount ? (
        <InlineLink
          label={t('auth.createAccount.action')}
          onPress={onCreateAccount}
          testID="auth-error-create"
        />
      ) : null}
      {error.action === 'contactSupport' && error.kind === 'suspended' ? (
        <InlineLink
          label={t('auth.contactSupport')}
          onPress={() => openSupportEmail()}
          testID="auth-error-support"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  links: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.lg },
});
