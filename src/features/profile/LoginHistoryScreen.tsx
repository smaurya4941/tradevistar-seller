/** Sign-in attempts (last 20, success or failed, with the IP) and the security activity log (last 20). */
import { formatDateTime, humanizeState } from '@tradevistar/seller-api';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  Card,
  colors,
  EmptyState,
  Icon,
  SectionTitle,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { useLoginHistory, useSecurityActivity } from './data';

export function LoginHistoryScreen() {
  const t = useT();
  const logins = useLoginHistory();
  const activity = useSecurityActivity();
  const refreshing =
    (logins.isFetching && !logins.isPending) ||
    (activity.isFetching && !activity.isPending);
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-login-history"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void logins.refetch();
            void activity.refetch();
          }}
        />
      }
    >
      <SecureScreen />
      <SectionTitle>{t('history.logins')}</SectionTitle>
      <LoadGate query={logins}>
        {page =>
          page.items.length === 0 ? (
            <EmptyState icon="login" title={t('history.noLogins')} />
          ) : (
            <Card style={styles.list}>
              {page.items.map(attempt => (
                <View
                  key={attempt.id}
                  style={styles.row}
                  testID={`login-${attempt.id}`}
                >
                  <Icon
                    name={attempt.successful ? 'check_circle' : 'cancel'}
                    size={20}
                    color={attempt.successful ? colors.success : colors.error}
                  />
                  <View style={styles.flex}>
                    <Text variant="label">
                      {attempt.successful
                        ? t('history.success')
                        : t('history.failed')}
                    </Text>
                    <Text variant="small" color={colors.textMuted}>
                      {formatDateTime(attempt.createdAt)}
                      {attempt.ipAddress ? ` · ${attempt.ipAddress}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )
        }
      </LoadGate>
      <SectionTitle>{t('history.activity')}</SectionTitle>
      <LoadGate query={activity}>
        {page =>
          page.items.length === 0 ? (
            <EmptyState icon="event_note" title={t('history.noActivity')} />
          ) : (
            <Card style={styles.list}>
              {page.items.map(event => (
                <View
                  key={event.id}
                  style={styles.row}
                  testID={`activity-${event.id}`}
                >
                  <Icon name="shield" size={20} color={colors.secondary} />
                  <View style={styles.flex}>
                    <Text variant="label">
                      {event.summary || humanizeState(event.eventType)}
                    </Text>
                    <Text variant="small" color={colors.textMuted}>
                      {formatDateTime(event.createdAt)}
                      {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )
        }
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
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
