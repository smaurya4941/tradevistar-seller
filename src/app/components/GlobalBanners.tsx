/**
 * The banners above every screen: the platform notice, then (signed in, unverified) the view-only
 * notice. They sit above the navigator, so the status-bar inset is taken here and the screens
 * below start under the banners with no inset of their own.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useSession } from '@/core/auth/SessionProvider';
import { createStore, useStore } from '@/core/store';
import { colors, spacing } from '@/design';
import { useAccess } from '@/features/access/useAccess';
import { ViewOnlyBanner } from '@/features/access/ViewOnlyBanner';
import { SiteNoticeBanner } from '@/features/notices/components/SiteNoticeBanner';
import { useNoticeBoard } from '@/features/notices/useNoticeBoard';

/** Whether the stack is showing, so headers below know the status bar is already covered. */
const bannersShowing = createStore(false);

export function useBannersShowing(): boolean {
  return useStore(bannersShowing);
}

/**
 * Wraps the screens under the banners: the banners already cover the status bar, so everything
 * below sees a top inset of zero and does not pad for it a second time.
 */
export function BelowBanners({ children }: { children: React.ReactNode }) {
  const showing = useBannersShowing();
  const insets = useSafeAreaInsets();
  if (!showing) return <>{children}</>;
  return (
    <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}

export function GlobalBanners() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const board = useNoticeBoard();
  const { state } = useAccess();
  const showViewOnly = session.status === 'signedIn' && state !== null;
  const showing = board.notice !== null || showViewOnly;

  useEffect(() => {
    bannersShowing.set(showing);
  }, [showing]);

  if (!showing) return null;

  return (
    <View
      style={[styles.stack, { paddingTop: insets.top + spacing.sm }]}
      testID="global-banners"
    >
      {board.notice ? <SiteNoticeBanner board={board} /> : null}
      {showViewOnly ? <ViewOnlyBanner /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
});
