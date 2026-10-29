/**
 * The last line of defence for a screen that crashes while drawing. Without it a render error ends
 * the app on a blank screen; with it the seller sees a short apology and "Try again", and the
 * failure is reported (without personal data) so it can be fixed.
 *
 * It depends on nothing that could itself have failed — plain React Native views and the
 * language store, not the design system's providers — and sits above every provider.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/design/tokens';
import { t } from '@/i18n';
import { reportError } from '@/core/observability/errorReporting';

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, {
      source: 'error-boundary',
      // The component stack names screens and widgets, never data.
      stack: (info.componentStack ?? '').slice(0, 500),
    });
  }

  private retry = () => this.setState({ failed: false });

  override render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.root} accessibilityRole="alert" testID="app-error">
        <Text style={styles.title} accessibilityRole="header">
          {t('app.crashTitle')}
        </Text>
        <Text style={styles.body}>{t('app.crashBody')}</Text>
        <Pressable
          onPress={this.retry}
          accessibilityRole="button"
          style={styles.button}
          testID="app-error-retry"
        >
          <Text style={styles.buttonText}>{t('common.tryAgain')}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.onSurface,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
  },
  buttonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onPrimary,
  },
});
