/**
 * GST and tax. A full valid GSTIN fills the state code, the state and (when empty) the PAN. Saves
 * send only the changed fields and the tax version; once the GST details are verified, changing
 * the GSTIN, registration type, names, state or PAN asks first ("Replace verified GST details?")
 * and sends `confirmVerifiedChange`. The server can ask too, with its own list of fields.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  fieldsFromConfirmationError,
  GST_REGISTRATION_LABELS,
  GST_STATE_OPTIONS,
  GST_STATES,
  gstinAutofill,
  normalizeGstin,
  normalizePan,
  protectedFieldsChanged,
  TAX_FIELD_LABELS,
  updateTaxDetail,
  validateTaxForm,
  type GstRegistrationType,
  type TaxDetailView,
  type TaxFormValues,
  type TaxPatch,
} from '@tradevistar/seller-api';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import { useVersionedForm } from '@/core/forms/useVersionedForm';
import { serverFieldErrors } from '@/core/forms/serverErrors';
import { queryKeys } from '@/core/query/queryClient';
import {
  Banner,
  ConfirmDialog,
  DateField,
  Field,
  FormScreen,
  FormSection,
  InfoRow,
  InlineLink,
  SelectField,
  SwitchRow,
  Text,
  spacing,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { GstOwnershipCard } from './components/GstOwnershipCard';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { StateBadge } from './components/StateBadge';
import { companyKeys, useCountries, useScope, useTax } from './data';
import { needsVerifiedConfirmation, profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

interface TaxForm extends Record<string, unknown> {
  gstin: string;
  registrationType: string;
  legalName: string;
  tradeName: string;
  stateName: string;
  stateCode: string;
  pan: string;
  taxIdentificationNumber: string;
  taxResidencyCountryCode: string;
  isTaxExempt: boolean;
  exemptionReason: string;
  exemptionCertNumber: string;
  exemptionValidUntil: string;
  exportsUnderLut: boolean;
  lutNumber: string;
  lutValidUntil: string;
}

const dateOnly = (value: string | null) => (value ? value.slice(0, 10) : '');

const toForm = (tax: TaxDetailView): TaxForm => ({
  gstin: tax.gstin ?? '',
  registrationType: tax.registrationType ?? '',
  legalName: tax.legalName ?? '',
  tradeName: tax.tradeName ?? '',
  stateName: tax.stateName ?? '',
  stateCode: tax.stateCode ?? '',
  pan: tax.pan ?? '',
  taxIdentificationNumber: tax.taxIdentificationNumber ?? '',
  taxResidencyCountryCode: tax.taxResidencyCountryCode || 'IN',
  isTaxExempt: tax.isTaxExempt,
  exemptionReason: tax.exemptionReason ?? '',
  exemptionCertNumber: tax.exemptionCertNumber ?? '',
  exemptionValidUntil: dateOnly(tax.exemptionValidUntil),
  exportsUnderLut: tax.exportsUnderLut,
  lutNumber: tax.lutNumber ?? '',
  lutValidUntil: dateOnly(tax.lutValidUntil),
});

export function TaxGstScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const scope = useScope();
  const query = useTax();
  const countries = useCountries();
  const [confirmFields, setConfirmFields] = useState<string[] | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);

  const refetch = useCallback(
    async () => (await query.refetch()).data,
    [query],
  );
  const confirmNext = React.useRef(false);

  const form = useVersionedForm<TaxDetailView, TaxForm>({
    server: query.data,
    toForm,
    refetch,
    save: (changes, version) => {
      const body = { ...changes, version } as TaxPatch;
      if (confirmNext.current) body.confirmVerifiedChange = true;
      return updateTaxDetail(body);
    },
    onSaved: saved => {
      client.setQueryData([...companyKeys.tax, scope], saved);
      void Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.tax }),
        client.invalidateQueries({ queryKey: companyKeys.taxHistory }),
        client.invalidateQueries({ queryKey: companyKeys.overview }),
        client.invalidateQueries({ queryKey: companyKeys.gst }),
        client.invalidateQueries({ queryKey: queryKeys.access }),
      ]);
      toast.show(t('form.saved'), 'success');
    },
  });
  useUnsavedGuard(form.dirty);

  const values = form.form;
  const validation = useMemo(
    () =>
      values
        ? validateTaxForm({
            gstin: values.gstin,
            pan: values.pan,
            stateCode: values.stateCode,
            taxIdentificationNumber: values.taxIdentificationNumber,
            taxResidencyCountryCode: values.taxResidencyCountryCode,
            exemptionReason: values.exemptionReason,
            isTaxExempt: values.isTaxExempt,
            exportsUnderLut: values.exportsUnderLut,
            lutNumber: values.lutNumber,
            exemptionCertNumber: values.exemptionCertNumber,
          } satisfies TaxFormValues)
        : {},
    [values],
  );
  const invalid = Object.keys(validation).length > 0;

  const countryOptions = useMemo(
    () =>
      (countries.data ?? []).map(country => ({
        value: country.code,
        label: `${country.name} (${country.code})`,
      })),
    [countries.data],
  );
  const registrationOptions = useMemo(
    () =>
      (Object.keys(GST_REGISTRATION_LABELS) as GstRegistrationType[]).map(
        value => ({
          value,
          label: GST_REGISTRATION_LABELS[value],
        }),
      ),
    [],
  );
  const stateOptions = useMemo(
    () =>
      GST_STATE_OPTIONS.map(option => ({
        value: option.code,
        label: `${option.name} (${option.code})`,
      })),
    [],
  );

  const setGstin = (raw: string) => {
    const next = normalizeGstin(raw);
    form.setField('gstin', next);
    const fill = gstinAutofill(next, values?.pan);
    if (fill) {
      form.setField('stateCode', fill.stateCode);
      form.setField('stateName', fill.stateName);
      if (fill.pan) form.setField('pan', fill.pan);
    }
  };

  const attemptSave = async (confirmed = false) => {
    if (!query.data) return;
    setShowErrors(true);
    if (invalid) return;
    setFieldErrors({});
    const protectedChanged = protectedFieldsChanged(
      query.data.verificationState,
      form.changes as Partial<TaxPatch>,
    );
    if (protectedChanged.length > 0 && !confirmed) {
      setConfirmFields(protectedChanged.map(field => TAX_FIELD_LABELS[field]));
      return;
    }
    confirmNext.current = confirmed;
    await form.submit();
    confirmNext.current = false;
  };

  // The save result lands in form.error; read it after the render that follows.
  const error = form.error;
  React.useEffect(() => {
    if (!error) return;
    if (needsVerifiedConfirmation(error)) {
      const fromServer =
        error instanceof ApiError
          ? fieldsFromConfirmationError(error.details)
          : [];
      setConfirmFields(
        fromServer.length > 0
          ? fromServer.map(
              field =>
                TAX_FIELD_LABELS[field as keyof typeof TAX_FIELD_LABELS] ??
                field,
            )
          : [t('tax.confirm.fallback')],
      );
      form.clearError();
      return;
    }
    setFieldErrors(serverFieldErrors(error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const shown = (name: keyof TaxFormValues) =>
    (showErrors ? validation[name] : undefined) ?? fieldErrors[name];

  const generalError =
    form.error &&
    !needsVerifiedConfirmation(form.error) &&
    Object.keys(fieldErrors).length === 0
      ? profileErrorMessage(form.error, t)
      : null;

  return (
    <>
      <FormScreen
        dirty={form.dirty}
        saving={form.saving}
        onSave={() => {
          void attemptSave();
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching && !query.isPending}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
        testID="screen-tax-gst"
      >
        <SecureScreen />
        <LoadGate query={query}>
          {data => (
            <>
              {form.staleNotice ? (
                <Banner
                  tone="amber"
                  message={t('form.staleReview')}
                  testID="stale-notice"
                />
              ) : null}
              {generalError ? (
                <Banner tone="red" message={generalError} />
              ) : null}
              {data.verificationState === 'REJECTED' ? (
                <Banner
                  tone="red"
                  title={t('tax.rejectedTitle')}
                  message={data.rejectionReason ?? t('tax.rejected')}
                  testID="tax-rejected"
                />
              ) : null}

              <FormSection title={t('tax.status')}>
                <View style={styles.statusRow}>
                  <Text variant="body">{t('tax.verification')}</Text>
                  <StateBadge
                    state={data.verificationState}
                    testID="tax-state"
                  />
                </View>
                <InlineLink
                  label={t('tax.history.open')}
                  onPress={() => navigation.navigate('TaxHistory')}
                  testID="tax-history-link"
                />
              </FormSection>

              {values ? (
                <>
                  <FormSection title={t('tax.section.gst')}>
                    <Field
                      label={t('tax.gstin')}
                      value={values.gstin}
                      onChangeText={setGstin}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={15}
                      error={shown('gstin')}
                      hint={t('tax.gstin.hint')}
                      testID="tax-gstin"
                    />
                    <SelectField
                      label={t('tax.registrationType')}
                      value={values.registrationType}
                      options={registrationOptions}
                      onChange={value =>
                        form.setField('registrationType', value)
                      }
                      clearable
                      testID="tax-regtype"
                    />
                    <Field
                      label={t('tax.legalName')}
                      value={values.legalName}
                      onChangeText={value => form.setField('legalName', value)}
                      maxLength={200}
                      error={fieldErrors.legalName}
                    />
                    <Field
                      label={t('tax.tradeName')}
                      value={values.tradeName}
                      onChangeText={value => form.setField('tradeName', value)}
                      maxLength={200}
                      error={fieldErrors.tradeName}
                    />
                    <SelectField
                      label={t('tax.state')}
                      value={values.stateCode}
                      options={stateOptions}
                      searchable
                      clearable
                      onChange={value => {
                        form.setField('stateCode', value);
                        form.setField(
                          'stateName',
                          value ? GST_STATES[value] ?? '' : '',
                        );
                      }}
                      error={shown('stateCode')}
                      testID="tax-state-select"
                    />
                    <Field
                      label={t('tax.pan')}
                      value={values.pan}
                      onChangeText={value =>
                        form.setField('pan', normalizePan(value))
                      }
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={10}
                      error={shown('pan')}
                      testID="tax-pan"
                    />
                    <InfoRow
                      label={t('tax.defaultRate')}
                      value={
                        data.defaultTaxRate
                          ? `${data.defaultTaxRate.ratePercent}% ${data.defaultTaxRate.taxType}`
                          : null
                      }
                    />
                  </FormSection>

                  <FormSection
                    title={t('tax.section.foreign')}
                    description={t('tax.section.foreignHint')}
                  >
                    <SelectField
                      label={t('tax.residency')}
                      value={values.taxResidencyCountryCode}
                      options={countryOptions}
                      searchable
                      loading={countries.isPending}
                      onChange={value =>
                        form.setField('taxResidencyCountryCode', value)
                      }
                      error={shown('taxResidencyCountryCode')}
                    />
                    <Field
                      label={t('tax.foreignId')}
                      value={values.taxIdentificationNumber}
                      onChangeText={value =>
                        form.setField('taxIdentificationNumber', value)
                      }
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={50}
                      error={shown('taxIdentificationNumber')}
                    />
                  </FormSection>

                  <FormSection title={t('tax.section.exemption')}>
                    <SwitchRow
                      label={t('tax.exempt')}
                      value={values.isTaxExempt}
                      onValueChange={value =>
                        form.setField('isTaxExempt', value)
                      }
                      testID="tax-exempt"
                    />
                    {values.isTaxExempt ? (
                      <>
                        <Field
                          label={t('tax.exemptReason')}
                          value={values.exemptionReason}
                          onChangeText={value =>
                            form.setField('exemptionReason', value)
                          }
                          maxLength={500}
                          error={shown('exemptionReason')}
                        />
                        <Field
                          label={t('tax.exemptCert')}
                          value={values.exemptionCertNumber}
                          onChangeText={value =>
                            form.setField('exemptionCertNumber', value)
                          }
                          maxLength={100}
                          error={shown('exemptionCertNumber')}
                        />
                        <DateField
                          label={t('tax.validUntil')}
                          value={values.exemptionValidUntil}
                          onChangeText={value =>
                            form.setField('exemptionValidUntil', value)
                          }
                          shortcuts={false}
                          error={fieldErrors.exemptionValidUntil}
                        />
                      </>
                    ) : null}
                  </FormSection>

                  <FormSection title={t('tax.section.exports')}>
                    <SwitchRow
                      label={t('tax.lut')}
                      description={t('tax.lutHint')}
                      value={values.exportsUnderLut}
                      onValueChange={value =>
                        form.setField('exportsUnderLut', value)
                      }
                      testID="tax-lut"
                    />
                    {values.exportsUnderLut ? (
                      <>
                        <Field
                          label={t('tax.lutNumber')}
                          value={values.lutNumber}
                          onChangeText={value =>
                            form.setField('lutNumber', value)
                          }
                          maxLength={100}
                          error={shown('lutNumber')}
                        />
                        <DateField
                          label={t('tax.validUntil')}
                          value={values.lutValidUntil}
                          onChangeText={value =>
                            form.setField('lutValidUntil', value)
                          }
                          shortcuts={false}
                          error={fieldErrors.lutValidUntil}
                        />
                      </>
                    ) : null}
                  </FormSection>
                </>
              ) : null}

              <GstOwnershipCard tax={data} hasUnsavedEdits={form.dirty} />
            </>
          )}
        </LoadGate>
      </FormScreen>

      <ConfirmDialog
        visible={confirmFields !== null}
        title={t('tax.confirm.title')}
        message={t('tax.confirm.body', {
          fields: (confirmFields ?? []).join(', '),
        })}
        confirmLabel={t('tax.confirm.replace')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setConfirmFields(null);
          void attemptSave(true);
        }}
        onCancel={() => setConfirmFields(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
