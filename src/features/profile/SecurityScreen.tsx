/**
 * Security and privacy: where the sign-in stands (email, mobile, two-factor, sessions, the last
 * password change) and the way into each setting. An unverified email or mobile is verified here
 * with a six-digit code sent to that channel. The screen is capture-protected, which also blanks
 * its thumbnail in the app switcher.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  confirmContactVerification,
  formatDateTime,
  requestContactVerification,
  type CodeSentView,
  type SecurityChannel,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  colors,
  Divider,
  Icon,
  ListRow,
  spacing,
  StatusBadge,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { CodePanel } from './components/CodePanel';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { companyKeys, useSecurity } from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function SecurityScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const query = useSecurity();
  const [verifying, setVerifying] = useState<{
    channel: SecurityChannel;
    sent: CodeSentView;
  } | null>(null);
  const [sending, setSending] = useState<SecurityChannel | null>(null);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.security }),
      client.invalidateQueries({ queryKey: companyKeys.overview }),
      client.invalidateQueries({ queryKey: companyKeys.account }),
    ]);

  const start = async (channel: SecurityChannel) => {
    setSending(channel);
    try {
      const sent = await requestContactVerification(channel);
      setVerifying({ channel, sent });
    } catch (error) {
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setSending(null);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="screen-security"
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
        {security => (
          <>
            <Card style={styles.tiles}>
              <Tile
                icon="mail"
                label={t('sec.email')}
                value={security.email ?? t('sec.none')}
                verified={security.emailVerified}
                hasValue={Boolean(security.email)}
                action={
                  security.email && !security.emailVerified ? (
                    <Button
                      label={t('form.verify')}
                      size="sm"
                      variant="outline"
                      loading={sending === 'EMAIL'}
                      disabled={sending !== null}
                      onPress={() => {
                        void start('EMAIL');
                      }}
                      testID="verify-email"
                    />
                  ) : null
                }
              />
              <Divider />
              <Tile
                icon="call"
                label={t('sec.mobile')}
                value={security.mobile ?? t('sec.none')}
                verified={security.mobileVerified}
                hasValue={Boolean(security.mobile)}
                action={
                  security.mobile && !security.mobileVerified ? (
                    <Button
                      label={t('form.verify')}
                      size="sm"
                      variant="outline"
                      loading={sending === 'SMS'}
                      disabled={sending !== null}
                      onPress={() => {
                        void start('SMS');
                      }}
                      testID="verify-mobile"
                    />
                  ) : null
                }
              />
              <Divider />
              <View style={styles.tile}>
                <Icon name="security" size={22} color={colors.secondary} />
                <View style={styles.flex}>
                  <Text variant="small" color={colors.textMuted}>
                    {t('sec.twoFactor')}
                  </Text>
                  <Text variant="bodyStrong">
                    {security.twoFactor.enabled
                      ? t('sec.twoFactorOn', {
                          channel:
                            security.twoFactor.channel === 'SMS'
                              ? t('sec.channel.sms')
                              : t('sec.channel.email'),
                        })
                      : t('sec.twoFactorOff')}
                  </Text>
                </View>
                <StatusBadge
                  status={
                    security.twoFactor.enabled ? t('sec.on') : t('sec.off')
                  }
                  tone={security.twoFactor.enabled ? 'green' : 'gray'}
                />
              </View>
              <Divider />
              <View style={styles.tile}>
                <Icon name="devices" size={22} color={colors.secondary} />
                <View style={styles.flex}>
                  <Text variant="small" color={colors.textMuted}>
                    {t('sec.sessions')}
                  </Text>
                  <Text variant="bodyStrong">
                    {t('sec.sessionCount', {
                      count: security.activeSessionCount,
                    })}
                  </Text>
                </View>
              </View>
              <Divider />
              <View style={styles.tile}>
                <Icon name="password" size={22} color={colors.secondary} />
                <View style={styles.flex}>
                  <Text variant="small" color={colors.textMuted}>
                    {t('sec.lastPassword')}
                  </Text>
                  <Text variant="bodyStrong">
                    {security.lastPasswordChangeAt
                      ? formatDateTime(security.lastPasswordChangeAt)
                      : t('sec.neverChanged')}
                  </Text>
                </View>
              </View>
            </Card>

            {!security.emailVerified && !security.mobileVerified ? (
              <Banner tone="amber" message={t('sec.verifyOne')} />
            ) : null}

            <Card style={styles.list}>
              <ListRow
                label={t('sec.twoFactor')}
                icon="security"
                onPress={() => navigation.navigate('TwoFactor')}
                testID="sec-two-factor"
              />
              <Divider />
              <ListRow
                label={t('sec.manageSessions')}
                icon="devices"
                onPress={() => navigation.navigate('Sessions')}
                testID="sec-sessions"
              />
              <Divider />
              <ListRow
                label={t('sec.history')}
                icon="history"
                onPress={() => navigation.navigate('LoginHistory')}
                testID="sec-history"
              />
              <Divider />
              <ListRow
                label={t('sec.changePassword')}
                icon="password"
                onPress={() => navigation.navigate('ChangePassword')}
                testID="sec-password"
              />
              <Divider />
              <ListRow
                label={t('sec.changeLogin')}
                icon="alternate_email"
                onPress={() => navigation.navigate('ContactChange')}
                testID="sec-contact"
              />
            </Card>
          </>
        )}
      </LoadGate>

      <BottomSheet
        visible={verifying !== null}
        onClose={() => setVerifying(null)}
        title={
          verifying?.channel === 'SMS'
            ? t('sec.verifyMobile')
            : t('sec.verifyEmail')
        }
        scrollable
      >
        {verifying ? (
          <View style={styles.sheet}>
            <CodePanel
              testID="verify-code"
              destination={verifying.sent.destination}
              timings={verifying.sent}
              smsAutofill={verifying.channel === 'SMS'}
              onSubmit={async code => {
                await confirmContactVerification(verifying.channel, code);
                setVerifying(null);
                await refresh();
                toast.show(t('sec.verified'), 'success');
              }}
              onResend={async () => {
                const sent = await requestContactVerification(
                  verifying.channel,
                );
                setVerifying({ channel: verifying.channel, sent });
                return sent;
              }}
            />
          </View>
        ) : null}
      </BottomSheet>
    </ScrollView>
  );
}

function Tile({
  icon,
  label,
  value,
  verified,
  hasValue,
  action,
}: {
  icon: string;
  label: string;
  value: string;
  verified: boolean;
  hasValue: boolean;
  action: React.ReactNode;
}) {
  const t = useT();
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={22} color={colors.secondary} />
      <View style={styles.flex}>
        <Text variant="small" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
      {hasValue
        ? action ?? (
            <StatusBadge
              status={verified ? t('hub.verified') : t('hub.unverified')}
              tone={verified ? 'green' : 'orange'}
            />
          )
        : null}
    </View>
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
  tiles: { gap: spacing.md },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  list: { padding: 0, overflow: 'hidden' },
  sheet: { padding: spacing.lg },
});
