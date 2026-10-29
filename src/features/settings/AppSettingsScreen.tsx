/**
 * App settings: the places to change notification and communication preferences, this phone's
 * notification sound and permission, the language, help, the app version, Diagnostics (dev and
 * staging builds only) and sign out. Account deletion is not offered because the backend never
 * executes it (gap 4). The web /settings page duplicates the profile screens and is not ported.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { env } from '@/config/env';
import { track } from '@/core/analytics/analytics';
import { useSessionEngine } from '@/core/auth/SessionProvider';
import { appVersion, buildNumber } from '@/core/device/deviceInfo';
import {
  openNotificationSettings,
  type PushPermission,
} from '@/core/push/permission';
import {
  setNotificationSoundEnabled,
  useNotificationSoundEnabled,
} from '@/core/sound/soundPreference';
import { logger } from '@/core/logger';
import {
  Banner,
  Button,
  Card,
  colors,
  ConfirmDialog,
  Divider,
  ListRow,
  SectionTitle,
  spacing,
  SwitchRow,
  Text,
} from '@/design';
import { LANGUAGES, useT, type TranslationKey } from '@/i18n';
import { openLegalDocument } from '../info/legal';
import { usePushPermission } from '../notifications/usePushPermission';
import { askForPushPermission } from '../notifications/pushPermissionFlow';
import type { MoreStackParamList } from '@/app/navigation/types';

const PERMISSION_LABEL: Record<PushPermission, TranslationKey> = {
  granted: 'settings.push.granted',
  denied: 'settings.push.denied',
  blocked: 'settings.push.blocked',
  undetermined: 'settings.push.undetermined',
};

export function AppSettingsScreen() {
  const t = useT();
  const navigation =
    useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const engine = useSessionEngine();
  const soundOn = useNotificationSoundEnabled();
  const { permission, refresh } = usePushPermission();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const language = LANGUAGES[0];

  const signOut = async () => {
    setSigningOut(true);
    track('signout', { reason: 'user' });
    await engine.signOut();
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-app-settings"
    >
      <View style={styles.group}>
        <SectionTitle>{t('settings.section.notifications')}</SectionTitle>
        <Card style={styles.card}>
          <ListRow
            testID="settings-notification-prefs"
            icon="notifications"
            label={t('settings.notificationPrefs')}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <Divider />
          <ListRow
            testID="settings-communication-prefs"
            icon="forum"
            label={t('settings.communicationPrefs')}
            onPress={() => navigation.navigate('CommunicationSettings')}
          />
        </Card>
      </View>

      <View style={styles.group}>
        <SectionTitle>{t('settings.section.device')}</SectionTitle>
        <Card style={styles.card}>
          <SwitchRow
            testID="settings-sound"
            label={t('settings.sound')}
            description={t('settings.sound.body')}
            value={soundOn}
            onValueChange={setNotificationSoundEnabled}
          />
          <Divider />
          {Platform.OS === 'android' ? (
            <>
              <ListRow
                testID="settings-push-status"
                icon="notifications_active"
                label={t('settings.push')}
                value={permission ? t(PERMISSION_LABEL[permission]) : undefined}
                description={t('settings.push.body')}
                trailingIcon={null}
              />
              <View style={styles.actions}>
                {permission === 'undetermined' || permission === 'denied' ? (
                  <Button
                    label={t('settings.push.turnOn')}
                    size="sm"
                    onPress={() => {
                      void askForPushPermission().then(refresh);
                    }}
                    testID="settings-push-turn-on"
                  />
                ) : null}
                <Button
                  label={t('settings.push.openSettings')}
                  size="sm"
                  variant="outline"
                  icon="settings"
                  onPress={() => {
                    openNotificationSettings().catch(error =>
                      logger.warn('[settings] could not open settings', error),
                    );
                  }}
                  testID="settings-push-open-settings"
                />
              </View>
              <Divider />
            </>
          ) : null}
          <ListRow
            testID="settings-language"
            icon="language"
            label={t('settings.language')}
            value={language.label}
            description={t('settings.language.body')}
            trailingIcon={null}
          />
        </Card>
        <Banner
          tone="slate"
          icon="info"
          message={t('settings.sound.limit')}
          testID="settings-sound-note"
        />
      </View>

      <View style={styles.group}>
        <SectionTitle>{t('settings.section.about')}</SectionTitle>
        <Card style={styles.card}>
          <ListRow
            testID="settings-help-about"
            icon="help"
            label={t('more.item.helpAbout')}
            onPress={() => navigation.navigate('HelpAbout')}
          />
          <Divider />
          <ListRow
            testID="settings-terms"
            icon="gavel"
            label={t('settings.terms')}
            onPress={() => {
              void openLegalDocument('terms');
            }}
          />
          <Divider />
          <ListRow
            testID="settings-privacy"
            icon="privacy_tip"
            label={t('settings.privacy')}
            onPress={() => {
              void openLegalDocument('privacy');
            }}
          />
          <Divider />
          <ListRow
            testID="settings-version"
            icon="info"
            label={t('settings.version')}
            value={t('settings.version.value', {
              version: appVersion,
              build: buildNumber,
            })}
            trailingIcon={null}
          />
          {env.diagnosticsEnabled ? (
            <>
              <Divider />
              <ListRow
                testID="settings-diagnostics"
                icon="bug_report"
                label={t('more.item.diagnostics')}
                onPress={() => navigation.navigate('Diagnostics')}
              />
            </>
          ) : null}
        </Card>
      </View>

      <Card style={styles.card}>
        <ListRow
          testID="settings-sign-out"
          label={t('more.signOut')}
          icon="logout"
          destructive
          trailingIcon={null}
          onPress={() => setConfirming(true)}
        />
      </Card>

      <Text variant="small" color={colors.textMuted} align="center">
        {t('settings.deleteNote')}
      </Text>

      <ConfirmDialog
        visible={confirming}
        title={t('more.signOut.title')}
        message={t('more.signOut.body')}
        confirmLabel={t('more.signOut')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={signingOut}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void signOut();
        }}
        testID="settings-sign-out-dialog"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  group: { gap: spacing.sm },
  card: { gap: 0, paddingVertical: spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexWrap: 'wrap',
  },
});
