/**
 * The invitation link. The token comes back once (on invite and on resend), so this sheet is the
 * seller's chance to share it: the system share sheet or copy. The link is the seller web address
 * plus the invitation path the app's own deep link handles. The token is never logged.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import { buildInviteLink } from '@tradevistar/seller-api';
import React from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { env } from '@/config/env';
import { BottomSheet, Button, colors, spacing, Text, useToast } from '@/design';
import { useT } from '@/i18n';

export function InviteLinkSheet({
  token,
  email,
  emailSent,
  onClose,
}: {
  token: string | null;
  email: string;
  emailSent: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const link = token ? buildInviteLink(env.webUrl, token) : '';

  const share = async () => {
    try {
      await Share.share({
        message: t('team.link.message', { link }),
        title: t('team.link.title'),
      });
    } catch {
      // The seller closed the sheet.
    }
  };

  return (
    <BottomSheet
      visible={token !== null}
      onClose={onClose}
      title={t('team.link.title')}
      scrollable
    >
      <View style={styles.body}>
        <Text
          variant="body"
          color={emailSent ? colors.success : colors.onSurfaceVariant}
          accessibilityLiveRegion="polite"
        >
          {emailSent
            ? t('team.link.emailed', { email })
            : t('team.link.notEmailed', { email })}
        </Text>
        <Text variant="small" color={colors.textMuted}>
          {t('team.link.once')}
        </Text>
        <View style={styles.link}>
          <Text
            variant="small"
            selectable
            numberOfLines={3}
            testID="invite-link"
          >
            {link}
          </Text>
        </View>
        <Button
          label={t('team.link.share')}
          icon="share"
          onPress={() => {
            void share();
          }}
          testID="invite-share"
        />
        <Button
          label={t('common.copy')}
          icon="content_copy"
          variant="outline"
          onPress={() => {
            Clipboard.setString(link);
            toast.show(t('team.link.copied'), 'success');
          }}
          testID="invite-copy"
        />
        <Button label={t('form.done')} variant="ghost" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, padding: spacing.lg },
  link: {
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
  },
});
