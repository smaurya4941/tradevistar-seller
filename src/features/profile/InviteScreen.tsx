/**
 * Invite a team member: an email and one of nine roles (Admin only for the owner), with the role's
 * description under the picker. The link comes back once, so on success the share sheet is the next
 * step. A plan's seat limit shows the locked-feature banner with a way to the plans.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  COMPANY_ROLE_DESCRIPTIONS,
  COMPANY_ROLE_LABELS,
  INVITATION_VALID_DAYS,
  inviteUser,
  isValidEmail,
  roleOptionsFor,
  type CompanyRole,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import {
  Banner,
  ChoiceRow,
  colors,
  Field,
  FeatureLockedBanner,
  FormScreen,
  FormSection,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { InviteLinkSheet } from './components/InviteLinkSheet';
import { companyKeys } from './data';
import { isLimitReached, profileErrorMessage } from './errors';
import { useCompanyRole } from './useCompanyRole';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function InviteScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const client = useQueryClient();
  const role = useCompanyRole();
  const [email, setEmail] = useState('');
  const [chosen, setChosen] = useState<CompanyRole | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(false);
  const [sent, setSent] = useState<{
    token: string;
    emailSent: boolean;
    email: string;
  } | null>(null);

  const send = async () => {
    const address = email.trim();
    setError(null);
    setLimit(false);
    const emailBad = !isValidEmail(address);
    setEmailError(emailBad ? t('team.invite.emailInvalid') : null);
    setRoleError(!chosen);
    if (emailBad || !chosen) return;
    setBusy(true);
    try {
      const result = await inviteUser({ email: address, roles: [chosen] });
      track('team_invited', { role: chosen });
      await Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.team }),
        client.invalidateQueries({ queryKey: companyKeys.invitations }),
      ]);
      setSent({
        token: result.token,
        emailSent: result.emailSent,
        email: address,
      });
    } catch (caught) {
      if (isLimitReached(caught)) setLimit(true);
      setError(profileErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      dirty={email.length > 0 || chosen !== null}
      saving={busy}
      onSave={() => {
        void send();
      }}
      saveLabel={t('team.invite.send')}
      testID="screen-invite"
    >
      {limit ? (
        <FeatureLockedBanner
          kind="featureLocked"
          title={t('team.limit.title')}
          message={t('team.limit.body')}
          actionLabel={t('team.limit.plans')}
          onAction={() =>
            navigation.navigate('Section', { sectionId: 'subscription' })
          }
          testID="team-limit"
        />
      ) : error ? (
        <Banner tone="red" message={error} testID="invite-error" />
      ) : null}
      <FormSection
        title={t('team.invite.who')}
        description={t('team.invite.valid', { days: INVITATION_VALID_DAYS })}
      >
        <Field
          label={t('team.invite.email')}
          value={email}
          onChangeText={value => {
            setEmail(value);
            setEmailError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={255}
          error={emailError}
          testID="invite-email"
        />
      </FormSection>
      <FormSection title={t('team.invite.role')}>
        {roleOptionsFor(role.member).map(option => (
          <ChoiceRow
            key={option}
            label={COMPANY_ROLE_LABELS[option]}
            description={COMPANY_ROLE_DESCRIPTIONS[option]}
            selected={chosen === option}
            onPress={() => {
              setChosen(option);
              setRoleError(false);
            }}
            testID={`invite-role-${option}`}
          />
        ))}
        {roleError ? (
          <Text variant="small" color={colors.error} style={styles.error}>
            {t('team.invite.roleRequired')}
          </Text>
        ) : null}
      </FormSection>
      <InviteLinkSheet
        token={sent?.token ?? null}
        email={sent?.email ?? ''}
        emailSent={sent?.emailSent ?? false}
        onClose={() => {
          setSent(null);
          navigation.goBack();
        }}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({ error: { marginTop: spacing.xs } });
