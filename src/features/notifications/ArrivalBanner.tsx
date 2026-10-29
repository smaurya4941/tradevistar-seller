/**
 * The small banner for a notification that arrives while the app is open: icon, title and a line
 * of the body, tappable to mark it read and open where it leads, gone after a few seconds. No
 * system notification is raised in the foreground. Titles and bodies are shown, never logged.
 */
import {
  lookOf,
  notificationRoute,
  type SellerNotification,
} from '@tradevistar/seller-api';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openPortalHref } from '@/app/navigation/openHref';
import { useSession } from '@/core/auth/SessionProvider';
import { useStore } from '@/core/store';
import {
  colors,
  Icon,
  palette,
  radii,
  spacing,
  Text,
  tones,
  type Tone,
} from '@/design';
import { useT } from '@/i18n';
import { arrivalBannerStore, dismissArrivalBanner } from './arrivalBannerStore';
import { markRead } from './data';

export const BANNER_MS = 5_000;

export function ArrivalBanner() {
  const t = useT();
  const session = useSession();
  const row = useStore(arrivalBannerStore);
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!row) return;
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(slide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => dismissArrivalBanner());
    }, BANNER_MS);
    return () => clearTimeout(timer);
  }, [row, slide]);

  // Signing out takes the banner with it.
  useEffect(() => {
    if (session.status !== 'signedIn') dismissArrivalBanner();
  }, [session.status]);

  if (!row) return null;
  return (
    <Banner
      row={row}
      top={insets.top + spacing.sm}
      slide={slide}
      label={t('arrival.open')}
    />
  );
}

function Banner({
  row,
  top,
  slide,
  label,
}: {
  row: SellerNotification;
  top: number;
  slide: Animated.Value;
  label: string;
}) {
  const look = lookOf(row.type);
  const tone = tones[look.tone as Tone] ?? tones.blue;
  const open = () => {
    dismissArrivalBanner();
    void markRead(row).catch(() => undefined);
    const target = notificationRoute(row);
    if (target) openPortalHref(target.href);
    else openPortalHref('/seller/dashboard/notifications');
  };
  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          top,
          opacity: slide,
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [-24, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={open}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={[row.title, row.body].filter(Boolean).join('. ')}
        accessibilityHint={label}
        style={styles.card}
        testID="arrival-banner"
      >
        <View style={[styles.tile, { backgroundColor: tone.background }]}>
          <Icon name={look.icon} size={20} color={tone.foreground} />
        </View>
        <View style={styles.text}>
          <Text variant="cardTitle" numberOfLines={1}>
            {row.title}
          </Text>
          {row.body ? (
            <Text variant="meta" color={colors.textMuted} numberOfLines={1}>
              {row.body}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={dismissArrivalBanner}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={10}
        >
          <Icon name="close" size={18} color={colors.outline} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.blue100,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});
