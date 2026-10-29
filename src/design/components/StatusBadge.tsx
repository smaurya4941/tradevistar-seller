import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  formatStatusLabel,
  normalizeStatusText,
  type StatusTone,
} from '@tradevistar/seller-api';
import { useToneColors } from '../theme';
import { spacing, type Tone } from '../tokens';
import { Text } from './Text';

/**
 * Web tone names (`StatusBadge` in the seller portal) to the app's tone tokens. The web has no
 * "emerald" or "amber"; "gray" and "orange" are its names for slate and the brand orange.
 */
const TONE_FOR: Record<StatusTone, Tone> = {
  green: 'green',
  orange: 'orange',
  blue: 'blue',
  red: 'red',
  gray: 'gray',
  purple: 'purple',
};

export interface StatusBadgeProps {
  /** A backend enum value (`READY_TO_SHIP`) or authored text; machine-like text is prettified. */
  status: string;
  tone?: StatusTone;
  /** Treat `status` as a raw enum value and always format it (`PENDING_KYC` → "Pending KYC"). */
  isEnum?: boolean;
  testID?: string;
}

/**
 * A status as the web shows it: compact coloured text with a dot, no chip. Labels go through the
 * same formatter as the portal, so "KYC", "GST" and "COD" stay upper case.
 */
export function StatusBadge({
  status,
  tone = 'gray',
  isEnum = false,
  testID,
}: StatusBadgeProps) {
  const look = useToneColors(TONE_FOR[tone]);
  const label = isEnum
    ? formatStatusLabel(status)
    : normalizeStatusText(status);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={[styles.dot, { backgroundColor: look.foreground }]} />
      <Text variant="badge" color={look.foreground}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
