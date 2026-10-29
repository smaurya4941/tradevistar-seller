import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { Card } from '../components/Surfaces';
import { colors, radii, spacing } from '../tokens';

export interface FormScreenProps {
  children: React.ReactNode;
  /** Shows the sticky save bar. */
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  saveLabel?: string;
  /** Disables Save (a field is invalid, a check is running). */
  saveDisabled?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The shell of every edit screen: a scrolling form with section cards and, only while something
 * has changed, a sticky save bar that says "You have unsaved changes". Leaving with unsaved edits
 * is guarded by `useUnsavedGuard` in the screen.
 */
export function FormScreen({
  children,
  dirty = false,
  saving = false,
  onSave,
  saveLabel,
  saveDisabled = false,
  refreshControl,
  contentStyle,
  testID,
}: FormScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID={testID}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
      {dirty && onSave ? (
        <View
          style={[
            styles.bar,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text
            variant="meta"
            color={colors.primaryPressed}
            style={styles.barText}
          >
            {t('form.unsaved')}
          </Text>
          <Button
            label={saving ? t('form.saving') : saveLabel ?? t('form.save')}
            onPress={onSave}
            loading={saving}
            disabled={saving || saveDisabled}
            testID="form-save"
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** A titled card that groups related fields. */
export function FormSection({
  title,
  description,
  children,
  testID,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Card style={styles.section} testID={testID}>
      {title ? (
        <View style={styles.sectionHead}>
          <Text variant="section" accessibilityRole="header">
            {title}
          </Text>
          {description ? (
            <Text variant="small" color={colors.textMuted}>
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  barText: { flex: 1 },
  section: { gap: spacing.md, borderRadius: radii.lg },
  sectionHead: { gap: spacing.xxs },
});
