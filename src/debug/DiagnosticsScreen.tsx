/**
 * Diagnostics (dev and staging builds only): proves the session chain on a real device —
 * environment and API reachability, the signed-in user, token expiry, refresh-token rotation and
 * single-flight refresh.
 *
 * It never displays a token: only expiry times and a 6-character fingerprint (the start of the
 * token's SHA-256), which is enough to see that a token was replaced.
 */
import * as Sentry from '@sentry/react-native';
import {
  errorMessage,
  getAccessToken,
  getHealth,
  getMe,
  onAccessTokenChange,
  refreshRequestCount,
  refreshSession,
  setAccessToken,
  tokenExpiresAt,
  type HealthStatus,
} from '@tradevistar/seller-api';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { env } from '@/config/env';
import { useAppConfigState } from '@/core/appConfig/appConfigStore';
import { useSession } from '@/core/auth/SessionProvider';
import { fingerprint } from '@/core/crypto/fingerprint';
import {
  appVersion,
  buildNumber,
  bundleId,
  userAgent,
} from '@/core/device/deviceInfo';
import { isErrorReportingOn, reportError } from '@/core/observability';
import { isFirebaseConfigured } from '@/core/observability/firebase';
import { pushStatusStore } from '@/core/push/pushRegistration';
import { showLocalTestAlert } from '@/core/push/localAlerts';
import { getPushPermission } from '@/core/push/permission';
import { socketStatusStore } from '@/core/realtime/notificationSocket';
import { getRefreshToken } from '@/core/storage/secureStore';
import { useStore } from '@/core/store';
import { Button, Card, colors, Icon, Screen, spacing, Text } from '@/design';
import { useT } from '@/i18n';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="meta" color={colors.textMuted} style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="meta" style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={20} color={colors.secondary} />
        <Text variant="cardTitle" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

function useAccessTokenExpiry(): number | null {
  const read = () => {
    const token = getAccessToken();
    return token ? tokenExpiresAt(token) ?? null : null;
  };
  const [expiry, setExpiry] = useState(read);
  useEffect(() => onAccessTokenChange(() => setExpiry(read())), []);
  return expiry;
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function EnvironmentSection() {
  const t = useT();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ping = useCallback(async () => {
    setBusy(true);
    setError(null);
    const started = Date.now();
    try {
      setHealth(await getHealth());
      setLatency(Date.now() - started);
    } catch (e) {
      setHealth(null);
      setError(errorMessage(e, 'Health check failed'));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void ping();
  }, [ping]);

  return (
    <Section icon="dns" title={t('diag.env')}>
      <Row label="APP_ENV" value={env.appEnv} />
      <Row label="API_BASE_URL" value={env.apiBaseUrl} />
      <Row label="SOCKET_URL" value={env.socketUrl} />
      <Row label="WEB_URL" value={env.webUrl} />
      <Row label="Analytics" value={env.analyticsEnabled ? 'on' : 'off'} />
      <Row label="Sentry" value={isErrorReportingOn() ? 'on' : 'off'} />
      <Row
        label="Firebase"
        value={isFirebaseConfigured() ? 'configured' : 'not configured'}
      />
      <Row
        label={t('diag.health')}
        value={
          error
            ? error
            : health
            ? `${health.status} · db ${health.database} · ${latency ?? '?'} ms`
            : '…'
        }
      />
      <Button
        label={t('diag.health.check')}
        variant="outline"
        size="sm"
        loading={busy}
        onPress={() => {
          void ping();
        }}
      />
    </Section>
  );
}

function SessionSection() {
  const t = useT();
  const session = useSession();
  const expiry = useAccessTokenExpiry();
  const now = useNow();
  const [prints, setPrints] = useState<string[]>([]);
  const [result, setResult] = useState<string>('—');
  const [busy, setBusy] = useState(false);
  const [, bump] = useState(0);

  const readPrint = useCallback(async () => {
    const print = fingerprint(await getRefreshToken());
    setPrints(previous =>
      print && previous[0] !== print
        ? [print, ...previous].slice(0, 6)
        : previous,
    );
    return print;
  }, []);

  useEffect(() => {
    void readPrint();
  }, [readPrint, session.status]);

  const run = async (label: string, work: () => Promise<string>) => {
    setBusy(true);
    const before = refreshRequestCount();
    try {
      const outcome = await work();
      const refreshes = refreshRequestCount() - before;
      setResult(`${label}: ${outcome} · ${refreshes} refresh request(s)`);
    } catch (e) {
      setResult(`${label}: failed — ${errorMessage(e, 'error')}`);
    } finally {
      await readPrint();
      bump(value => value + 1);
      setBusy(false);
    }
  };

  const user =
    session.status === 'signedIn' || session.status === 'offline'
      ? session.user
      : null;

  return (
    <>
      <Section icon="person" title={t('diag.session')}>
        <Row label="Status" value={session.status} />
        <Row
          label={t('diag.session.user')}
          value={
            user ? user.email ?? user.phone ?? user.id : t('diag.session.none')
          }
        />
        <Row
          label={t('diag.session.roles')}
          value={user ? user.roles.join(', ') : t('diag.session.none')}
        />
        <Row
          label={t('diag.session.accessExpires')}
          value={
            expiry
              ? `${new Date(expiry).toLocaleTimeString()} (${formatRemaining(
                  expiry - now,
                )})`
              : t('diag.session.none')
          }
        />
        <Row
          label={t('diag.session.refreshFingerprint')}
          value={prints[0] ?? t('diag.session.none')}
        />
        <Row label="Fingerprint history" value={prints.join(' ← ') || '—'} />
      </Section>

      <Section icon="key" title={t('diag.actions')}>
        <Button
          label={t('diag.discardAccess')}
          variant="outline"
          size="sm"
          disabled={busy}
          onPress={() => {
            setAccessToken(null);
            setResult('Access token discarded (memory only)');
          }}
        />
        <Button
          label={t('diag.refreshNow')}
          variant="outline"
          size="sm"
          loading={busy}
          onPress={() => {
            void run('Refresh', async () => {
              await refreshSession();
              return 'ok';
            });
          }}
        />
        <Button
          label="Refresh ×3 in a row"
          variant="outline"
          size="sm"
          disabled={busy}
          onPress={() => {
            void run('Refresh ×3', async () => {
              for (let i = 0; i < 3; i += 1) await refreshSession();
              return 'ok';
            });
          }}
        />
        <Button
          label={t('diag.callApi')}
          variant="outline"
          size="sm"
          disabled={busy}
          onPress={() => {
            void run('/auth/me', async () => {
              const me = await getMe();
              return `ok (${me.roles.join(', ')})`;
            });
          }}
        />
        <Button
          label={t('diag.callApiFive')}
          variant="outline"
          size="sm"
          disabled={busy}
          onPress={() => {
            void run('/auth/me ×5', async () => {
              await Promise.all([1, 2, 3, 4, 5].map(() => getMe()));
              return 'all ok';
            });
          }}
        />
        <Text variant="meta" color={colors.textMuted} selectable>
          {t('diag.result')}: {result}
        </Text>
      </Section>
    </>
  );
}

/** The notifications socket and device push, for checking Phase 2 on a real phone. */
function RealtimeSection() {
  const t = useT();
  const socket = useStore(socketStatusStore);
  const push = useStore(pushStatusStore);
  const [permission, setPermission] = useState<string>('—');
  const [alertResult, setAlertResult] = useState<string | null>(null);
  useEffect(() => {
    getPushPermission()
      .then(setPermission)
      .catch(() => setPermission('unknown'));
  }, []);
  return (
    <Section icon="sync" title={t('diag.realtime')}>
      <Row label="Socket" value={socket.state} />
      <Row
        label="Last event"
        value={
          socket.lastEventAt
            ? new Date(socket.lastEventAt).toLocaleTimeString()
            : '—'
        }
      />
      <Row label="Socket error" value={socket.lastError ?? '—'} />
      <Row label="Notification permission" value={permission} />
      <Row
        label="Firebase"
        value={push.firebaseConfigured ? 'configured' : 'not configured'}
      />
      <Row label="Device registration" value={push.registration} />
      <Row label="Registration note" value={push.lastError ?? '—'} />
      <Button
        label={t('diag.localAlert')}
        variant="outline"
        size="sm"
        onPress={() => {
          void showLocalTestAlert().then(shown =>
            setAlertResult(shown ? 'Shown.' : 'Not shown (permission?)'),
          );
        }}
      />
      {alertResult ? (
        <Text variant="meta" color={colors.textMuted}>
          {alertResult}
        </Text>
      ) : null}
    </Section>
  );
}

function BuildSection() {
  const t = useT();
  const { resolved } = useAppConfigState();
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Section icon="info" title={t('diag.build')}>
      <Row label="Version" value={`${appVersion} (${buildNumber})`} />
      <Row label="Bundle id" value={bundleId} />
      <Row label="User-Agent" value={userAgent()} />
      <Row
        label="Update check"
        value={`${resolved.verdict} · config ${resolved.source}`}
      />
      <Row
        label="Min / latest"
        value={`${resolved.config.minSupportedVersion} / ${resolved.config.latestVersion}`}
      />
      <Button
        label={t('diag.sentryTest')}
        variant="outline"
        size="sm"
        onPress={() => {
          if (!isErrorReportingOn()) {
            setSent('Sentry is off in this build (no SENTRY_DSN).');
            return;
          }
          reportError(new Error('Diagnostics test event'), {
            source: 'diagnostics',
          });
          Sentry.captureMessage('Diagnostics test message', 'info');
          setSent('Sent.');
        }}
      />
      {sent ? (
        <Text variant="meta" color={colors.textMuted}>
          {sent}
        </Text>
      ) : null}
    </Section>
  );
}

export function DiagnosticsScreen() {
  return (
    <Screen edges={['bottom']}>
      <View style={styles.stack} testID="screen-diagnostics">
        <EnvironmentSection />
        <SessionSection />
        <RealtimeSection />
        <BuildSection />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  rowLabel: { width: 120 },
  rowValue: { flex: 1 },
});
