/** Registration step 2: verify the business email. */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ApiError,
  REGISTER_EMAIL_PATTERN,
  requestOtp,
  verifyOtp,
} from '@tradevistar/seller-api';
import React, { useEffect } from 'react';
import type { RootStackParamList } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { Button } from '@/design';
import { useT } from '@/i18n';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import {
  draftNeedsPassword,
  emailVerified,
  phoneVerified,
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
  'RegisterEmail'
>;

export function RegisterEmailScreen() {
  const t = useT();
  const navigation = useNavigation<Navigation>();
  const draft = useDraft();
  const verified = emailVerified(draft);
  const needsPassword = draftNeedsPassword(draft);

  // A mobile verification that has aged out (or was never done) comes first.
  useEffect(() => {
    if (!phoneVerified(draft)) navigation.navigate('RegisterMobile');
  }, [draft, navigation]);

  const next = () => {
    track('registration_step_completed', { step: 'email' });
    navigation.navigate(
      needsPassword ? 'RegisterPassword' : 'RegisterBusiness',
    );
  };

  return (
    <AuthScreenLayout
      testID="screen-register-email"
      title={t('register.email.title')}
      subtitle={t('register.title')}
      icon="mail"
    >
      <StepLabel step="email" needsPasswordStep={needsPassword} />
      <VerifyIdentifier
        kind="email"
        testID="register-email"
        label={t('register.email.label')}
        placeholder={t('register.email.placeholder')}
        keyboardType="email-address"
        value={draft.email}
        onChangeValue={value =>
          updateDraft({
            email: value.trim().toLowerCase(),
            serverErrors: { ...draft.serverErrors, email: undefined },
          })
        }
        sentAt={draft.emailCodeSentAt}
        verified={verified}
        serverError={draft.serverErrors.email}
        validate={value =>
          REGISTER_EMAIL_PATTERN.test(value)
            ? null
            : t('register.email.invalid')
        }
        onSend={async () => {
          await requestOtp(draft.email, 'REGISTER', 'seller');
          track('otp_requested', { purpose: 'register' });
          updateDraft({
            emailCodeSentAt: Date.now(),
            emailTicket: null,
            emailExisting: false,
            emailPasswordSet: false,
          });
        }}
        onVerify={async code => {
          const result = await verifyOtp(
            draft.email,
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
            emailTicket: {
              value: result.ticket,
              identifier: draft.email,
              issuedAt: Date.now(),
            },
            emailExisting: result.existingAccount ?? false,
            emailPasswordSet: result.passwordSet ?? false,
            emailCodeSentAt: null,
          });
        }}
        onReset={() =>
          updateDraft({
            emailCodeSentAt: null,
            emailTicket: null,
            emailExisting: false,
            emailPasswordSet: false,
          })
        }
      />

      <LinkedAccountNotice />

      <Button
        label={t('common.continue')}
        onPress={next}
        disabled={!verified}
        fullWidth
        testID="register-email-continue"
      />
    </AuthScreenLayout>
  );
}
