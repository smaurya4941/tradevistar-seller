/**
 * The platform notice banner: a slim, tappable card for the notice currently in rotation.
 *
 * It sits at the top of every screen, above the view-only banner.
 * Tapping opens the full details; the cross puts an announcement or an upcoming maintenance away
 * for this session. A live maintenance has no cross — the seller must be able to tell why actions
 * fail. Nothing renders while there is no notice, so it costs no space the rest of the time.
 */
import {
  noticeTiming,
  noticeTone,
  type NoticeTone,
} from '@tradevistar/seller-api';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, Icon, radii, spacing, Text, tones } from '@/design';
import { useT } from '@/i18n';
import { labelText, timingLabel } from '../noticeText';
import type { NoticeBoard } from '../useNoticeBoard';
import { SiteNoticeSheet } from './SiteNoticeSheet';

const LOOK: Record<NoticeTone, { tone: keyof typeof tones; icon: string }> = {
  info: { tone: 'blue', icon: 'campaign' },
  warning: { tone: 'orange', icon: 'construction' },
  upcoming: { tone: 'amber', icon: 'construction' },
};

export function SiteNoticeBanner({
  board,
  style,
}: {
  /** The board is owned by the caller (GlobalBanners), which also needs to know if one shows. */
  board: NoticeBoard;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const { notice } = board;
  if (!notice) return null;

  const look = LOOK[noticeTone(notice)];
  const palette = tones[look.tone];
  const timing = timingLabel(t, noticeTiming(notice, board.serverNow));
  const label = labelText(t, notice);

  return (
    <>
      <View
        testID="site-notice-banner"
        style={[styles.card, { backgroundColor: palette.background }, style]}
      >
        <Pressable
          onPress={board.openSheet}
          accessibilityRole="button"
          accessibilityLabel={t('notice.openA11y', {
            label,
            title: notice.title,
          })}
          style={styles.body}
          testID="site-notice-open"
        >
          <View
            style={[styles.iconWrap, { backgroundColor: palette.foreground }]}
          >
            <Icon name={look.icon} size={18} color={palette.background} />
          </View>
          <View style={styles.text}>
            <Text
              variant="cardTitle"
              color={palette.foreground}
              numberOfLines={2}
            >
              {notice.title}
            </Text>
            {timing ? (
              <Text variant="meta" color={palette.foreground} numberOfLines={1}>
                {timing}
              </Text>
            ) : null}
          </View>
          {board.count > 1 ? (
            <Text
              variant="badge"
              color={palette.foreground}
              accessibilityLabel={t('notice.position', {
                index: board.position,
                count: board.count,
              })}
            >
              {board.position}/{board.count}
            </Text>
          ) : null}
          <Icon name="expand_more" size={20} color={palette.foreground} />
        </Pressable>
        {board.canDismiss ? (
          <Pressable
            onPress={board.dismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('notice.dismiss')}
            style={styles.dismiss}
            testID="site-notice-dismiss"
          >
            <Icon name="close" size={18} color={palette.foreground} />
          </Pressable>
        ) : null}
      </View>
      <SiteNoticeSheet
        notice={notice}
        visible={board.sheetOpen}
        onClose={board.closeSheet}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 48,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
  dismiss: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
