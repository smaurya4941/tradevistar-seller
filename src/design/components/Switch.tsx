import React from 'react';
import { StyleSheet, Switch as RNSwitch, View } from 'react-native';
import { useThemeColors } from '../theme';
import { HIT_TARGET, spacing } from '../tokens';
import { Text } from './Text';

export interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

/** A labelled on/off row with a 48 dp touch target; speaks its role and state to screen readers. */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}: SwitchRowProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="label">{label}</Text>
        {description ? (
          <Text variant="small" color={colors.textMuted}>
            {description}
          </Text>
        ) : null}
      </View>
      <RNSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: { flex: 1 },
});
