/**
 * Controls and rows added in Phase 1: Checkbox, ListRow, ChoiceRow, Avatar, CountBadge, Banner,
 * InlineLink and SectionTitle. All touch targets are at least 48 dp and every control speaks its
 * role and state to screen readers.
 */
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  colors,
  HIT_TARGET,
  palette,
  radii,
  spacing,
  tones,
  type Tone,
} from '../tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export function Checkbox({
  checked,
  onChange,
  children,
  accessibilityLabel,
  invalid = false,
  disabled = false,
  testID,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  invalid?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={styles.checkRow}
    >
      <View
        style={[
          styles.checkBox,
          checked && styles.checkBoxOn,
          invalid && !checked && styles.checkBoxInvalid,
        ]}
      >
        {checked ? (
          <Icon name="check" size={16} color={colors.onPrimary} />
        ) : null}
      </View>
      <View style={styles.flex}>{children}</View>
    </Pressable>
  );
}

export function CountBadge({
  count,
  style,
}: {
  count: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (!count || count <= 0) return null;
  return (
    <View
      style={[styles.count, style]}
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="badge" color={palette.white} style={styles.countText}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

export interface ListRowProps {
  label: string;
  icon?: string;
  value?: string;
  description?: string;
  badge?: number;
  onPress?: () => void;
  destructive?: boolean;
  /** Replaces the chevron (e.g. an external-link glyph). */
  trailingIcon?: string | null;
  accessibilityHint?: string;
  testID?: string;
}

export function ListRow({
  label,
  icon,
  value,
  description,
  badge = 0,
  onPress,
  destructive = false,
  trailingIcon = 'chevron_right',
  accessibilityHint,
  testID,
}: ListRowProps) {
  const color = destructive ? colors.error : colors.onSurface;
  const a11yLabel = [label, value, badge > 0 ? `${badge}` : null]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {icon ? (
        <View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>
          <Icon
            name={icon}
            size={20}
            color={destructive ? colors.error : colors.secondary}
          />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text variant="label" color={color}>
          {label}
        </Text>
        {description ? (
          <Text variant="small" color={colors.textMuted}>
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="meta" color={colors.textMuted} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      <CountBadge count={badge} />
      {onPress && trailingIcon ? (
        <Icon name={trailingIcon} size={20} color={colors.outline} />
      ) : null}
    </Pressable>
  );
}

/** A single-choice option row (radio semantics). */
export function ChoiceRow({
  label,
  description,
  selected,
  onPress,
  testID,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={description ? `${label}, ${description}` : label}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.flex}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="small" color={colors.textMuted}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * The web HeaderAvatar: a usable image URL (absolute, or the API's own avatar path) or initials
 * on the brand blue. A broken image falls back to initials.
 */
export function Avatar({
  uri,
  name,
  size = 56,
}: {
  uri: string | null | undefined;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[dimension, styles.avatarImage]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  const initials = initialsOf(name);
  return (
    <View style={[dimension, styles.avatar]} accessible={false}>
      {initials ? (
        <Text
          variant="h3"
          color={palette.white}
          allowFontScaling={false}
          style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}
        >
          {initials}
        </Text>
      ) : (
        <Icon name="person" size={size * 0.5} color={palette.white} />
      )}
    </View>
  );
}

const BANNER_ICON: Record<Tone, string> = {
  amber: 'warning',
  blue: 'info',
  green: 'check_circle',
  emerald: 'check_circle',
  red: 'error',
  orange: 'campaign',
  purple: 'info',
  slate: 'info',
  gray: 'info',
};

export function Banner({
  tone = 'blue',
  title,
  message,
  icon,
  actionLabel,
  onAction,
  actionLoading,
  onDismiss,
  dismissLabel,
  onPress,
  style,
  testID,
}: {
  tone?: Tone;
  title?: string;
  message?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Makes the whole banner tappable (e.g. to open the screen it is about). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const look = tones[tone];
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.banner, { backgroundColor: look.background }, style]}
      accessibilityRole={onPress ? 'button' : 'alert'}
    >
      <View style={styles.bannerTop}>
        <Icon
          name={icon ?? BANNER_ICON[tone]}
          size={20}
          color={look.foreground}
        />
        <View style={styles.flex}>
          {title ? (
            <Text variant="cardTitle" color={look.foreground}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text variant="meta" color={look.foreground}>
              {message}
            </Text>
          ) : null}
        </View>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel ?? 'Dismiss'}
          >
            <Icon name="close" size={20} color={look.foreground} />
          </Pressable>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          loading={actionLoading}
          size="sm"
          variant="outline"
          style={styles.bannerAction}
        />
      ) : null}
    </Pressable>
  );
}

/** Tappable text inside a sentence (Terms, Privacy, "Change"). */
export function InlineLink({
  label,
  onPress,
  color = colors.link,
  testID,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  testID?: string;
}) {
  return (
    <Text
      testID={testID}
      variant="small"
      color={color}
      onPress={onPress}
      accessibilityRole="link"
      suppressHighlighting={false}
      style={styles.inlineLink}
    >
      {label}
    </Text>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      variant="badge"
      color={colors.textMuted}
      accessibilityRole="header"
      style={styles.sectionTitle}
    >
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: HIT_TARGET,
    paddingVertical: spacing.sm,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  checkBoxInvalid: { borderColor: colors.error },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, lineHeight: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_TARGET + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfaceContainerLow },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: palette.blue50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: palette.red50 },
  rowValue: { maxWidth: '45%', textAlign: 'right' },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_TARGET + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  choiceSelected: { borderColor: colors.secondary, borderWidth: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.secondary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.secondary,
  },
  avatar: {
    backgroundColor: palette.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { backgroundColor: colors.surfaceContainer },
  banner: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  bannerTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  bannerAction: { alignSelf: 'flex-start', marginLeft: 28 },
  inlineLink: { textDecorationLine: 'underline' },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    letterSpacing: 0.6,
  },
});
