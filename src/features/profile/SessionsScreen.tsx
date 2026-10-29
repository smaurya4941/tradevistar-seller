/**
 * Active sessions. Each device shows its portal, IP and when it was last used; "This device" cannot
 * be signed out from here. "Sign out others" ends every other session at once (one call; the buyer
 * app has to loop, the seller API does not).
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  formatDateTime,
  revokeOtherSessions,
  revokeSecuritySession,
  type SessionView,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { track } from '@/core/analytics/analytics';
import {
  Badge,
  Button,
  Card,
  colors,
  ConfirmDialog,
  EmptyState,
  Icon,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { companyKeys, useSessions } from './data';
import { profileErrorMessage } from './errors';

export function SessionsScreen() {
  const t = useT();
  const toast = useToast();
  const client = useQueryClient();
  const query = useSessions();
  const [one, setOne] = useState<SessionView | null>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.sessions }),
      client.invalidateQueries({ queryKey: companyKeys.security }),
    ]);

  const signOutOne = async () => {
    if (!one) return;
    setBusy(true);
    try {
      await revokeSecuritySession(one.id);
      await refresh();
      toast.show(t('sessions.revoked'), 'success');
    } catch (error) {
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setBusy(false);
      setOne(null);
    }
  };

  const signOutOthers = async () => {
    setBusy(true);
    try {
      const result = await revokeOtherSessions();
      track('sessions_revoked_others', {});
      await refresh();
      toast.show(
        result.revoked > 0
          ? t('sessions.revokedOthers', { count: result.revoked })
          : t('sessions.noOthers'),
        'success',
      );
    } catch (error) {
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setBusy(false);
      setAll(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-sessions"
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void refresh();
          }}
        />
      }
    >
      <SecureScreen />
      <LoadGate query={query}>
        {sessions => (
          <>
            {sessions.length === 0 ? (
              <EmptyState icon="devices" title={t('sessions.empty')} />
            ) : (
              sessions.map(session => (
                <Card
                  key={session.id}
                  style={styles.card}
                  testID={`session-${session.id}`}
                >
                  <View style={styles.row}>
                    <Icon
                      name="smartphone"
                      size={22}
                      color={colors.secondary}
                    />
                    <View style={styles.flex}>
                      <Text variant="cardTitle">
                        {session.device || t('sessions.unknownDevice')}
                      </Text>
                      <Text variant="small" color={colors.textMuted}>
                        {session.portal}
                        {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                      </Text>
                    </View>
                    {session.current ? (
                      <Badge label={t('sessions.thisDevice')} tone="green" />
                    ) : null}
                  </View>
                  <Text variant="small" color={colors.textMuted}>
                    {session.lastUsedAt
                      ? t('sessions.lastUsed', {
                          time: formatDateTime(session.lastUsedAt),
                        })
                      : t('sessions.signedInAt', {
                          time: formatDateTime(session.createdAt),
                        })}
                  </Text>
                  {!session.current ? (
                    <Button
                      label={t('sessions.signOut')}
                      size="sm"
                      variant="outline"
                      onPress={() => setOne(session)}
                      testID={`session-${session.id}-signout`}
                    />
                  ) : null}
                </Card>
              ))
            )}
            {sessions.some(session => !session.current) ? (
              <Button
                label={t('sessions.signOutOthers')}
                variant="danger"
                onPress={() => setAll(true)}
                disabled={busy}
                testID="sessions-signout-others"
              />
            ) : null}
          </>
        )}
      </LoadGate>
      <ConfirmDialog
        visible={one !== null}
        title={t('sessions.one.title')}
        message={t('sessions.one.body', { device: one?.device ?? '' })}
        confirmLabel={t('sessions.signOut')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => {
          void signOutOne();
        }}
        onCancel={() => setOne(null)}
      />
      <ConfirmDialog
        visible={all}
        title={t('sessions.all.title')}
        message={t('sessions.all.body')}
        confirmLabel={t('sessions.signOutOthers')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => {
          void signOutOthers();
        }}
        onCancel={() => setAll(false)}
      />
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
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
