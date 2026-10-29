import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, MAX_FONT_SCALE, radii, spacing, typography } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export interface TextAreaProps
  extends Omit<TextInputProps, 'multiline' | 'maxLength'> {
  label: string;
  /** Hard limit; typing stops here and the counter shows how close the text is. */
  max: number;
  error?: string | null;
  hint?: string;
  /** Visible height in lines. */
  rows?: number;
  /** The counter appears from this many characters (default: always). */
  counterFrom?: number;
}

/**
 * A multi-line input with a label, a character counter and an error or hint, announced together
 * to screen readers. For free text such as a reason or a comment.
 */
export const TextArea = forwardRef<
  React.ComponentRef<typeof TextInput>,
  TextAreaProps
>(function TextAreaImpl(
  {
    label,
    max,
    error,
    hint,
    rows = 3,
    counterFrom = 0,
    value = '',
    style,
    editable = true,
    ...rest
  },
  ref,
) {
  const length = value.length;
  const showCounter = length >= counterFrom;
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
      <TextInput
        ref={ref}
        value={value}
        multiline
        maxLength={max}
        editable={editable}
        textAlignVertical="top"
        placeholderTextColor={colors.outline}
        selectionColor={colors.secondary}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityLabel={error ? `${label}, ${error}` : label}
        style={[
          styles.input,
          { minHeight: rows * typography.body.lineHeight + spacing.md * 2 },
          error ? styles.invalid : null,
          !editable ? styles.disabled : null,
          style,
        ]}
        {...rest}
      />
      <View style={styles.footer}>
        <View style={styles.message}>
          {error ? (
            <View style={styles.errorRow} accessibilityLiveRegion="polite">
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
        {showCounter ? (
          <Text
            variant="small"
            color={length >= max ? colors.error : colors.textMuted}
          >
            {length} / {max}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  flex: { flex: 1 },
  input: {
    ...typography.body,
    color: colors.onSurface,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  invalid: { borderColor: colors.error, borderWidth: 1.5 },
  disabled: { backgroundColor: colors.surfaceContainer },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  message: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
