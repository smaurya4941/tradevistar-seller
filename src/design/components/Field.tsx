import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import {
  colors,
  fonts,
  HIT_TARGET,
  MAX_FONT_SCALE,
  radii,
  spacing,
} from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  invalid?: boolean;
  leadingIcon?: string;
  /** Rendered inside the box after the text: a show/hide toggle, a Verify button, a status. */
  trailing?: React.ReactNode;
  /** Rendered inside the box before the text, e.g. a +91 prefix. */
  leading?: React.ReactNode;
}

/** A single-line input with the storefront's border, focus and error treatment. */
export const Input = forwardRef<
  React.ComponentRef<typeof TextInput>,
  InputProps
>(function InputImpl(
  {
    invalid = false,
    leadingIcon,
    trailing,
    leading,
    style,
    onFocus,
    onBlur,
    editable = true,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = invalid
    ? colors.error
    : focused
    ? colors.secondary
    : colors.outlineVariant;
  return (
    <View
      style={[
        styles.box,
        { borderColor },
        (focused || invalid) && styles.boxActive,
        !editable && styles.disabled,
      ]}
    >
      {leadingIcon ? (
        <Icon name={leadingIcon} size={20} color={colors.outline} />
      ) : null}
      {leading}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.outline}
        selectionColor={colors.secondary}
        editable={editable}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        onFocus={event => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, style]}
        {...rest}
      />
      {trailing}
    </View>
  );
});

export interface FieldProps extends InputProps {
  label: string;
  error?: string | null;
  hint?: string;
}

/** Label + input + error or hint, announced together to screen readers. */
export const Field = forwardRef<
  React.ComponentRef<typeof TextInput>,
  FieldProps
>(function FieldImpl({ label, error, hint, ...input }, ref) {
  return (
    <View style={styles.field}>
      <Text
        variant="label"
        color={colors.onSurfaceVariant}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {label}
      </Text>
      <Input
        ref={ref}
        accessibilityLabel={error ? label + ', ' + error : label}
        invalid={Boolean(error)}
        {...input}
      />
      {error ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <Icon name="error" size={16} color={colors.error} />
          <Text variant="small" color={colors.error} style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  box: {
    minHeight: HIT_TARGET + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boxActive: { borderWidth: 1.5 },
  disabled: { backgroundColor: colors.surfaceContainer },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.onSurface,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
