/**
 * A footer page (Help & Support, FAQs, Terms of Use, Privacy Policy…): a navy header with the
 * title, summary and last update; the content; the page's contact details; and its contact form
 * when the admin turned one on. Everything comes from Admin → Footer.
 *
 * - Opens signed out too: reached from the sign-in screen's "Need help?", the registration terms,
 *   links inside other pages and `/info/<slug>` links.
 * - A page read once opens offline from its saved copy, with a note saying so.
 * - A page that no longer exists says so and offers the way back.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNetInfo } from '@react-native-community/netinfo';
import { ApiError, formatFullDate } from '@tradevistar/seller-api';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { isOffline } from '@/core/network/connectivity';
import {
  Banner,
  Card,
  colors,
  EmptyState,
  palette,
  radii,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { ContactDetailsCard } from './components/ContactDetailsCard';
import { EnquiryForm } from './components/EnquiryForm';
import { FooterPageBody } from './components/FooterPageBody';
import { useFooterPage } from './data';

export function isPageGone(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}

export function InfoPageScreen() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<SharedScreens>>();
  const { slug } = useRoute<RouteProp<SharedScreens, 'InfoPage'>>().params;
  const net = useNetInfo();
  const offline = isOffline(net);
  const page = useFooterPage(slug);
  const [pulling, setPulling] = useState(false);
  const data = page.data;
  const gone = isPageGone(page.error);

  useLayoutEffect(() => {
    navigation.setOptions({ title: data?.label ?? t('info.page.title') });
  }, [data, navigation, t]);

  const viewed = useRef(false);
  useEffect(() => {
    if (!data || viewed.current) return;
    viewed.current = true;
    track('info_page_viewed', { slug });
  }, [data, slug]);

  const refresh = async () => {
    setPulling(true);
    try {
      await page.refetch();
    } finally {
      setPulling(false);
    }
  };

  if (gone) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={styles.root}
        testID="info-not-found"
      >
        <EmptyState
          icon="error"
          title={t('info.notFound')}
          message={t('info.notFoundBody')}
          actionLabel={t('info.backToHelp')}
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  if (!data) {
    if (page.isError) {
      return (
        <SafeAreaView
          edges={['bottom']}
          style={styles.root}
          testID="info-failed"
        >
          <EmptyState
            icon="cloud_off"
            title={t('info.loadFailed')}
            actionLabel={t('common.tryAgain')}
            onAction={() => {
              void page.refetch();
            }}
          />
        </SafeAreaView>
      );
    }
    return (
      <View
        style={styles.loading}
        testID="info-loading"
        accessibilityLabel={t('info.loading')}
      >
        <Skeleton height={120} radius={radii.xl} />
        <Skeleton height={18} width="90%" />
        <Skeleton height={18} width="80%" />
        <Skeleton height={18} width="85%" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.root} testID="info-page">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={() => {
                void refresh();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {offline ? (
            <Banner
              tone="slate"
              icon="cloud_off"
              message={t('info.offlineCopy')}
              testID="info-offline"
            />
          ) : null}

          <View style={styles.hero}>
            <Text variant="h1" color={palette.white} accessibilityRole="header">
              {data.title}
            </Text>
            {data.summary ? (
              <Text variant="body" color="rgba(255,255,255,0.85)">
                {data.summary}
              </Text>
            ) : null}
            <Text variant="small" color="rgba(255,255,255,0.7)">
              {t('info.lastUpdated', { date: formatFullDate(data.updatedAt) })}
            </Text>
          </View>

          <Card style={styles.card}>
            <FooterPageBody body={data.body} />
          </Card>

          <ContactDetailsCard page={data} />

          {data.showContactForm ? <EnquiryForm pageSlug={data.slug} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loading: { padding: spacing.lg, gap: spacing.md },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  hero: {
    backgroundColor: palette.navy,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  card: { gap: spacing.md },
});
