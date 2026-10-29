/**
 * Add a settlement account with live checks (mirrors the web form):
 * - a complete IFSC is checked after 400 ms and fills the bank name and branch;
 * - once the IFSC is verified and the number has been typed twice, identically, the account is
 *   checked after 500 ms and answers with a sealed token;
 * - every answer belongs to the exact input it was for, so a late answer for old input is ignored;
 * - a half-typed or unconfirmed number never triggers a check, so it never spends one;
 * - a service outage still lets the account be added (it is verified before settlements).
 *
 * The account number fields hide their text, disable suggestions and autofill, clear when the
 * seller leaves the screen, never reach a log or analytics, and the screen is capture-protected.
 */
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  addBankAccount,
  BANK_ACCOUNT_TYPE_LABEL,
  BANK_ACCOUNT_TYPES,
  confirmedAccount,
  digitsOnly,
  emptyBankForm,
  normalizeIfscInput,
  validateBankForm,
  type BankAccountType,
  type BankForm,
  type BankVerificationResult,
} from '@tradevistar/seller-api';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import { serverFieldErrors } from '@/core/forms/serverErrors';
import {
  Banner,
  colors,
  Field,
  FormScreen,
  FormSection,
  Icon,
  SecureNumberField,
  SelectField,
  spacing,
  SwitchRow,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { SecureScreen } from './components/SecureScreen';
import { companyKeys } from './data';
import { profileErrorMessage } from './errors';
import { useBankVerification } from './useBankVerification';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function BankAddScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState<BankForm>(emptyBankForm);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof BankForm>(key: K, value: BankForm[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  // Account numbers are wiped the moment the seller leaves this screen.
  useFocusEffect(
    useCallback(
      () => () =>
        setForm(current => ({
          ...current,
          accountNumber: '',
          confirmAccountNumber: '',
        })),
      [],
    ),
  );

  const confirmed = confirmedAccount(
    form.accountNumber,
    form.confirmAccountNumber,
  );
  const onIfsc = useCallback((result: BankVerificationResult) => {
    setForm(current => ({
      ...current,
      bankName: result.bankName ?? current.bankName,
      branch: result.branch ?? current.branch,
    }));
  }, []);
  const verification = useBankVerification(form.ifsc, confirmed, onIfsc);

  const entered =
    form.holderName !== '' || form.accountNumber !== '' || form.ifsc !== '';
  const { allowLeave } = useUnsavedGuard(entered && !saving);
  const errors = validateBankForm(form);
  const shown = (name: keyof typeof errors) =>
    (showErrors ? errors[name] : undefined) ?? serverErrors[name];

  const save = async () => {
    setShowErrors(true);
    setError(null);
    setServerErrors({});
    if (Object.keys(errors).length > 0 || verification.verifying) return;
    setSaving(true);
    try {
      const token = verification.verificationToken ?? undefined;
      const created = await addBankAccount({
        holderName: form.holderName.trim(),
        accountNumber: form.accountNumber,
        confirmAccountNumber: form.confirmAccountNumber,
        ifsc: form.ifsc,
        bankName: form.bankName.trim() || undefined,
        branch: form.branch.trim() || undefined,
        accountType: form.accountType,
        isPrimary: form.useAsSettlement || undefined,
        verificationToken: token,
      });
      const verified = created.status === 'VERIFIED' || Boolean(token);
      track('bank_account_added', { verified });
      if (form.useAsSettlement && created.isPrimary)
        track('bank_primary_set', {});
      await Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.banks }),
        client.invalidateQueries({ queryKey: companyKeys.overview }),
      ]);
      toast.show(
        verified ? t('bank.added.verified') : t('bank.added.pending'),
        'success',
      );
      allowLeave();
      navigation.goBack();
    } catch (caught) {
      setServerErrors(serverFieldErrors(caught));
      setError(profileErrorMessage(caught, t));
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = BANK_ACCOUNT_TYPES.map(value => ({
    value,
    label: BANK_ACCOUNT_TYPE_LABEL[value],
  }));

  return (
    <FormScreen
      dirty={entered}
      saving={saving}
      onSave={() => {
        void save();
      }}
      saveLabel={t('bank.add.save')}
      saveDisabled={verification.verifying}
      testID="screen-bank-add"
    >
      <SecureScreen />
      {error ? (
        <Banner tone="red" message={error} testID="bank-add-error" />
      ) : null}

      <FormSection title={t('bank.add.account')}>
        <Field
          label={t('bank.holder')}
          value={form.holderName}
          onChangeText={value => set('holderName', value)}
          maxLength={150}
          autoCapitalize="words"
          error={shown('holderName')}
          testID="bank-holder"
        />
        <SelectField
          label={t('bank.type')}
          value={form.accountType}
          options={typeOptions}
          onChange={value => set('accountType', value as BankAccountType)}
          testID="bank-type"
        />
        <Field
          label={t('bank.ifsc')}
          value={form.ifsc}
          onChangeText={value => set('ifsc', normalizeIfscInput(value))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={11}
          error={
            shown('ifsc') ??
            (verification.ifscPhase === 'failed'
              ? verification.ifscMessage
              : undefined)
          }
          testID="bank-ifsc"
        />
        <CheckLine
          phase={verification.ifscPhase}
          okLabel={t('bank.ifscVerified')}
          message={verification.ifscMessage}
          testID="ifsc-check"
        />
        <Field
          label={t('bank.bankName')}
          value={form.bankName}
          onChangeText={value => set('bankName', value)}
          editable={verification.ifscPhase !== 'verified'}
          testID="bank-name"
        />
        <Field
          label={t('bank.branch')}
          value={form.branch}
          onChangeText={value => set('branch', value)}
          editable={verification.ifscPhase !== 'verified'}
          testID="bank-branch"
        />
        <SecureNumberField
          label={t('bank.number')}
          value={form.accountNumber}
          onChangeText={value => set('accountNumber', digitsOnly(value))}
          maxLength={18}
          error={shown('accountNumber')}
          testID="bank-number"
        />
        <SecureNumberField
          label={t('bank.numberConfirm')}
          value={form.confirmAccountNumber}
          onChangeText={value => set('confirmAccountNumber', digitsOnly(value))}
          maxLength={18}
          error={
            shown('confirmAccountNumber') ?? serverErrors.confirmAccountNumber
          }
          testID="bank-number-confirm"
        />
        <CheckLine
          phase={verification.accountPhase}
          okLabel={t('bank.accountVerified')}
          message={verification.accountMessage}
          testID="account-check"
        />
        {verification.accountPhase === 'error' ? (
          <Text variant="small" color={colors.textMuted}>
            {t('bank.checkUnavailableNote')}
          </Text>
        ) : null}
      </FormSection>

      <FormSection>
        <SwitchRow
          label={t('bank.useAsSettlement')}
          description={t('bank.useAsSettlementHint')}
          value={form.useAsSettlement}
          onValueChange={value => set('useAsSettlement', value)}
          testID="bank-settlement"
        />
      </FormSection>
    </FormScreen>
  );
}

function CheckLine({
  phase,
  okLabel,
  message,
  testID,
}: {
  phase: 'idle' | 'verifying' | 'verified' | 'failed' | 'error';
  okLabel: string;
  message: string;
  testID: string;
}) {
  const t = useT();
  if (phase === 'idle') return null;
  const look =
    phase === 'verified'
      ? { icon: 'check_circle', color: colors.success, text: okLabel }
      : phase === 'verifying'
      ? {
          icon: 'hourglass_top',
          color: colors.textMuted,
          text: t('bank.checking'),
        }
      : {
          icon: 'error',
          color: phase === 'error' ? colors.textMuted : colors.error,
          text: message,
        };
  return (
    <View style={styles.check} testID={testID} accessibilityLiveRegion="polite">
      <Icon name={look.icon} size={18} color={look.color} />
      <Text variant="small" color={look.color} style={styles.flex}>
        {look.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
