/**
 * The one "verification required" sheet every disabled write action and every unexpected
 * ACCOUNT_VERIFICATION_REQUIRED refusal opens. Mounted once, near the root.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, colors, spacing, Text } from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { openVerification } from './ViewOnlyBanner';
import {
  closeVerificationSheet,
  useVerificationSheet,
} from './verificationSheetStore';
import { useAccess } from './useAccess';

const STATUS_KEY: Record<string, TranslationKey> = {
  PENDING: 'access.status.PENDING',
  SUBMITTED: 'access.status.SUBMITTED',
  REJECTED: 'access.status.REJECTED',
};

export function VerificationSheet() {
  const t = useT();
  const sheet = useVerificationSheet();
  const { kycStatus } = useAccess();
  // The status in the refusal is the freshest; the access query is the fallback.
  const status = sheet.kycStatus ?? kycStatus ?? 'PENDING';

  return (
    <BottomSheet
      visible={sheet.open}
      onClose={closeVerificationSheet}
      title={t('access.sheet.title')}
    >
      <View style={styles.content} testID="verification-sheet">
        <Text variant="body" color={colors.textMuted}>
          {t('access.sheet.body')}
        </Text>
        <Text variant="bodyStrong">
          {t(STATUS_KEY[status] ?? STATUS_KEY.PENDING)}
        </Text>
      </View>
      <Button
        label={t('access.complete')}
        onPress={() => {
          closeVerificationSheet();
          openVerification();
        }}
        fullWidth
        testID="verification-sheet-complete"
      />
      <Button
        label={t('access.sheet.close')}
        variant="ghost"
        onPress={closeVerificationSheet}
        fullWidth
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
});
