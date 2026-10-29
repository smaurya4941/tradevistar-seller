/**
 * Account closure. The preflight says whether a closure can be requested, what blocks it (with
 * counts, linked to the screen that resolves each one where there is one) and how long the grace
 * period is. The backend records closure requests but never executes them (the web button is
 * disabled), so the app does not offer a button that does nothing: with no blockers it opens a
 * pre-filled support ticket, which is also the in-app way to ask for deletion that Google Play
 * expects.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { blockerHref, type DeletionPreflight } from '@tradevistar/seller-api';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { openPortalHref } from '@/app/navigation/openHref';
import type { SharedScreens } from '@/app/navigation/types';
import { Banner, Button, Card, colors, Icon, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { useSupportCategories } from '@/features/support/data';
import { LoadGate } from './components/LoadGate';
import { useDeletionPreflight } from './data';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function AccountClosureScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const query = useDeletionPreflight();
  const categories = useSupportCategories();

  const requestByTicket = (preflight: DeletionPreflight) => {
    const list = categories.data ?? [];
    const category =
      list.find(
        item => /account/i.test(item.code) || /account/i.test(item.label),
      )?.code ?? list.find(item => /other|general/i.test(item.code))?.code;
    navigation.navigate('NewTicket', {
      category,
      subject: t('closure.ticketSubject'),
      message: t('closure.ticketMessage', { days: preflight.gracePeriodDays }),
    });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-account-closure"
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    >
      <LoadGate query={query}>
        {preflight => (
          <>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Icon name="person_remove" size={24} color={colors.error} />
                <Text variant="h3" style={styles.flex}>
                  {t('closure.title')}
                </Text>
              </View>
              <Text variant="body" color={colors.onSurfaceVariant}>
                {t('closure.body', { days: preflight.gracePeriodDays })}
              </Text>
            </Card>

            {preflight.blockers.length > 0 ? (
              <Card style={styles.card} testID="closure-blockers">
                <Text variant="section">{t('closure.blockers')}</Text>
                {preflight.blockers.map(blocker => {
                  const href = blockerHref(blocker.key);
                  return (
                    <View
                      key={blocker.key}
                      style={styles.row}
                      testID={`blocker-${blocker.key}`}
                    >
                      <Icon name="block" size={20} color={colors.error} />
                      <Text variant="body" style={styles.flex}>
                        {blocker.label} ({blocker.count})
                      </Text>
                      {href ? (
                        <Button
                          label={t('closure.resolve')}
                          size="sm"
                          variant="outline"
                          onPress={() => {
                            openPortalHref(href);
                          }}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            ) : null}

            {preflight.canRequest && preflight.blockers.length === 0 ? (
              <>
                <Banner tone="blue" message={t('closure.viaSupport')} />
                <Button
                  label={t('closure.request')}
                  icon="support_agent"
                  variant="danger"
                  onPress={() => requestByTicket(preflight)}
                  testID="closure-request"
                />
              </>
            ) : (
              <Banner
                tone="amber"
                message={t('closure.cannot')}
                testID="closure-cannot"
              />
            )}
          </>
        )}
      </LoadGate>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  flex: { flex: 1 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
