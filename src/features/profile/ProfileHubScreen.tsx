/**
 * The profile hub (the web "Profile overview" and its tabs, as a phone screen): who the company is,
 * how complete the profile is, where verification stands, and a list of every area to open. Each
 * missing checklist item opens the screen that fixes it, blocking items first.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  humanizeState,
  MARKETPLACE_LABEL,
  type ProfileOverview,
  type ProfileRequirement,
} from '@tradevistar/seller-api';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { openPortalHref } from '@/app/navigation/openHref';
import type { SharedScreens } from '@/app/navigation/types';
import { useSession } from '@/core/auth/SessionProvider';
import { track } from '@/core/analytics/analytics';
import { queryKeys } from '@/core/query/queryClient';
import { useAccess } from '@/features/access/useAccess';
import {
  Avatar,
  Banner,
  Card,
  colors,
  Divider,
  Icon,
  ListRow,
  SectionTitle,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { AvatarEditor } from './components/AvatarEditor';
import { CompletionRing } from './components/CompletionRing';
import { LoadGate } from './components/LoadGate';
import { StateBadge } from './components/StateBadge';
import { useProfileOverview, useUpdatedLabel } from './data';

type Nav = NativeStackNavigationProp<SharedScreens>;

/** The missing items, blocking ones first (the web's order within each group is kept). */
export function orderedMissing(
  requirements: readonly ProfileRequirement[],
): ProfileRequirement[] {
  const missing = requirements.filter(item => !item.complete);
  return [
    ...missing.filter(item => item.blocking),
    ...missing.filter(item => !item.blocking),
  ];
}

const stateText = (state: string, notProvided: string) =>
  state === 'NOT_PROVIDED' || state === 'NOT_STARTED'
    ? notProvided
    : humanizeState(state);

export function ProfileHubScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const session = useSession();
  const access = useAccess();
  const query = useProfileOverview();
  const updated = useUpdatedLabel(query);
  const [editingAvatar, setEditingAvatar] = useState(false);

  useEffect(() => {
    track('profile_viewed', {});
  }, []);

  const avatarUrl =
    session.status === 'signedIn' ? session.user.avatarUrl : null;

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.company }),
      client.invalidateQueries({ queryKey: queryKeys.access }),
    ]);
  };

  const open = (requirement: ProfileRequirement) => {
    if (!openPortalHref(requirement.href))
      toast.show(t('hub.noScreen'), 'info');
  };

  const sections = useMemo(() => buildSections(t, query.data), [t, query.data]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-profile-hub"
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void refresh();
          }}
        />
      }
    >
      <LoadGate query={query} updatedLabel={updated}>
        {overview => {
          const name =
            overview.company.displayName ??
            overview.company.legalName ??
            t('hub.unnamed');
          const missing = orderedMissing(overview.completion.requirements);
          const kycVerified =
            access.verified || overview.status.kyc === 'VERIFIED';
          return (
            <>
              <Card style={styles.header} testID="hub-header">
                <Pressable
                  onPress={() => setEditingAvatar(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('avatar.change')}
                  style={styles.avatarWrap}
                  testID="hub-avatar"
                >
                  <Avatar
                    uri={avatarUrl ?? overview.company.logoUrl}
                    name={name}
                    size={72}
                  />
                  <View style={styles.camera}>
                    <Icon
                      name="photo_camera"
                      size={16}
                      color={colors.onSecondary}
                    />
                  </View>
                </Pressable>
                <View style={styles.flex}>
                  <View style={styles.nameRow}>
                    <Text variant="h3" numberOfLines={2} style={styles.flex}>
                      {name}
                    </Text>
                    {kycVerified ? (
                      <Icon name="verified" size={20} color={colors.success} />
                    ) : null}
                  </View>
                  {overview.company.legalName &&
                  overview.company.legalName !== name ? (
                    <Text variant="meta" color={colors.textMuted}>
                      {overview.company.legalName}
                    </Text>
                  ) : null}
                  {overview.company.primaryContactName ? (
                    <Text variant="meta">
                      {overview.company.primaryContactName}
                    </Text>
                  ) : null}
                  <ContactLine
                    icon="call"
                    value={overview.contact.mobileNumber}
                    verified={overview.contact.mobileVerified}
                  />
                  <ContactLine
                    icon="mail"
                    value={overview.contact.emailAddress}
                    verified={overview.contact.emailVerified}
                  />
                  <Text variant="small" color={colors.textMuted}>
                    {t('hub.memberSince', {
                      year: new Date(
                        overview.company.memberSince,
                      ).getFullYear(),
                    })}
                  </Text>
                </View>
              </Card>

              {!kycVerified && access.state ? (
                <Banner
                  tone="amber"
                  title={t('hub.kycBannerTitle')}
                  message={t('hub.kycBanner')}
                  actionLabel={t('hub.kycAction')}
                  onAction={() => navigation.navigate('Documents')}
                />
              ) : null}

              <Card style={styles.completion} testID="hub-completion">
                <View style={styles.completionHead}>
                  <CompletionRing
                    percent={overview.completion.percent}
                    label={t('hub.completionLabel', {
                      percent: overview.completion.percent,
                    })}
                  />
                  <View style={styles.flex}>
                    <Text variant="cardTitle">{t('hub.completionTitle')}</Text>
                    <Text variant="meta" color={colors.textMuted}>
                      {t('hub.completionCount', {
                        done: overview.completion.completedCount,
                        total: overview.completion.totalCount,
                      })}
                    </Text>
                  </View>
                </View>
                {missing.map(item => (
                  <Pressable
                    key={item.key}
                    onPress={() => open(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label}. ${item.description}`}
                    style={styles.requirement}
                    testID={`req-${item.key}`}
                  >
                    <Icon
                      name={item.blocking ? 'error' : 'radio_button_unchecked'}
                      size={20}
                      color={item.blocking ? colors.error : colors.outline}
                    />
                    <View style={styles.flex}>
                      <Text variant="label">{item.label}</Text>
                      <Text variant="small" color={colors.textMuted}>
                        {item.description}
                      </Text>
                    </View>
                    <Icon
                      name="chevron_right"
                      size={20}
                      color={colors.outline}
                    />
                  </Pressable>
                ))}
                {missing.length === 0 ? (
                  <Text variant="meta" color={colors.success}>
                    {t('hub.completionDone')}
                  </Text>
                ) : null}
              </Card>

              <Card style={styles.verification} testID="hub-verification">
                <Text variant="section">{t('hub.verification')}</Text>
                <VerifyRow
                  label={t('hub.v.account')}
                  state={overview.status.account}
                />
                <VerifyRow
                  label={t('hub.v.business')}
                  state={overview.status.businessVerification}
                />
                <VerifyRow
                  label={t('hub.v.gst')}
                  state={overview.status.gstVerification}
                />
                <VerifyRow
                  label={t('hub.v.bank')}
                  state={overview.status.bankVerification}
                />
                <VerifyRow label={t('hub.v.kyc')} state={overview.status.kyc} />
                <VerifyRow
                  label={t('hub.v.marketplace')}
                  state={overview.status.marketplace}
                  text={MARKETPLACE_LABEL[overview.status.marketplace]}
                />
              </Card>
            </>
          );
        }}
      </LoadGate>

      <SectionTitle>{t('hub.sections')}</SectionTitle>
      <Card style={styles.list}>
        {sections.map((section, index) => (
          <View key={section.id}>
            {index > 0 ? <Divider /> : null}
            <ListRow
              label={section.label}
              icon={section.icon}
              value={section.hint}
              destructive={section.destructive}
              onPress={() => (section.go ? section.go(navigation) : undefined)}
              testID={`hub-${section.id}`}
            />
          </View>
        ))}
      </Card>

      <AvatarEditor
        visible={editingAvatar}
        hasPhoto={Boolean(avatarUrl)}
        onClose={() => setEditingAvatar(false)}
        onChanged={() => {
          void client.invalidateQueries({ queryKey: queryKeys.company });
        }}
      />
    </ScrollView>
  );
}

function ContactLine({
  icon,
  value,
  verified,
}: {
  icon: string;
  value: string | null;
  verified: boolean;
}) {
  const t = useT();
  if (!value) return null;
  return (
    <View style={styles.contact}>
      <Icon name={icon} size={14} color={colors.textMuted} />
      <Text variant="small" style={styles.flex} numberOfLines={1}>
        {value}
      </Text>
      <Icon
        name={verified ? 'check_circle' : 'error'}
        size={14}
        color={verified ? colors.success : colors.warning}
      />
      <Text
        variant="small"
        color={verified ? colors.success : colors.textMuted}
      >
        {verified ? t('hub.verified') : t('hub.unverified')}
      </Text>
    </View>
  );
}

function VerifyRow({
  label,
  state,
  text,
}: {
  label: string;
  state: string;
  text?: string;
}) {
  const t = useT();
  return (
    <View style={styles.verifyRow}>
      <Text variant="body" style={styles.flex}>
        {label}
      </Text>
      <StateBadge
        state={state}
        label={text ?? stateText(state, t('hub.notProvided'))}
      />
    </View>
  );
}

interface HubSection {
  id: string;
  label: string;
  icon: string;
  hint?: string;
  destructive?: boolean;
  go?: (navigation: Nav) => void;
}

function buildSections(
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
  overview: ProfileOverview | undefined,
): HubSection[] {
  const status = overview?.status;
  const incomplete = (fragment: string) =>
    overview?.completion.requirements.some(
      item => !item.complete && item.href.includes(fragment),
    ) ?? false;
  const mobileUnverified = overview
    ? !overview.contact.mobileVerified || !overview.contact.emailVerified
    : false;
  return [
    {
      id: 'account',
      label: t('hub.s.account'),
      icon: 'manage_accounts',
      hint: mobileUnverified ? t('hub.hint.verifyContact') : undefined,
      go: n => n.navigate('AccountDetails'),
    },
    {
      id: 'business',
      label: t('hub.s.business'),
      icon: 'business',
      hint: status ? MARKETPLACE_LABEL[status.marketplace] : undefined,
      go: n => n.navigate('BusinessDetails'),
    },
    {
      id: 'addresses',
      label: t('hub.s.addresses'),
      icon: 'location_on',
      hint: incomplete('addresses') ? t('hub.hint.addAddress') : undefined,
      go: n => n.navigate('Addresses'),
    },
    {
      id: 'bank',
      label: t('hub.s.bank'),
      icon: 'account_balance',
      hint: status
        ? stateText(status.bankVerification, t('hub.notProvided'))
        : undefined,
      go: n => n.navigate('Bank'),
    },
    {
      id: 'tax',
      label: t('hub.s.tax'),
      icon: 'receipt_long',
      hint: status
        ? stateText(status.gstVerification, t('hub.notProvided'))
        : undefined,
      go: n => n.navigate('TaxGst'),
    },
    {
      id: 'documents',
      label: t('hub.s.documents'),
      icon: 'folder_open',
      hint: incomplete('documents')
        ? t('hub.hint.documentsMissing')
        : status
        ? stateText(status.kyc, t('hub.notProvided'))
        : undefined,
      go: n => n.navigate('Documents'),
    },
    {
      id: 'team',
      label: t('hub.s.team'),
      icon: 'group',
      go: n => n.navigate('Team'),
    },
    {
      id: 'calendar',
      label: t('hub.s.calendar'),
      icon: 'calendar_month',
      go: n => n.navigate('Calendar'),
    },
    {
      id: 'security',
      label: t('hub.s.security'),
      icon: 'lock',
      go: n => n.navigate('Security'),
    },
    {
      id: 'notifications',
      label: t('hub.s.notifications'),
      icon: 'notifications',
      go: n => n.navigate('NotificationSettings'),
    },
    {
      id: 'manager',
      label: t('hub.s.manager'),
      icon: 'support_agent',
      go: n => n.navigate('AccountManager'),
    },
    {
      id: 'closure',
      label: t('hub.s.closure'),
      icon: 'person_remove',
      destructive: true,
      go: n => n.navigate('AccountClosure'),
    },
  ];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  flex: { flex: 1 },
  header: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  avatarWrap: { width: 72, height: 72 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  completion: { gap: spacing.md },
  completionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  requirement: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  verification: { gap: spacing.sm },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 32,
  },
  list: { padding: 0, overflow: 'hidden' },
});
