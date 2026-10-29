/**
 * Registration step 1: verify the mobile number. Also where a staff onboarding-invitation link
 * lands (`…/seller/register?onboardingInvite=<token>`): the invitation pre-fills empty fields, but
 * both codes still have to be verified by the seller.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ApiError,
  getOnboardingInvitePrefill,
  phonePrefixLabel,
  requestOtp,
  sanitizePhone,
  validatePhone,
  verifyOtp,
} from '@tradevistar/seller-api';
import React, { useEffect, useState } from 'react';
import type { RootStackParamList } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { Banner, Button } from '@/design';
import { useT } from '@/i18n';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import {
  phoneVerified,
  registrationDraft,
  updateDraft,
  useDraft,
} from './registrationDraft';
import {
  LinkedAccountNotice,
  StepLabel,
  VerifyIdentifier,
} from './RegistrationParts';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'RegisterMobile'
>;

export function RegisterMobileScreen() {
  const t = useT();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'RegisterMobile'>>();
  const draft = useDraft();
  const verified = phoneVerified(draft);
  const inviteToken = route.params?.onboardingInvite;
  const [inviteState, setInviteState] = useState<'idle' | 'applied' | 'failed'>(
    'idle',
  );

  useEffect(() => {
    track('registration_started', {});
  }, []);

  useEffect(() => {
    if (!inviteToken) return;
    const controller = new AbortController();
    getOnboardingInvitePrefill(inviteToken, controller.signal)
      .then(prefill => {
        // Fill only what the seller has not typed.
        const current = registrationDraft.get();
        updateDraft({
          mobile:
            current.mobile ||
            sanitizePhone(prefill.phone, prefill.businessCountryCode),
          email: current.email || prefill.email,
          companyName: current.companyName || prefill.companyName,
          gstin: current.gstin || prefill.gstin,
          categoryCode: current.categoryCode || prefill.categoryCode,
          countryCode:
            current.companyName || !prefill.businessCountryCode
              ? current.countryCode
              : prefill.businessCountryCode,
        });
        setInviteState('applied');
      })
      .catch(() => {
        // Offline or a dead link: the seller carries on by hand.
        if (!controller.signal.aborted) setInviteState('failed');
      });
    return () => controller.abort();
  }, [inviteToken]);

  return (
    <AuthScreenLayout
      testID="screen-register-mobile"
      title={t('register.mobile.title')}
      subtitle={t('register.title')}
      icon="smartphone"
    >
      <StepLabel step="mobile" needsPasswordStep />
      {inviteState === 'applied' ? (
        <Banner
          tone="blue"
          message={t('register.invite.applied')}
          testID="register-invite-applied"
        />
      ) : null}
      {inviteState === 'failed' ? (
        <Banner
          tone="amber"
          message={t('register.invite.failed')}
          testID="register-invite-failed"
        />
      ) : null}

      <VerifyIdentifier
        kind="mobile"
        testID="register-mobile"
        label={t('register.mobile.label')}
        placeholder={t('register.mobile.placeholder')}
        keyboardType="phone-pad"
        prefix={phonePrefixLabel(draft.mobile)}
        value={draft.mobile}
        onChangeValue={value =>
          updateDraft({
            mobile: sanitizePhone(value),
            serverErrors: { ...draft.serverErrors, mobile: undefined },
          })
        }
        sentAt={draft.phoneCodeSentAt}
        verified={verified}
        serverError={draft.serverErrors.mobile}
        validate={value => validatePhone(value, 'IN')}
        onSend={async () => {
          await requestOtp(draft.mobile, 'REGISTER', 'seller');
          track('otp_requested', { purpose: 'register' });
          updateDraft({
            phoneCodeSentAt: Date.now(),
            phoneTicket: null,
            phoneExisting: false,
            phonePasswordSet: false,
          });
        }}
        onVerify={async code => {
          const result = await verifyOtp(
            draft.mobile,
            'REGISTER',
            code,
            'seller',
          );
          if (!result.verified || !result.ticket) {
            throw new ApiError(401, {
              code: 'OTP_NOT_VERIFIED',
              message: 'Invalid or expired code.',
            });
          }
          updateDraft({
            phoneTicket: {
              value: result.ticket,
              identifier: draft.mobile,
              issuedAt: Date.now(),
            },
            phoneExisting: result.existingAccount ?? false,
            phonePasswordSet: result.passwordSet ?? false,
            phoneCodeSentAt: null,
          });
        }}
        onReset={() =>
          updateDraft({
            phoneCodeSentAt: null,
            phoneTicket: null,
            phoneExisting: false,
            phonePasswordSet: false,
          })
        }
      />

      <LinkedAccountNotice />

      <Button
        label={t('common.continue')}
        onPress={() => {
          track('registration_step_completed', { step: 'mobile' });
          navigation.navigate('RegisterEmail');
        }}
        disabled={!verified}
        fullWidth
        testID="register-mobile-continue"
      />
    </AuthScreenLayout>
  );
}
