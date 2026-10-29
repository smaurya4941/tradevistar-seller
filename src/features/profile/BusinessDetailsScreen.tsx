/**
 * Business details. Buyer-visible fields go back through approval before they appear on the
 * marketplace, which the screen says. The optional lists the API supports and the web hides
 * (secondary categories, certificates, export countries) are in an "Also sells / certified" card.
 * Registrations live on their own screen, linked from here.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  BUSINESS_LIMITS,
  BUSINESS_OWNERSHIP_TYPES,
  EMPLOYEE_BUCKETS,
  MARKETPLACE_LABEL,
  TURNOVER_BUCKETS,
  updateBusinessDetails,
  validateBusiness,
  type BusinessDetailsView,
  type BusinessErrors,
  type BusinessPatch,
} from '@tradevistar/seller-api';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { serverFieldErrors } from '@/core/forms/serverErrors';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import { useVersionedForm } from '@/core/forms/useVersionedForm';
import { queryKeys } from '@/core/query/queryClient';
import {
  Banner,
  Button,
  colors,
  Field,
  FormScreen,
  FormSection,
  InlineLink,
  MultiSelectField,
  SelectField,
  spacing,
  Text,
  TextArea,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { StateBadge } from './components/StateBadge';
import {
  companyKeys,
  useBusiness,
  useCategories,
  useCountries,
  useScope,
  useUpdatedLabel,
} from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

interface BusinessForm extends Record<string, unknown> {
  legalName: string;
  displayName: string;
  businessType: string;
  ownershipType: string;
  yearEstablished: string;
  industry: string;
  primaryCategoryCode: string;
  employeesBucket: string;
  turnoverBucket: string;
  factorySize: string;
  description: string;
  secondaryCategoryCodes: string[];
  certificates: string[];
  exportCountryCodes: string[];
}

const toForm = (business: BusinessDetailsView): BusinessForm => ({
  legalName: business.legalName ?? '',
  displayName: business.displayName ?? '',
  businessType: business.businessType ?? '',
  ownershipType: business.ownershipType ?? '',
  yearEstablished: business.yearEstablished
    ? String(business.yearEstablished)
    : '',
  industry: business.industry ?? '',
  primaryCategoryCode: business.primaryCategoryCode ?? '',
  employeesBucket: business.employeesBucket ?? '',
  turnoverBucket: business.turnoverBucket ?? '',
  factorySize: business.factorySize ?? '',
  description: business.description ?? '',
  secondaryCategoryCodes: business.secondaryCategoryCodes ?? [],
  certificates: business.certificates ?? [],
  exportCountryCodes: business.exportCountryCodes ?? [],
});

/** The save body: `yearEstablished` goes as a number, blank text as null. */
function toPatch(
  changes: Partial<BusinessForm>,
  version: number,
): BusinessPatch {
  const { yearEstablished, ...rest } = changes;
  const body: Record<string, unknown> = { ...rest, version };
  if ('yearEstablished' in changes)
    body.yearEstablished = yearEstablished ? Number(yearEstablished) : null;
  return body as BusinessPatch;
}

export function BusinessDetailsScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const scope = useScope();
  const query = useBusiness();
  const updated = useUpdatedLabel(query);
  const categories = useCategories();
  const countries = useCountries();
  const [showErrors, setShowErrors] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [certificate, setCertificate] = useState('');

  const refetch = useCallback(
    async () => (await query.refetch()).data,
    [query],
  );

  const form = useVersionedForm<BusinessDetailsView, BusinessForm>({
    server: query.data,
    toForm,
    refetch,
    save: (changes, version) =>
      updateBusinessDetails(toPatch(changes, version)),
    onSaved: saved => {
      client.setQueryData([...companyKeys.business, scope], saved);
      // Account and Business share one profile version.
      void Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.account }),
        client.invalidateQueries({ queryKey: companyKeys.overview }),
        client.invalidateQueries({ queryKey: queryKeys.access }),
      ]);
      toast.show(t('form.saved'), 'success');
    },
  });
  useUnsavedGuard(form.dirty);

  const values = form.form;
  const errors = useMemo(
    () => (values ? validateBusiness(values) : {}),
    [values],
  );
  const shown = (name: keyof BusinessErrors) =>
    (showErrors ? errors[name] : undefined) ?? fieldErrors[name];

  React.useEffect(() => {
    if (form.error) setFieldErrors(serverFieldErrors(form.error));
  }, [form.error]);
  const generalError =
    form.error && Object.keys(serverFieldErrors(form.error)).length === 0
      ? profileErrorMessage(form.error, t)
      : null;

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setFieldErrors({});
    await form.submit();
  };

  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).map(category => ({
        value: category.code,
        label: category.name,
      })),
    [categories.data],
  );
  const countryOptions = useMemo(
    () =>
      (countries.data ?? []).map(country => ({
        value: country.code,
        label: country.name,
      })),
    [countries.data],
  );
  const ownershipOptions = useMemo(
    () =>
      BUSINESS_OWNERSHIP_TYPES.map(item => ({
        value: item.value,
        label: item.label,
      })),
    [],
  );
  // A value the server holds that is not in the picker's list stays selectable.
  const bucketOptions = (list: readonly string[], current: string) =>
    [...(current && !list.includes(current) ? [current] : []), ...list].map(
      value => ({ value, label: value }),
    );

  const addCertificate = () => {
    const value = certificate.trim();
    if (!value || !values || values.certificates.includes(value)) return;
    if (values.certificates.length >= BUSINESS_LIMITS.certificates) return;
    form.setField('certificates', [...values.certificates, value]);
    setCertificate('');
  };

  return (
    <FormScreen
      dirty={form.dirty}
      saving={form.saving}
      onSave={() => {
        void save();
      }}
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
      testID="screen-business"
    >
      <LoadGate query={query} updatedLabel={updated}>
        {business => (
          <>
            {form.staleNotice ? (
              <Banner
                tone="amber"
                message={t('form.staleReview')}
                testID="stale-notice"
              />
            ) : null}
            {generalError ? <Banner tone="red" message={generalError} /> : null}

            <View style={styles.states}>
              <View style={styles.stateItem}>
                <Text variant="small" color={colors.textMuted}>
                  {t('business.marketplace')}
                </Text>
                <StateBadge
                  state={business.marketplaceState}
                  label={MARKETPLACE_LABEL[business.marketplaceState]}
                  testID="business-marketplace"
                />
              </View>
              <View style={styles.stateItem}>
                <Text variant="small" color={colors.textMuted}>
                  {t('business.verification')}
                </Text>
                <StateBadge state={business.businessVerification} />
              </View>
            </View>
            {business.marketplaceState === 'REJECTED' ||
            business.businessVerification === 'REJECTED' ? (
              <Banner
                tone="red"
                title={t('business.rejectedTitle')}
                message={
                  business.businessRejectionReason ?? t('business.rejected')
                }
                testID="business-rejected"
              />
            ) : null}
            <Banner tone="blue" message={t('business.approvalNote')} />

            {values ? (
              <>
                <FormSection title={t('business.section.info')}>
                  <Field
                    label={t('business.legalName')}
                    value={values.legalName}
                    onChangeText={value => form.setField('legalName', value)}
                    maxLength={200}
                    error={shown('legalName')}
                    testID="business-legal"
                  />
                  <Field
                    label={t('business.displayName')}
                    value={values.displayName}
                    onChangeText={value => form.setField('displayName', value)}
                    maxLength={200}
                    error={shown('displayName')}
                  />
                  <Field
                    label={t('business.type')}
                    value={values.businessType}
                    onChangeText={value => form.setField('businessType', value)}
                    maxLength={100}
                    error={shown('businessType')}
                  />
                  <SelectField
                    label={t('business.ownership')}
                    value={values.ownershipType}
                    options={ownershipOptions}
                    clearable
                    onChange={value => form.setField('ownershipType', value)}
                  />
                  <Field
                    label={t('business.year')}
                    value={values.yearEstablished}
                    onChangeText={value =>
                      form.setField(
                        'yearEstablished',
                        value.replace(/\D/g, '').slice(0, 4),
                      )
                    }
                    keyboardType="number-pad"
                    maxLength={4}
                    error={shown('yearEstablished')}
                    testID="business-year"
                  />
                  <Field
                    label={t('business.industry')}
                    value={values.industry}
                    onChangeText={value => form.setField('industry', value)}
                    maxLength={100}
                  />
                  <SelectField
                    label={t('business.primaryCategory')}
                    value={values.primaryCategoryCode}
                    options={categoryOptions}
                    searchable
                    clearable
                    loading={categories.isPending}
                    onChange={value =>
                      form.setField('primaryCategoryCode', value)
                    }
                    testID="business-category"
                  />
                  <SelectField
                    label={t('business.employees')}
                    value={values.employeesBucket}
                    options={bucketOptions(
                      EMPLOYEE_BUCKETS,
                      values.employeesBucket,
                    )}
                    clearable
                    onChange={value => form.setField('employeesBucket', value)}
                  />
                  <SelectField
                    label={t('business.turnover')}
                    value={values.turnoverBucket}
                    options={bucketOptions(
                      TURNOVER_BUCKETS,
                      values.turnoverBucket,
                    )}
                    clearable
                    onChange={value => form.setField('turnoverBucket', value)}
                  />
                  <Field
                    label={t('business.facility')}
                    value={values.factorySize}
                    onChangeText={value => form.setField('factorySize', value)}
                    maxLength={100}
                    error={shown('factorySize')}
                  />
                  <TextArea
                    label={t('business.description')}
                    value={values.description}
                    onChangeText={value => form.setField('description', value)}
                    max={4000}
                    rows={4}
                    counterFrom={3500}
                    error={shown('description')}
                  />
                </FormSection>

                <FormSection
                  title={t('business.section.more')}
                  description={t('business.section.moreHint')}
                >
                  <MultiSelectField
                    label={t('business.secondary')}
                    values={values.secondaryCategoryCodes}
                    options={categoryOptions}
                    onChange={value =>
                      form.setField('secondaryCategoryCodes', value)
                    }
                    max={BUSINESS_LIMITS.secondaryCategories}
                    loading={categories.isPending}
                    error={shown('secondaryCategoryCodes')}
                    testID="business-secondary"
                  />
                  <MultiSelectField
                    label={t('business.exportCountries')}
                    values={values.exportCountryCodes}
                    options={countryOptions}
                    onChange={value =>
                      form.setField('exportCountryCodes', value)
                    }
                    max={BUSINESS_LIMITS.exportCountries}
                    loading={countries.isPending}
                    error={shown('exportCountryCodes')}
                    testID="business-export"
                  />
                  <Field
                    label={t('business.certificates')}
                    hint={t('business.certificatesHint', {
                      count: values.certificates.length,
                      max: BUSINESS_LIMITS.certificates,
                    })}
                    value={certificate}
                    onChangeText={setCertificate}
                    maxLength={100}
                    onSubmitEditing={addCertificate}
                    returnKeyType="done"
                    trailing={
                      <InlineLink
                        label={t('form.add')}
                        onPress={addCertificate}
                      />
                    }
                    testID="business-certificate"
                  />
                  <View style={styles.chips}>
                    {values.certificates.map(item => (
                      <Button
                        key={item}
                        label={`${item}  ✕`}
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          form.setField(
                            'certificates',
                            values.certificates.filter(value => value !== item),
                          )
                        }
                      />
                    ))}
                  </View>
                </FormSection>
              </>
            ) : null}

            <Button
              label={t('business.registrations')}
              icon="badge"
              variant="outline"
              onPress={() => navigation.navigate('Registrations')}
              testID="business-registrations"
            />
          </>
        )}
      </LoadGate>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  states: { flexDirection: 'row', gap: spacing.xl },
  stateItem: { gap: spacing.xxs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
