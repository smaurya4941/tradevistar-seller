/**
 * The full text of a platform notice: what it says, when it runs, and — for a maintenance — what
 * is paused while it does.
 */
import type { SiteNotice } from '@tradevistar/seller-api';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  colors,
  radii,
  spacing,
  Text,
  tones,
} from '@/design';
import { useT } from '@/i18n';
import { labelText, pausedText, whenLabel } from '../noticeText';

export function SiteNoticeSheet({
  notice,
  visible,
  onClose,
}: {
  notice: SiteNotice;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const paused = pausedText(t, notice);
  const maintenance = notice.kind === 'MAINTENANCE';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={labelText(t, notice)}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        testID="site-notice-sheet"
      >
        <Text variant="h3">{notice.title}</Text>
        <Text variant="body" color={colors.textMuted}>
          {notice.message}
        </Text>
        <View style={styles.facts}>
          {maintenance ? (
            <>
              <Fact
                label={t('notice.starts')}
                value={whenLabel(notice.startsAt)}
              />
              <Fact
                label={t('notice.ends')}
                value={
                  notice.endsAt
                    ? whenLabel(notice.endsAt)
                    : t('notice.endsOpen')
                }
              />
            </>
          ) : notice.eventAt ? (
            <Fact label={t('notice.date')} value={whenLabel(notice.eventAt)} />
          ) : null}
        </View>
        {paused ? (
          <View style={styles.paused} testID="site-notice-paused">
            <Text variant="meta" color={tones.orange.foreground}>
              {paused}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <Button
        label={t('notice.sheetClose')}
        variant="outline"
        onPress={onClose}
        fullWidth
      />
    </BottomSheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="badge" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.sm },
  facts: { gap: spacing.sm },
  fact: { gap: 2 },
  paused: {
    backgroundColor: tones.orange.background,
    borderRadius: radii.md,
    padding: spacing.md,
  },
});
