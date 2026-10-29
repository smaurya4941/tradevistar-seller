/**
 * The message shown when a write is refused because a maintenance window pauses it. Reads keep
 * working and nobody is signed out, so this is a sheet the seller can close, not a screen.
 */
import { formatIstDateTime } from '@tradevistar/seller-api';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  dismissMaintenanceBlock,
  useMaintenanceBlock,
} from '@/core/appConfig/maintenanceBlock';
import { BottomSheet, Button, colors, spacing, Text } from '@/design';
import { useT } from '@/i18n';

export function MaintenanceBlockHost() {
  const t = useT();
  const block = useMaintenanceBlock();
  const when = block?.endsAt ? formatIstDateTime(block.endsAt) : '';

  return (
    <BottomSheet
      visible={block !== null}
      onClose={dismissMaintenanceBlock}
      title={t('maintenance.paused.title')}
    >
      <View style={styles.content} testID="maintenance-block">
        <Text variant="body" color={colors.textMuted}>
          {block?.message || t('maintenance.paused.body')}
        </Text>
        {when ? (
          <Text variant="bodyStrong">
            {t('maintenance.availableAt', { when: `${when} IST` })}
          </Text>
        ) : null}
      </View>
      <Button
        label={t('common.close')}
        variant="outline"
        onPress={dismissMaintenanceBlock}
        fullWidth
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
});
