/**
 * Communication preferences: how TradeVistar and buyers contact the seller (not the app's
 * language). Preferred language and contact method, the three contact channels, buyer inquiry
 * alerts, and the marketing and promotional consents with the date each was given. Each change
 * shows at once and saves with the record's version; a stale version re-reads and retries once.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatFullDate,
  getCommunicationPreferences,
  updateCommunicationPreferences,
  type CommunicationPreferences,
  type CommunicationUpdate,
} from '@tradevistar/seller-api';
import React, { useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSession } from '@/core/auth/SessionProvider';
import { queryKeys } from '@/core/query/queryClient';
import {
  Card,
  ChoiceRow,
  colors,
  EmptyState,
  SectionTitle,
  Skeleton,
  SwitchRow,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import {
  applyCommunicationPatch,
  CONTACT_METHOD_OPTIONS,
  LANGUAGE_OPTIONS,
  saveCommunication,
} from './communicationSaver';

export function CommunicationSettingsScreen() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = useSession();
  const scope = session.status === 'signedIn' ? session.user.id : null;
  const queryKey = useMemo(
    () => [...queryKeys.communicationPreferences, scope] as const,
    [scope],
  );
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getCommunicationPreferences(signal),
    enabled: scope !== null,
    staleTime: 60_000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const saving = useRef(false);

  const data = query.data;

  const change = async (
    field: string,
    patch: Omit<CommunicationUpdate, 'version'>,
  ) => {
    const current =
      queryClient.getQueryData<CommunicationPreferences>(queryKey);
    if (!current || saving.current) return;
    saving.current = true;
    setBusy(field);
    queryClient.setQueryData(queryKey, applyCommunicationPatch(current, patch));
    try {
      const saved = await saveCommunication(current, patch, {
        get: () => getCommunicationPreferences(),
        update: update => updateCommunicationPreferences(update),
      });
      queryClient.setQueryData(queryKey, saved);
    } catch {
      queryClient.setQueryData(queryKey, current);
      toast.show(t('comm.error.save'), 'error');
    } finally {
      saving.current = false;
      setBusy(null);
    }
  };

  if (data === undefined) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {query.isError ? (
          <EmptyState
            icon="cloud_off"
            title={t('comm.loadFailed')}
            actionLabel={t('common.tryAgain')}
            onAction={() => {
              void query.refetch();
            }}
          />
        ) : (
          <View style={styles.stack} testID="comm-loading">
            <Skeleton height={140} />
            <Skeleton height={200} />
          </View>
        )}
      </ScrollView>
    );
  }

  const consentDate = (iso: string | null) => {
    const date = formatFullDate(iso);
    return date ? t('comm.consent.given', { date }) : t('comm.consent.none');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void query.refetch().finally(() => setRefreshing(false));
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      testID="screen-communication-settings"
    >
      <Text variant="meta" color={colors.textMuted}>
        {t('comm.intro')}
      </Text>

      <View style={styles.group}>
        <SectionTitle>{t('comm.language')}</SectionTitle>
        <View style={styles.choices}>
          {LANGUAGE_OPTIONS.map(option => (
            <ChoiceRow
              key={option.value}
              testID={`comm-lang-${option.value}`}
              label={t(option.labelKey)}
              selected={data.preferredLanguage === option.value}
              onPress={() => {
                if (data.preferredLanguage !== option.value) {
                  void change('language', { preferredLanguage: option.value });
                }
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <SectionTitle>{t('comm.method')}</SectionTitle>
        <View style={styles.choices}>
          {CONTACT_METHOD_OPTIONS.map(option => (
            <ChoiceRow
              key={option.value}
              testID={`comm-method-${option.value}`}
              label={t(option.labelKey)}
              selected={data.preferredContactMethod === option.value}
              onPress={() => {
                if (data.preferredContactMethod !== option.value) {
                  void change('method', {
                    preferredContactMethod: option.value,
                  });
                }
              }}
            />
          ))}
        </View>
      </View>

      <Card style={styles.card}>
        <SwitchRow
          testID="comm-email"
          label={t('comm.email')}
          value={data.emailEnabled}
          disabled={busy !== null}
          onValueChange={emailEnabled => {
            void change('email', { emailEnabled });
          }}
        />
        <SwitchRow
          testID="comm-phone"
          label={t('comm.phone')}
          value={data.phoneEnabled}
          disabled={busy !== null}
          onValueChange={phoneEnabled => {
            void change('phone', { phoneEnabled });
          }}
        />
        <SwitchRow
          testID="comm-whatsapp"
          label={t('comm.whatsapp')}
          value={data.whatsappEnabled}
          disabled={busy !== null}
          onValueChange={whatsappEnabled => {
            void change('whatsapp', { whatsappEnabled });
          }}
        />
        <SwitchRow
          testID="comm-inquiry-alerts"
          label={t('comm.inquiryAlerts')}
          description={t('comm.inquiryAlerts.body')}
          value={data.buyerInquiryAlerts}
          disabled={busy !== null}
          onValueChange={buyerInquiryAlerts => {
            void change('inquiryAlerts', { buyerInquiryAlerts });
          }}
        />
      </Card>

      <Card style={styles.card}>
        <SwitchRow
          testID="comm-marketing"
          label={t('comm.marketing')}
          description={
            data.marketingOptIn
              ? consentDate(data.marketingOptInAt)
              : t('comm.consent.none')
          }
          value={data.marketingOptIn}
          disabled={busy !== null}
          onValueChange={marketingOptIn => {
            void change('marketing', { marketingOptIn });
          }}
        />
        <SwitchRow
          testID="comm-promotional"
          label={t('comm.promotional')}
          description={
            data.promotionalOptIn
              ? consentDate(data.promotionalOptInAt)
              : t('comm.consent.none')
          }
          value={data.promotionalOptIn}
          disabled={busy !== null}
          onValueChange={promotionalOptIn => {
            void change('promotional', { promotionalOptIn });
          }}
        />
      </Card>
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
  stack: { gap: spacing.md },
  group: { gap: spacing.sm },
  choices: { gap: spacing.sm },
  card: { gap: spacing.xs },
});
