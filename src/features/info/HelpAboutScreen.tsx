/**
 * Help and about: the footer's four columns — Platform, Company, Support and Legal, with the
 * headings an admin set in Admin → Footer — plus the ways to reach TradeVistar, the social
 * profiles and the app's version. Works signed in or out, and offline from the saved footer.
 */
import { footerColumn } from '@tradevistar/seller-api';
import React, { useState } from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { env } from '@/config/env';
import { appVersion, buildNumber } from '@/core/device/deviceInfo';
import {
  Button,
  Card,
  colors,
  EmptyState,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { FooterLinksCard } from './components/FooterLinksCard';
import { SocialLinks } from './components/SocialLinks';
import { useFooter } from './data';

export function HelpAboutScreen() {
  const t = useT();
  const footer = useFooter();
  const [refreshing, setRefreshing] = useState(false);
  const data = footer.data;
  const settings = data?.settings;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void footer.refetch().finally(() => setRefreshing(false));
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      testID="screen-help-about"
    >
      <Card style={styles.card}>
        <Text variant="h3" accessibilityRole="header">
          {t('info.helpAbout.contactTitle')}
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          {t('info.helpAbout.hours', { hours: env.supportHours })}
        </Text>
        <View style={styles.buttons}>
          <Button
            label={t('support.contact.email')}
            icon="mail"
            variant="outline"
            onPress={() => {
              void Linking.openURL(`mailto:${env.supportEmail}`);
            }}
            testID="help-email"
          />
          {env.supportPhone ? (
            <Button
              label={t('support.contact.call')}
              icon="call"
              variant="outline"
              onPress={() => {
                void Linking.openURL(`tel:${env.supportPhone}`);
              }}
              testID="help-call"
            />
          ) : null}
        </View>
      </Card>

      {data === undefined ? (
        footer.isError ? (
          <EmptyState
            icon="cloud_off"
            title={t('info.helpAbout.loadFailed')}
            message={t('info.helpAbout.loadFailedBody')}
            actionLabel={t('common.tryAgain')}
            onAction={() => {
              void footer.refetch();
            }}
          />
        ) : (
          <View style={styles.card} testID="help-loading">
            <Skeleton height={140} />
            <Skeleton height={140} />
          </View>
        )
      ) : (
        <>
          {settings?.tagline ? (
            <Text variant="body" color={colors.textMuted}>
              {settings.tagline}
            </Text>
          ) : null}
          <FooterLinksCard
            testID="footer-platform"
            title={settings?.platformHeading || t('info.column.platform')}
            links={footerColumn(data, 'PLATFORM')}
            icon="rocket_launch"
          />
          <FooterLinksCard
            testID="footer-company"
            title={settings?.companyHeading || t('info.column.company')}
            links={footerColumn(data, 'COMPANY')}
            icon="business"
          />
          <FooterLinksCard
            testID="footer-support"
            title={settings?.supportHeading || t('info.column.support')}
            links={footerColumn(data, 'SUPPORT')}
            icon="support_agent"
          />
          <FooterLinksCard
            testID="footer-legal"
            title={t('info.column.legal')}
            links={footerColumn(data, 'LEGAL')}
            icon="gavel"
          />
          <SocialLinks settings={settings} />
          {settings?.copyright ? (
            <Text variant="small" color={colors.textMuted} align="center">
              {settings.copyright}
            </Text>
          ) : null}
        </>
      )}

      <Text
        variant="small"
        color={colors.textMuted}
        align="center"
        testID="help-version"
      >
        {t('info.helpAbout.version', {
          version: appVersion,
          build: buildNumber,
        })}
      </Text>
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
  card: { gap: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
