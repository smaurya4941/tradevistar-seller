import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, HIT_TARGET, radii, spacing } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const VARIANTS: Record<
  ButtonVariant,
  { bg: string; pressed: string; fg: string; border?: string }
> = {
  primary: {
    bg: colors.primary,
    pressed: colors.primaryPressed,
    fg: colors.onPrimary,
  },
  secondary: {
    bg: colors.secondary,
    pressed: colors.secondaryPressed,
    fg: colors.onSecondary,
  },
  outline: {
    bg: 'transparent',
    pressed: colors.surfaceContainer,
    fg: colors.secondary,
    border: colors.outlineVariant,
  },
  ghost: {
    bg: 'transparent',
    pressed: colors.surfaceContainer,
    fg: colors.link,
  },
  danger: {
    bg: colors.error,
    pressed: colors.onErrorContainer,
    fg: colors.onPrimary,
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const look = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        {
          backgroundColor: pressed ? look.pressed : look.bg,
          borderColor: look.border ?? 'transparent',
          borderWidth: look.border ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: disabled && !loading ? 0.45 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={look.fg} />
        ) : icon ? (
          <Icon name={icon} size={size === 'sm' ? 18 : 20} color={look.fg} />
        ) : null}
        <Text
          variant="button"
          color={look.fg}
          numberOfLines={2}
          align="center"
          style={styles.label}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  md: { minHeight: HIT_TARGET + 4, paddingHorizontal: spacing.xl },
  sm: { minHeight: 40, paddingHorizontal: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  label: { flexShrink: 1 },
});
