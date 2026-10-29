/**
 * Launch and the server-controlled blocks.
 *
 * Launch: the splash shows while the app config loads and the session restores, in parallel, for
 * at most 4 seconds. A slow config falls back to the last one saved on this device (or the
 * bundled defaults); being offline never blocks entry.
 *
 * Blocks: a force update (installed < minSupportedVersion) is a full-screen dead end with an
 * Update button; maintenance switched on in the remote app config is a full-screen message
 * with Try again. (A write refused by a maintenance window is not a launch block: it shows an
 * inline message, see MaintenanceBlockHost.) Both are re-checked when the app returns to the foreground (at most every 15
 * minutes), so the update gate can be switched from the server with no release.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getHealth } from '@tradevistar/seller-api';
import { track } from '@/core/analytics/analytics';
import {
  decideLaunch,
  refreshAppConfig,
  refreshAppConfigIfStale,
  SPLASH_CAP_MS,
  useAppConfigState,
} from '@/core/appConfig/appConfigStore';
import { useSession } from '@/core/auth/SessionProvider';
import {
  Button,
  colors,
  Icon,
  palette,
  radii,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';

const launchStartedAt = Date.now();

export function LaunchGate({ children }: { children: React.ReactNode }) {
  const t = useT();
  const toast = useToast();
  const state = useAppConfigState();
  const { resolved } = state;
  const session = useSession();
  const [capReached, setCapReached] = useState(false);
  const [configAnswered, setConfigAnswered] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const opened = useRef(false);
  const forcedTracked = useRef(false);

  useEffect(() => {
    void refreshAppConfig().finally(() => setConfigAnswered(true));
    const timer = setTimeout(() => setCapReached(true), SPLASH_CAP_MS);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') refreshAppConfigIfStale();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  const ready =
    capReached || (configAnswered && session.status !== 'restoring');

  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    track('app_open', { launch_ms: Date.now() - launchStartedAt, cold: true });
  }, [ready]);

  const decision = decideLaunch(state);

  useEffect(() => {
    if (ready && decision.screen === 'forceUpdate' && !forcedTracked.current) {
      forcedTracked.current = true;
      track('update_forced', {
        installed: resolved.installedVersion,
        min_supported: resolved.config.minSupportedVersion,
      });
    }
  }, [decision.screen, ready, resolved]);

  // "Try again" checks the server is reachable and re-reads the remote config.
  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await getHealth();
      const next = await refreshAppConfig();
      if (next.resolved.config.maintenance?.active) {
        toast.show(t('maintenance.stillOn'));
      }
    } catch {
      toast.show(t('error.network'), 'error');
    } finally {
      setRetrying(false);
    }
  }, [t, toast]);

  if (!ready) return <Splash />;

  if (decision.screen === 'forceUpdate') {
    const url = resolved.config.updateUrl;
    return (
      <BlockingScreen
        testID="force-update"
        icon="system_update"
        title={t('update.title')}
        message={t('update.body', {
          installed: resolved.installedVersion,
          min: resolved.config.minSupportedVersion,
        })}
        footnote={url ? undefined : t('update.noStore')}
        actionLabel={url ? t('update.action') : undefined}
        onAction={
          url
            ? () => {
                void Linking.openURL(url);
              }
            : undefined
        }
      />
    );
  }

  if (decision.screen === 'maintenance') {
    return (
      <BlockingScreen
        testID="maintenance"
        icon="construction"
        title={t('maintenance.title')}
        message={resolved.config.maintenance.message ?? t('maintenance.body')}
        actionLabel={t('common.tryAgain')}
        onAction={() => {
          void retry();
        }}
        actionLoading={retrying}
      />
    );
  }

  return <>{children}</>;
}

function Splash() {
  const t = useT();
  return (
    <View
      style={styles.splash}
      testID="splash"
      accessibilityLabel="TradeVistar Seller"
    >
      <StatusBar barStyle="light-content" />
      <Image
        source={require('../../assets/logo-mark.png')}
        style={styles.logo}
        accessibilityIgnoresInvertColors
      />
      <Text variant="h1" color={palette.white}>
        TradeVistar Seller
      </Text>
      <Text variant="meta" color={palette.blue100}>
        {t('launch.tagline')}
      </Text>
      <ActivityIndicator color={palette.white} style={styles.spinner} />
    </View>
  );
}

function BlockingScreen({
  icon,
  title,
  message,
  footnote,
  actionLabel,
  onAction,
  actionLoading,
  testID,
}: {
  icon: string;
  title: string;
  message: string;
  footnote?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  testID?: string;
}) {
  return (
    <SafeAreaView style={styles.block} testID={testID}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.blockBody}>
        <View style={styles.iconCircle}>
          <Icon name={icon} size={44} color={colors.secondary} />
        </View>
        <Text
          variant="h1"
          align="center"
          color={colors.secondary}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text variant="body" color={colors.textMuted} align="center">
          {message}
        </Text>
        {footnote ? (
          <Text variant="small" color={colors.textMuted} align="center">
            {footnote}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button
          testID={testID ? `${testID}-action` : undefined}
          label={actionLabel}
          onPress={onAction}
          loading={actionLoading}
          fullWidth
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: radii.xl,
    marginBottom: spacing.md,
  },
  spinner: { marginTop: spacing.xxl },
  block: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xxl,
    justifyContent: 'space-between',
  },
  blockBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
