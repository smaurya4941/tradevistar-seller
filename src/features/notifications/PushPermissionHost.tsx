/**
 * The sheets for the notification permission flow (pushPermissionFlow.ts), mounted once. The
 * explainer says what the alerts are and what they are not; the blocked sheet says how to switch
 * them on in system settings once Android has stopped asking.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { openNotificationSettings } from '@/core/push/permission';
import { logger } from '@/core/logger';
import { useStore } from '@/core/store';
import {
  BottomSheet,
  Button,
  colors,
  Icon,
  palette,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import {
  confirmExplainer,
  dismissPushFlow,
  pushFlowStore,
} from './pushPermissionFlow';

function Bullet({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.bullet}>
      <Icon name={icon} size={20} color={palette.blue700} />
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

export function PushPermissionHost() {
  const t = useT();
  const state = useStore(pushFlowStore);
  const [asking, setAsking] = useState(false);

  const allow = async () => {
    setAsking(true);
    try {
      await confirmExplainer();
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <BottomSheet
        visible={state.kind === 'explain'}
        onClose={() => dismissPushFlow()}
        title={t('push.explainer.title')}
      >
        <View style={styles.body} testID="push-explainer">
          <Text variant="body" color={colors.textMuted}>
            {t('push.explainer.body')}
          </Text>
          <Bullet icon="shopping_cart" text={t('push.explainer.orders')} />
          <Bullet icon="chat" text={t('push.explainer.messages')} />
          <Bullet icon="info" text={t('push.explainer.limit')} />
          <Button
            label={t('push.explainer.allow')}
            loading={asking}
            onPress={() => {
              void allow();
            }}
            fullWidth
            testID="push-explainer-allow"
          />
          <Button
            label={t('push.explainer.later')}
            variant="ghost"
            onPress={() => dismissPushFlow()}
            fullWidth
            testID="push-explainer-later"
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={state.kind === 'blocked'}
        onClose={() => dismissPushFlow('blocked')}
        title={t('push.blocked.title')}
      >
        <View style={styles.body} testID="push-blocked">
          <Text variant="body" color={colors.textMuted}>
            {t('push.blocked.body')}
          </Text>
          <Button
            label={t('push.blocked.open')}
            icon="settings"
            onPress={() => {
              openNotificationSettings().catch(error =>
                logger.warn('[push] could not open settings', error),
              );
              dismissPushFlow('blocked');
            }}
            fullWidth
            testID="push-blocked-open"
          />
          <Button
            label={t('common.close')}
            variant="ghost"
            onPress={() => dismissPushFlow('blocked')}
            fullWidth
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  bullet: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
