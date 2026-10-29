/**
 * A slim banner under the status bar while the device has no connection. Nothing is signed out
 * for being offline; actions that need the network say so themselves.
 */
import { useNetInfo } from '@react-native-community/netinfo';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isOffline } from '@/core/network/connectivity';
import { colors, Icon, spacing, Text } from '@/design';
import { useT } from '@/i18n';

export function OfflineBanner() {
  const t = useT();
  const net = useNetInfo();
  const insets = useSafeAreaInsets();
  if (!isOffline(net)) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="offline-banner"
    >
      <View style={styles.pill}>
        <Icon name="cloud_off" size={16} color={colors.onToast} />
        <Text variant="badge" color={colors.onToast}>
          {t('offline.banner')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.toast,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
});
