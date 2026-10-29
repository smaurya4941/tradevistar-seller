/**
 * Account details: how the company appears and can be reached. Account and Business both edit the
 * display name, description, business email, phone and website and share one profile version on
 * the server, so after either saves, both are refetched. A save sends only changed fields.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  CONTACT_METHODS,
  PREFERRED_LANGUAGES,
  TIMEZONES,
  updateAccount,
  validateAccount,
  type AccountErrors,
  type AccountPatch,
  type AccountView,
  type ContactMethod,
} from '@tradevistar/seller-api';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import { serverFieldErrors } from '@/core/forms/serverErrors';
import { useVersionedForm } from '@/core/forms/useVersionedForm';
import { queryKeys } from '@/core/query/queryClient';
import {
  Banner,
  Field,
  FormScreen,
  FormSection,
  InfoRow,
  InlineLink,
  PhoneField,
  SelectField,
  TextArea,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { companyKeys, useAccount, useScope, useUpdatedLabel } from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

interface AccountForm extends Record<string, unknown> {
  displayName: string;
  primaryContactName: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  preferredLanguage: string;
  preferredContactMethod: string;
  timezone: string;
  businessDescription: string;
}

const toForm = (account: AccountView): AccountForm => ({
  displayName: account.displayName ?? '',
  primaryContactName: account.primaryContactName ?? '',
  businessEmail: account.businessEmail ?? '',
  businessPhone: account.businessPhone ?? '',
  website: account.website ?? '',
  preferredLanguage: account.preferredLanguage,
  preferredContactMethod: account.preferredContactMethod,
  timezone: account.timezone,
  businessDescription: account.businessDescription ?? '',
});

export function AccountDetailsScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const scope = useScope();
  const query = useAccount();
  const updated = useUpdatedLabel(query);
  const [showErrors, setShowErrors] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const refetch = useCallback(
    async () => (await query.refetch()).data,
    [query],
  );

  const form = useVersionedForm<AccountView, AccountForm>({
    server: query.data,
    toForm,
    refetch,
    save: (changes, version) =>
      updateAccount({ ...(changes as Partial<AccountPatch>), version }),
    onSaved: saved => {
      client.setQueryData([...companyKeys.account, scope], saved);
      // Account and Business share one profile version: both are stale now.
      void Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.business }),
        client.invalidateQueries({ queryKey: companyKeys.overview }),
        client.invalidateQueries({ queryKey: queryKeys.access }),
      ]);
      toast.show(t('form.saved'), 'success');
    },
  });
  useUnsavedGuard(form.dirty);

  const values = form.form;
  const errors = useMemo(
    () => (values ? validateAccount(values) : {}),
    [values],
  );
  const shown = (name: keyof AccountErrors) =>
    (showErrors ? errors[name] : undefined) ?? fieldErrors[name];

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setFieldErrors({});
    const result = await form.submit();
    if (result === 'failed') setFieldErrors(serverFieldErrors(form.error));
  };

  // A failed save keeps its error in the form hook; field-level reasons land under the inputs.
  React.useEffect(() => {
    if (form.error) setFieldErrors(serverFieldErrors(form.error));
  }, [form.error]);

  const generalError =
    form.error && Object.keys(serverFieldErrors(form.error)).length === 0
      ? profileErrorMessage(form.error, t)
      : null;

  const languages = useMemo(
    () =>
      PREFERRED_LANGUAGES.map(item => ({
        value: item.value,
        label: item.label,
      })),
    [],
  );
  const methods = useMemo(
    () =>
      CONTACT_METHODS.map(item => ({ value: item.value, label: item.label })),
    [],
  );
  const zones = useMemo(() => {
    const list = TIMEZONES.map(item => ({
      value: item.value,
      label: item.label,
    })) as { value: string; label: string }[];
    // Keep a zone the server already holds even when it is not one of the five.
    if (values && !list.some(item => item.value === values.timezone))
      list.push({ value: values.timezone, label: values.timezone });
    return list;
  }, [values]);

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
      testID="screen-account"
    >
      <LoadGate query={query} updatedLabel={updated}>
        {account => (
          <>
            {form.staleNotice ? (
              <Banner
                tone="amber"
                message={t('form.staleReview')}
                testID="stale-notice"
              />
            ) : null}
            {generalError ? <Banner tone="red" message={generalError} /> : null}
            {values ? (
              <>
                <FormSection title={t('account.section.company')}>
                  <Field
                    label={t('account.displayName')}
                    value={values.displayName}
                    onChangeText={value => form.setField('displayName', value)}
                    maxLength={200}
                    error={shown('displayName')}
                    testID="account-name"
                  />
                  <Field
                    label={t('account.contactName')}
                    value={values.primaryContactName}
                    onChangeText={value =>
                      form.setField('primaryContactName', value)
                    }
                    maxLength={150}
                    autoCapitalize="words"
                    error={shown('primaryContactName')}
                  />
                  <TextArea
                    label={t('account.description')}
                    value={values.businessDescription}
                    onChangeText={value =>
                      form.setField('businessDescription', value)
                    }
                    max={4000}
                    rows={4}
                    counterFrom={3500}
                    error={shown('businessDescription')}
                  />
                </FormSection>

                <FormSection title={t('account.section.reach')}>
                  <Field
                    label={t('account.businessEmail')}
                    value={values.businessEmail}
                    onChangeText={value =>
                      form.setField('businessEmail', value)
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={255}
                    error={shown('businessEmail')}
                    testID="account-email"
                  />
                  <PhoneField
                    label={t('account.businessPhone')}
                    value={values.businessPhone}
                    onChangeText={value =>
                      form.setField('businessPhone', value)
                    }
                    error={shown('businessPhone')}
                    testID="account-phone"
                  />
                  <Field
                    label={t('account.website')}
                    value={values.website}
                    onChangeText={value => form.setField('website', value)}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={300}
                    placeholder="https://"
                    error={shown('website')}
                    testID="account-website"
                  />
                </FormSection>

                <FormSection title={t('account.section.preferences')}>
                  <SelectField
                    label={t('account.language')}
                    value={values.preferredLanguage}
                    options={languages}
                    onChange={value =>
                      form.setField('preferredLanguage', value)
                    }
                    error={shown('preferredLanguage')}
                  />
                  <SelectField
                    label={t('account.contactMethod')}
                    value={values.preferredContactMethod}
                    options={methods}
                    onChange={value =>
                      form.setField(
                        'preferredContactMethod',
                        value as ContactMethod,
                      )
                    }
                  />
                  <SelectField
                    label={t('account.timezone')}
                    value={values.timezone}
                    options={zones}
                    onChange={value => form.setField('timezone', value)}
                    error={shown('timezone')}
                  />
                </FormSection>

                <FormSection
                  title={t('account.section.login')}
                  description={t('account.loginHint')}
                >
                  <InfoRow
                    label={t('account.loginEmail')}
                    value={account.emailAddress}
                    trailing={null}
                  />
                  <InfoRow
                    label={t('account.loginMobile')}
                    value={account.mobileNumber}
                  />
                  <InlineLink
                    label={t('account.changeLogin')}
                    onPress={() => navigation.navigate('ContactChange')}
                    testID="account-change-login"
                  />
                  <InlineLink
                    label={t('account.changePassword')}
                    onPress={() => navigation.navigate('ChangePassword')}
                    testID="account-change-password"
                  />
                </FormSection>
              </>
            ) : null}
          </>
        )}
      </LoadGate>
    </FormScreen>
  );
}
