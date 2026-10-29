/**
 * Registration step 3: choose a password. Shown only when the account being created or joined has
 * none; an existing account that already has a password keeps it, and this step is skipped.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { Button } from '@/design';
import { useT } from '@/i18n';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { PasswordField } from '../components/PasswordField';
import { newPasswordError, type PasswordErrors } from '../passwordForm';
import {
  draftNeedsPassword,
  emailVerified,
  phoneVerified,
  updateDraft,
  useDraft,
} from './registrationDraft';
import { LinkedAccountNotice, StepLabel } from './RegistrationParts';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'RegisterPassword'
>;

export function RegisterPasswordScreen() {
  const t = useT();
  const navigation = useNavigation<Navigation>();
  const draft = useDraft();
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [errors, setErrors] = useState<PasswordErrors>({});

  useEffect(() => {
    if (!phoneVerified(draft)) navigation.navigate('RegisterMobile');
    else if (!emailVerified(draft)) navigation.navigate('RegisterEmail');
    else if (!draftNeedsPassword(draft))
      navigation.navigate('RegisterBusiness');
  }, [draft, navigation]);

  const next = () => {
    const found = newPasswordError(draft.password, draft.confirmPassword, t);
    setErrors(found);
    if (found.password || found.confirm) return;
    track('registration_step_completed', { step: 'password' });
    navigation.navigate('RegisterBusiness');
  };

  return (
    <AuthScreenLayout
      testID="screen-register-password"
      title={t('register.password.title')}
      subtitle={t('register.title')}
      icon="lock"
    >
      <StepLabel step="password" needsPasswordStep />
      <LinkedAccountNotice />
      <PasswordField
        isNew
        label={t('register.password.label')}
        hint={t('register.password.hint')}
        value={draft.password}
        onChangeText={value => {
          updateDraft({ password: value });
          setErrors({});
        }}
        maxLength={128}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={errors.password}
        testID="register-password"
      />
      <PasswordField
        ref={confirmRef}
        isNew
        label={t('register.password.confirm')}
        value={draft.confirmPassword}
        onChangeText={value => {
          updateDraft({ confirmPassword: value });
          setErrors({});
        }}
        maxLength={128}
        returnKeyType="next"
        onSubmitEditing={next}
        error={errors.confirm}
        testID="register-confirm"
      />
      <Button
        label={t('common.continue')}
        onPress={next}
        fullWidth
        testID="register-password-continue"
      />
    </AuthScreenLayout>
  );
}
