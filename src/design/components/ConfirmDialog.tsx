import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../theme';
import { radii, spacing } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as destructive (sign out, delete). */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/** A centred yes/no dialog. The Android back button and a tap outside both cancel. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  testID,
}: ConfirmDialogProps) {
  const colors = useThemeColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: colors.scrim }]}
        onPress={onCancel}
        accessibilityLabel={cancelLabel}
        accessibilityRole="button"
      >
        <Pressable
          style={[styles.dialog, { backgroundColor: colors.surface }]}
          accessibilityViewIsModal
          testID={testID}
        >
          <Text variant="h3" accessibilityRole="header">
            {title}
          </Text>
          {message ? (
            <Text variant="body" color={colors.textMuted}>
              {message}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              variant="ghost"
              size="sm"
              onPress={onCancel}
              disabled={loading}
              testID={testID ? `${testID}-cancel` : undefined}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              size="sm"
              loading={loading}
              onPress={onConfirm}
              testID={testID ? `${testID}-confirm` : undefined}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  dialog: {
    alignSelf: 'stretch',
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
