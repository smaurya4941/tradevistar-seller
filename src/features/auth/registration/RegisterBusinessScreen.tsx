/**
 * Registration step 4: the business details, then submit. Nothing signs the seller in: the account
 * waits for approval, and the next screen says so.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  COMPANY_NAME_MAX,
  getCategories,
  getLocationCountries,
  GSTIN_LENGTH,
  sanitizeGstin,
} from '@tradevistar/seller-api';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { uuidv4 } from '@/core/api/randomId';
import { track } from '@/core/analytics/analytics';
import type { MappedError } from '@/core/errors/errorMapper';
import { Button, colors, Field, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { useAuth } from '../AuthProvider';
import { AuthErrorNotice } from '../components/AuthErrorNotice';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { openLegalDocument } from '@/features/info/legal';
import { OptionPicker } from './OptionPicker';
import {
  draftNeedsPassword,
  emailVerified,
  phoneVerified,
  updateDraft,
  useDraft,
} from './registrationDraft';
import { businessErrors, submitRegistration } from './registrationFlow';
import { LinkedAccountNotice, StepLabel } from './RegistrationParts';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'RegisterBusiness'
>;

const COUNTRIES_KEY = ['reference', 'countries'] as const;

const loadCountries = async (signal?: AbortSignal) =>
  (await getLocationCountries(signal)).map(country => ({
    value: country.code,
    label: country.name,
  }));

const loadCategories = async (signal?: AbortSignal) =>
  (await getCategories(signal)).map(category => ({
    value: category.code,
    label: category.name,
  }));

export function RegisterBusinessScreen() {
  const t = useT();
  const auth = useAuth();
  const navigation = useNavigation<Navigation>();
  const draft = useDraft();
  const gstinRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [errors, setErrors] = useState<{
    companyName?: string;
    gstin?: string;
    country?: string;
  }>({});
  const [failure, setFailure] = useState<MappedError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const needsPassword = draftNeedsPassword(draft);

  // Reaching this step needs both verifications (and a password where one is asked for).
  useEffect(() => {
    if (submitting) return;
    if (!phoneVerified(draft)) navigation.navigate('RegisterMobile');
    else if (!emailVerified(draft)) navigation.navigate('RegisterEmail');
  }, [draft, navigation, submitting]);

  const submit = async () => {
    if (submitting) return;
    const found = businessErrors(draft, t);
    setErrors(found);
    setFailure(null);
    setFormError(null);
    if (found.companyName || found.gstin || found.country) return;

    track('registration_step_completed', { step: 'business' });
    setSubmitting(true);
    try {
      const outcome = await submitRegistration(auth, draft, uuidv4, t);
      switch (outcome.kind) {
        case 'done':
          navigation.reset({
            index: 0,
            routes: [
              { name: 'RegisterSubmitted', params: { linked: outcome.linked } },
            ],
          });
          return;
        case 'verify':
        case 'conflict':
          updateDraft({
            serverErrors: {
              ...draft.serverErrors,
              [outcome.step]: outcome.message,
            },
          });
          navigation.navigate(
            outcome.step === 'mobile' ? 'RegisterMobile' : 'RegisterEmail',
          );
          return;
        case 'businessError':
          setErrors({
            companyName: outcome.fieldErrors?.companyName,
            gstin: outcome.fieldErrors?.gstin,
          });
          setFormError(outcome.message);
          return;
        case 'failed':
          setFailure(outcome.error);
          return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const countries = useQuery({
    queryKey: COUNTRIES_KEY,
    queryFn: ({ signal }) => loadCountries(signal),
    staleTime: 10 * 60_000,
  });
  const selectedCountry = draft.countryCode;
  const countryLabel = selectedCountry
    ? countries.data?.find(option => option.value === selectedCountry)?.label ??
      draft.countryName ??
      selectedCountry
    : '';

  return (
    <AuthScreenLayout
      testID="screen-register-business"
      title={t('register.business.title')}
      subtitle={t('register.title')}
      icon="business"
    >
      <StepLabel step="business" needsPasswordStep={needsPassword} />
      <LinkedAccountNotice />

      <Field
        label={t('register.business.company')}
        value={draft.companyName}
        onChangeText={value => {
          updateDraft({ companyName: value });
          setErrors(previous => ({ ...previous, companyName: undefined }));
        }}
        maxLength={COMPANY_NAME_MAX}
        autoCapitalize="words"
        autoComplete="organization"
        textContentType="organizationName"
        returnKeyType="next"
        onSubmitEditing={() => gstinRef.current?.focus()}
        error={errors.companyName}
        editable={!submitting}
        testID="register-company"
      />
      <Field
        ref={gstinRef}
        label={t('register.business.gstin')}
        hint={t('register.business.gstinHint')}
        value={draft.gstin}
        onChangeText={value => {
          updateDraft({ gstin: sanitizeGstin(value) });
          setErrors(previous => ({ ...previous, gstin: undefined }));
        }}
        maxLength={GSTIN_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        error={errors.gstin}
        editable={!submitting}
        testID="register-gstin"
      />
      <OptionPicker
        label={t('register.business.country')}
        placeholder={t('register.business.pickCountry')}
        title={t('register.business.country')}
        selectedLabel={countryLabel}
        selectedValue={selectedCountry}
        queryKey={COUNTRIES_KEY}
        load={loadCountries}
        onSelect={option => {
          updateDraft({
            countryCode: option?.value ?? '',
            countryName: option?.label ?? '',
          });
          setErrors(previous => ({ ...previous, country: undefined }));
        }}
        error={errors.country}
        testID="register-country"
      />
      <OptionPicker
        label={t('register.business.category')}
        placeholder={t('register.business.pickCategory')}
        title={t('register.business.category')}
        selectedLabel={draft.categoryName || draft.categoryCode}
        selectedValue={draft.categoryCode}
        queryKey={['reference', 'categories']}
        load={loadCategories}
        allowClear
        onSelect={option =>
          updateDraft({
            categoryCode: option?.value ?? '',
            categoryName: option?.label ?? '',
          })
        }
        testID="register-category"
      />

      {formError ? (
        <Text variant="small" color={colors.error} accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}
      {failure ? (
        <AuthErrorNotice error={failure} testID="register-error" />
      ) : null}

      <Text variant="small" color={colors.textMuted}>
        {t('register.terms.prefix')}
        <Text
          variant="small"
          color={colors.link}
          onPress={() => {
            void openLegalDocument('terms');
          }}
          accessibilityRole="link"
        >
          {t('register.terms.terms')}
        </Text>
        {t('register.terms.and')}
        <Text
          variant="small"
          color={colors.link}
          onPress={() => {
            void openLegalDocument('privacy');
          }}
          accessibilityRole="link"
        >
          {t('register.terms.privacy')}
        </Text>
        .
      </Text>

      <View style={styles.submit}>
        <Button
          label={t('register.submit')}
          onPress={() => {
            void submit();
          }}
          loading={submitting}
          fullWidth
          testID="register-submit"
        />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ submit: { marginTop: spacing.sm } });
