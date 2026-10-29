/**
 * A dismissible card at the top of the Inbox that offers to turn on system notifications. It
 * opens the explainer first (never the bare system prompt), and disappears once the permission is
 * granted or the seller dismisses it.
 */
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { deviceStorage } from '@/core/storage/kv';
import { Button, Card, colors, Icon, palette, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { askForPushPermission } from '../pushPermissionFlow';
import { usePushPermission } from '../usePushPermission';

const DISMISSED_KEY = 'push.cardDismissed';

export function PushPermissionCard() {
  const t = useT();
  const { permission, refresh } = usePushPermission();
  const [dismissed, setDismissed] = useState(
    () => deviceStorage.getBoolean(DISMISSED_KEY) === true,
  );
  if (Platform.OS !== 'android') return null;
  if (permission === null || permission === 'granted' || dismissed) return null;

  return (
    <Card style={styles.card} testID="push-card">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="notifications_active" size={22} color={palette.blue700} />
        </View>
        <View style={styles.text}>
          <Text variant="cardTitle">{t('push.card.title')}</Text>
          <Text variant="meta" color={colors.textMuted}>
            {t('push.card.body')}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button
          label={t('push.card.turnOn')}
          size="sm"
          onPress={() => {
            void askForPushPermission().then(refresh);
          }}
          testID="push-card-turn-on"
        />
        <Button
          label={t('common.dismiss')}
          size="sm"
          variant="ghost"
          onPress={() => {
            deviceStorage.set(DISMISSED_KEY, true);
            setDismissed(true);
          }}
          testID="push-card-dismiss"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.blue50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  buttons: { flexDirection: 'row', gap: spacing.sm },
});
