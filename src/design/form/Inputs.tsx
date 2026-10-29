import {
  addDays,
  isCalendarDate,
  minutesToTime,
  phonePlaceholder,
  phonePrefixLabel,
  sanitizePhone,
  timeToMinutes,
  todayInZone,
} from '@tradevistar/seller-api';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { Field, Input, type FieldProps } from '../components/Field';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';
import { colors, HIT_TARGET, radii, spacing } from '../tokens';

/* ------------------------------------------------------------------ phone */

export interface PhoneFieldProps
  extends Omit<
    FieldProps,
    'value' | 'onChangeText' | 'keyboardType' | 'leading'
  > {
  value: string;
  onChangeText: (value: string) => void;
  /** The country the number belongs to unless a "+" code is typed (default India). */
  countryCode?: string;
}

/** A phone input with the prefix chip: bare digits are national, a "+" sets the country. */
export function PhoneField({
  value,
  onChangeText,
  countryCode = 'IN',
  ...rest
}: PhoneFieldProps) {
  return (
    <Field
      {...rest}
      value={value}
      onChangeText={raw =>
        onChangeText(
          raw.trim().startsWith('+')
            ? sanitizePhone(raw)
            : sanitizePhone(raw, countryCode),
        )
      }
      keyboardType="phone-pad"
      autoComplete="tel"
      placeholder={rest.placeholder ?? phonePlaceholder(countryCode)}
      leading={
        <Text variant="label" color={colors.onSurfaceVariant}>
          {phonePrefixLabel(value, countryCode)}
        </Text>
      }
    />
  );
}

/* ------------------------------------------------------------------ date and time */

/** Keeps digits and dashes, shaping typing into `YYYY-MM-DD`. */
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [
    digits.slice(0, 4),
    digits.slice(4, 6),
    digits.slice(6, 8),
  ].filter(Boolean);
  return parts.join('-');
}

export interface DateFieldProps
  extends Omit<FieldProps, 'value' | 'onChangeText' | 'keyboardType'> {
  value: string;
  onChangeText: (value: string) => void;
  /** Zone for the "Today" / "+1 day" shortcuts (the seller's timezone, not the phone's). */
  timezone?: string;
  /** Shortcuts shown under the field. */
  shortcuts?: boolean;
}

/**
 * A calendar date typed as `YYYY-MM-DD` (masked as the seller types) with "Today" and day-step
 * shortcuts. Dates are plain calendar dates in the seller's timezone, so no picker library is
 * needed and nothing shifts with the phone's zone.
 */
export function DateField({
  value,
  onChangeText,
  timezone = 'Asia/Kolkata',
  shortcuts = true,
  ...rest
}: DateFieldProps) {
  const t = useT();
  const today = todayInZone(timezone);
  const step = (days: number) => {
    const base = isCalendarDate(value) ? value : today;
    onChangeText(addDays(base, days));
  };
  return (
    <View style={styles.stack}>
      <Field
        {...rest}
        value={value}
        onChangeText={raw => onChangeText(maskDate(raw))}
        keyboardType="number-pad"
        placeholder={rest.placeholder ?? t('form.date.placeholder')}
        maxLength={10}
        trailing={
          <Icon name="calendar_today" size={20} color={colors.outline} />
        }
      />
      {shortcuts ? (
        <View style={styles.shortcuts}>
          <Shortcut
            label={t('date.today')}
            onPress={() => onChangeText(today)}
          />
          <Shortcut label={t('date.minusDay')} onPress={() => step(-1)} />
          <Shortcut label={t('date.plusDay')} onPress={() => step(1)} />
          <Shortcut label={t('date.plusWeek')} onPress={() => step(7)} />
        </View>
      ) : null}
    </View>
  );
}

function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.shortcut,
        pressed && styles.shortcutPressed,
      ]}
    >
      <Text variant="small" color={colors.secondary}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Shapes typing into `HH:MM`. */
export function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2
    ? digits
    : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export interface TimeFieldProps
  extends Omit<FieldProps, 'value' | 'onChangeText' | 'keyboardType'> {
  value: string;
  onChangeText: (value: string) => void;
  /** Step buttons move by this many minutes. */
  stepMinutes?: number;
}

/** A time of day typed as `HH:MM` with minus and plus buttons. */
export function TimeField({
  value,
  onChangeText,
  stepMinutes = 30,
  ...rest
}: TimeFieldProps) {
  const t = useT();
  const bump = (direction: 1 | -1) => {
    const current = timeToMinutes(value) ?? 9 * 60;
    const next = Math.min(1440, Math.max(0, current + direction * stepMinutes));
    onChangeText(minutesToTime(next));
  };
  return (
    <Field
      {...rest}
      value={value}
      onChangeText={raw => onChangeText(maskTime(raw))}
      keyboardType="number-pad"
      placeholder={rest.placeholder ?? t('form.time.placeholder')}
      maxLength={5}
      trailing={
        <View style={styles.stepper}>
          <StepButton
            icon="remove"
            label={t('time.earlier')}
            onPress={() => bump(-1)}
          />
          <StepButton
            icon="add"
            label={t('time.later')}
            onPress={() => bump(1)}
          />
        </View>
      }
    />
  );
}

function StepButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.step}
    >
      <Icon name={icon} size={18} color={colors.secondary} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ secure number */

export interface SecureNumberFieldProps
  extends Omit<
    FieldProps,
    | 'secureTextEntry'
    | 'autoComplete'
    | 'autoCorrect'
    | 'autoCapitalize'
    | 'keyboardType'
  > {
  /** Digits only (account numbers); otherwise letters and digits. */
  digitsOnly?: boolean;
}

/**
 * For account numbers and other secrets that are typed twice: hidden text, no suggestions, no
 * autofill, no paste of a rich value, and never exposed to the keyboard's learning.
 */
export function SecureNumberField({
  digitsOnly = true,
  onChangeText,
  ...rest
}: SecureNumberFieldProps) {
  return (
    <Field
      {...rest}
      onChangeText={raw =>
        onChangeText?.(digitsOnly ? raw.replace(/\D/g, '') : raw)
      }
      secureTextEntry
      keyboardType={digitsOnly ? 'number-pad' : 'default'}
      autoComplete="off"
      autoCorrect={false}
      autoCapitalize="none"
      importantForAutofill="no"
      textContentType="none"
      spellCheck={false}
      contextMenuHidden
    />
  );
}

/* ------------------------------------------------------------------ read-only rows */

/** A label and a value on one row; the value may be a masked string or any node. */
export function InfoRow({
  label,
  value,
  trailing,
  testID,
}: {
  label: string;
  value?: string | null;
  trailing?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      style={styles.infoRow}
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value ?? ''}`}
    >
      <Text variant="meta" color={colors.textMuted} style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={styles.infoValue}>
        {value && value.length > 0 ? value : '—'}
      </Text>
      {trailing}
    </View>
  );
}

/** A masked value (an account number, a GSTIN) that the seller can reveal for a moment. */
export function MaskedValueRow({
  label,
  masked,
}: {
  label: string;
  masked: string;
}) {
  return <InfoRow label={label} value={masked} />;
}

/* ------------------------------------------------------------------ chips */

export interface ChipOption {
  value: string;
  label: string;
}

/** A wrapping row of single-choice chips (address purposes, filters). */
export function ChipRow({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  testID?: string;
}) {
  return (
    <View style={styles.chips} testID={testID} accessibilityRole="radiogroup">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            style={[styles.chip, selected && styles.chipOn]}
          >
            <Text
              variant="label"
              color={selected ? colors.onSecondary : colors.onSurface}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { Input };

const styles = StyleSheet.create({
  stack: { gap: spacing.xs },
  shortcuts: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  shortcut: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
  },
  shortcutPressed: { backgroundColor: colors.surfaceContainerHigh },
  stepper: { flexDirection: 'row', gap: spacing.xs },
  step: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 28,
  },
  infoLabel: { width: 120 },
  infoValue: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: HIT_TARGET - 8,
    paddingHorizontal: spacing.md + 2,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
});
