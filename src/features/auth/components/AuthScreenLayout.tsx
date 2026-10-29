/**
 * The frame every signed-out screen shares: a back button when there is somewhere to go back to,
 * the brand badge, a heading, and a scrolling body that keeps taps working while the keyboard is
 * up (the activity resizes for the keyboard, and a tap outside a field does not swallow the first
 * tap on a button).
 */
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  HIT_TARGET,
  Icon,
  palette,
  radii,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';

export function AuthScreenLayout({
  title,
  subtitle,
  icon = 'storefront',
  children,
  footer,
  showBack = true,
  testID,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showBack?: boolean;
  testID?: string;
}) {
  const navigation = useNavigation();
  const t = useT();
  const canGoBack = showBack && navigation.canGoBack();

  return (
    <SafeAreaView style={styles.root} testID={testID}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          {canGoBack ? (
            <Pressable
              testID="auth-back"
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerPressed,
              ]}
            >
              <Icon name="arrow_back" size={22} color={colors.secondary} />
            </Pressable>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.badge}>
            <Icon name={icon} size={24} color={palette.white} />
          </View>
          <Text
            variant="h1"
            color={colors.secondary}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {typeof subtitle === 'string' ? (
            <Text variant="body" color={colors.textMuted}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  headerButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: HIT_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPressed: { backgroundColor: colors.surfaceContainer },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radii.xl,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  body: { gap: spacing.lg, marginTop: spacing.lg },
  footer: { marginTop: spacing.xl, gap: spacing.md, alignItems: 'center' },
});
