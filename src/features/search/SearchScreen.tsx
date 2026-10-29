/**
 * Search across the seller's own records (orders, products, buyers, payments, RFQs, quotations,
 * sample requests, wallet transactions and payouts). Opened from the Home header.
 *
 * Before typing: the last ten searches. While typing: a 300 ms pause, 2–80 characters, the
 * previous request aborted on each keystroke. Results are grouped by type; a tap opens the
 * matching screen with the record kept in its parameters (Phases 5–8 read them). A result whose
 * link the app cannot place offers "Open on web" instead of failing.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  clampSearchInput,
  groupSearchResults,
  safePortalPath,
  SEARCH_LIMITS,
  SEARCH_TYPE_ICON,
  searchRoute,
  type SellerSearchResult,
  type SellerSearchType,
} from '@tradevistar/seller-api';
import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { env } from '@/config/env';
import { openRoute } from '@/app/navigation/openHref';
import { routeForSearch } from '@/app/navigation/routeMapping';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import {
  Banner,
  Card,
  colors,
  Divider,
  EmptyState,
  HIT_TARGET,
  Icon,
  palette,
  radii,
  Skeleton,
  spacing,
  Text,
  typography,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
} from './recentSearches';
import { useRecordSearch } from './useRecordSearch';

const TYPE_LABEL: Record<SellerSearchType, TranslationKey> = {
  ORDER: 'search.type.ORDER',
  PRODUCT: 'search.type.PRODUCT',
  BUYER: 'search.type.BUYER',
  PAYMENT: 'search.type.PAYMENT',
  RFQ: 'search.type.RFQ',
  QUOTATION: 'search.type.QUOTATION',
  SAMPLE: 'search.type.SAMPLE',
  WALLET: 'search.type.WALLET',
  PAYOUT: 'search.type.PAYOUT',
};

export function SearchScreen() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<SharedScreens>>();
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const [onWeb, setOnWeb] = useState<SellerSearchResult | null>(null);
  const { state, retry } = useRecordSearch(text, {
    onResults: count => track('search_used', { result_count: count }),
  });

  const groups = useMemo(
    () => (state.status === 'done' ? groupSearchResults(state.results) : []),
    [state],
  );

  const open = (result: SellerSearchResult) => {
    const term = text.trim();
    if (term) setRecent(addRecentSearch(term));
    const destination = searchRoute(result.href);
    const route = destination ? routeForSearch(destination) : null;
    if (!route) {
      setOnWeb(result);
      return;
    }
    setOnWeb(null);
    openRoute(route);
  };

  const openOnWeb = (result: SellerSearchResult) => {
    const path = safePortalPath(result.href);
    if (path) void Linking.openURL(`${env.webUrl}${path}`);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root} testID="screen-search">
      <StatusBar barStyle="dark-content" />
      <View style={styles.bar}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.back}
          testID="search-back"
        >
          <Icon name="arrow_back" size={24} color={colors.secondary} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Icon name="search" size={20} color={colors.outline} />
          <TextInput
            value={text}
            onChangeText={value => {
              setOnWeb(null);
              setText(clampSearchInput(value));
            }}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.outline}
            maxLength={SEARCH_LIMITS.maxLength}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t('search.label')}
            style={styles.input}
            maxFontSizeMultiplier={2}
            testID="search-input"
          />
          {text ? (
            <Pressable
              onPress={() => setText('')}
              accessibilityRole="button"
              accessibilityLabel={t('search.clear')}
              hitSlop={8}
              testID="search-clear"
            >
              <Icon name="close" size={20} color={colors.outline} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Divider />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        testID="search-results"
      >
        {state.status === 'idle' ? (
          text.trim().length > 0 ? (
            <Text variant="meta" color={colors.textMuted}>
              {t('search.minLength', { count: SEARCH_LIMITS.minLength })}
            </Text>
          ) : recent.length ? (
            <View style={styles.group} testID="search-recent">
              <View style={styles.recentHead}>
                <Text variant="section" style={styles.flex}>
                  {t('search.recent')}
                </Text>
                <Pressable
                  onPress={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                  accessibilityRole="button"
                  style={styles.clearAll}
                  testID="search-clear-recent"
                >
                  <Text variant="label" color={colors.link}>
                    {t('search.clearRecent')}
                  </Text>
                </Pressable>
              </View>
              {recent.map(term => (
                <Pressable
                  key={term}
                  onPress={() => setText(term)}
                  accessibilityRole="button"
                  accessibilityLabel={term}
                  style={styles.recentRow}
                >
                  <Icon name="history" size={20} color={colors.outline} />
                  <Text variant="body" style={styles.flex} numberOfLines={1}>
                    {term}
                  </Text>
                  <Icon name="north_west" size={18} color={colors.outline} />
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="search"
              title={t('search.emptyTitle')}
              message={t('search.emptyBody')}
            />
          )
        ) : null}

        {state.status === 'loading' ? (
          <View style={styles.group} testID="search-loading">
            <Skeleton height={64} radius={radii.lg} />
            <Skeleton height={64} radius={radii.lg} />
            <Skeleton height={64} radius={radii.lg} />
          </View>
        ) : null}

        {state.status === 'error' ? (
          <EmptyState
            icon="cloud_off"
            title={t('search.error')}
            actionLabel={t('common.tryAgain')}
            onAction={retry}
          />
        ) : null}

        {state.status === 'done' && groups.length === 0 ? (
          <EmptyState
            icon="search_off"
            title={t('search.noResults', { term: state.term })}
            message={t('search.noResultsBody')}
          />
        ) : null}

        {groups.map(group => (
          <View
            key={group.type}
            style={styles.group}
            testID={`search-group-${group.type}`}
          >
            <Text
              variant="badge"
              color={colors.textMuted}
              accessibilityRole="header"
            >
              {t(TYPE_LABEL[group.type]).toUpperCase()}
            </Text>
            <Card style={styles.card}>
              {group.results.map((result, index) => (
                <React.Fragment key={`${result.type}-${result.id}`}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => open(result)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(TYPE_LABEL[result.type])}: ${
                      result.title
                    }${result.subtitle ? `, ${result.subtitle}` : ''}`}
                    style={({ pressed }) => [
                      styles.result,
                      pressed && {
                        backgroundColor: colors.surfaceContainerLow,
                      },
                    ]}
                    testID={`search-result-${result.type}-${result.id}`}
                  >
                    <View style={styles.resultIcon}>
                      <Icon
                        name={SEARCH_TYPE_ICON[result.type]}
                        size={20}
                        color={palette.blue700}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {result.title}
                      </Text>
                      {result.subtitle ? (
                        <Text
                          variant="meta"
                          color={colors.textMuted}
                          numberOfLines={1}
                        >
                          {result.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.tag}>
                      <Text variant="badge" color={palette.blue700}>
                        {t(TYPE_LABEL[result.type])}
                      </Text>
                    </View>
                  </Pressable>
                </React.Fragment>
              ))}
            </Card>
          </View>
        ))}

        {onWeb ? (
          <Banner
            tone="amber"
            icon="open_in_new"
            message={t('search.openOnWeb.body')}
            actionLabel={t('common.openInBrowser')}
            onAction={() => openOnWeb(onWeb)}
            testID="search-open-web"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  back: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    color: colors.onSurface,
    ...typography.body,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  group: { gap: spacing.sm },
  recentHead: { flexDirection: 'row', alignItems: 'center' },
  clearAll: { minHeight: 40, justifyContent: 'center' },
  recentRow: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  card: { padding: 0, gap: 0, overflow: 'hidden' },
  result: {
    minHeight: HIT_TARGET + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.blue50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: palette.blue50,
  },
});
