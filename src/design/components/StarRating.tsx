import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, HIT_TARGET, palette, spacing } from '../tokens';
import { Icon } from './Icon';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Five tappable stars for choosing a rating. Read as one radio group: each star announces its own
 * label ("3 of 5 stars") and which one is selected. A star is at least the minimum touch size.
 */
export function StarRatingInput({
  value,
  onChange,
  starLabel,
  groupLabel,
  disabled = false,
  size = 36,
  testID,
}: {
  /** 0 when nothing is chosen yet. */
  value: number;
  onChange: (stars: number) => void;
  /** The spoken name of one star. */
  starLabel: (stars: number) => string;
  groupLabel: string;
  disabled?: boolean;
  size?: number;
  testID?: string;
}) {
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
      testID={testID}
    >
      {STARS.map(star => (
        <Pressable
          key={star}
          testID={testID ? `${testID}-${star}` : undefined}
          onPress={() => onChange(star)}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityLabel={starLabel(star)}
          accessibilityState={{
            selected: value === star,
            checked: value === star,
            disabled,
          }}
          style={styles.star}
        >
          <Icon
            name="star"
            size={size}
            color={star <= value ? palette.gold : colors.outlineVariant}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** Stars showing a rating that was already given. Decorative: the caller states the value in words. */
export function StarRatingDisplay({
  value,
  size = 20,
}: {
  value: number;
  size?: number;
}) {
  return (
    <View
      style={styles.display}
      importantForAccessibility="no-hide-descendants"
    >
      {STARS.map(star => (
        <Icon
          key={star}
          name="star"
          size={size}
          color={star <= value ? palette.gold : colors.outlineVariant}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  star: {
    minWidth: HIT_TARGET - 4,
    minHeight: HIT_TARGET - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  display: { flexDirection: 'row', gap: 2 },
});
