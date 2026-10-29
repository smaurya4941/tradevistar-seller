/**
 * Settlement accounts. The list shows each account's state and what it can do; actions are
 * "use for settlements" (only when settlement is enabled), "link automatic payouts" (only when the
 * platform has them and the account is not linked), history and remove. Adding an account is
 * a separate form with live bank checks.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  deleteBankAccount,
  enableAutomaticPayouts,
  setPrimaryBankAccount,
  validateBankAccount,
  type BankAccountView,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import {
  Banner,
  BottomSheet,
  Button,
  colors,
  ConfirmDialog,
  EmptyState,
  SecureNumberField,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { BankCard } from './components/BankCard';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { companyKeys, useBanks, useUpdatedLabel } from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function BankScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const query = useBanks();
  const updated = useUpdatedLabel(query);
  const [removing, setRemoving] = useState<BankAccountView | null>(null);
  const [linking, setLinking] = useState<BankAccountView | null>(null);
  const [number, setNumber] = useState('');
  const [numberError, setNumberError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.banks }),
      client.invalidateQueries({ queryKey: companyKeys.overview }),
    ]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      toast.show(success, 'success');
      return true;
    } catch (error) {
      toast.show(profileErrorMessage(error, t), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const makePrimary = async (account: BankAccountView) => {
    const done = await run(
      () => setPrimaryBankAccount(account.id),
      t('bank.primarySet'),
    );
    if (done) track('bank_primary_set', {});
  };

  const closeLink = () => {
    setLinking(null);
    setNumber('');
    setNumberError(null);
  };

  const link = async () => {
    if (!linking) return;
    if (validateBankAccount(number)) {
      setNumberError(t('bank.number.invalid'));
      return;
    }
    const done = await run(
      () => enableAutomaticPayouts(linking.id, number),
      t('bank.payoutsLinked'),
    );
    if (done) {
      track('bank_payouts_linked', {});
      closeLink();
    }
  };

  const remove = async () => {
    if (!removing) return;
    await run(() => deleteBankAccount(removing.id), t('bank.removed'));
    setRemoving(null);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="screen-bank"
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void refresh();
          }}
        />
      }
    >
      <SecureScreen />
      <LoadGate query={query} updatedLabel={updated}>
        {accounts => (
          <>
            {!accounts.some(account => account.settlementEnabled) ? (
              <Banner
                tone="amber"
                message={t('bank.noSettlement')}
                testID="bank-no-settlement"
              />
            ) : null}
            {accounts.length === 0 ? (
              <EmptyState
                icon="account_balance"
                title={t('bank.emptyTitle')}
                message={t('bank.emptyBody')}
              />
            ) : (
              accounts.map(account => (
                <BankCard
                  key={account.id}
                  account={account}
                  busy={busy}
                  onMakePrimary={makePrimary}
                  onLinkPayouts={setLinking}
                  onHistory={item =>
                    navigation.navigate('BankHistory', { accountId: item.id })
                  }
                  onRemove={setRemoving}
                />
              ))
            )}
            <Button
              label={t('bank.add')}
              icon="add"
              onPress={() => navigation.navigate('BankAdd')}
              testID="bank-add"
            />
          </>
        )}
      </LoadGate>

      <ConfirmDialog
        visible={removing !== null}
        title={t('bank.remove.title')}
        message={t('bank.remove.body', {
          account: removing?.accountNumberMasked ?? '',
        })}
        confirmLabel={t('form.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => {
          void remove();
        }}
        onCancel={() => setRemoving(null)}
      />

      <BottomSheet
        visible={linking !== null}
        onClose={closeLink}
        title={t('bank.link.title')}
        scrollable
      >
        <View style={styles.sheet}>
          <Text variant="body" color={colors.onSurfaceVariant}>
            {t('bank.link.body', {
              bank: linking?.bankName ?? '',
              masked: linking?.accountNumberMasked ?? '',
            })}
          </Text>
          <Text variant="small" color={colors.textMuted}>
            {t('bank.link.privacy')}
          </Text>
          <SecureNumberField
            label={t('bank.number')}
            value={number}
            onChangeText={value => {
              setNumber(value);
              setNumberError(null);
            }}
            maxLength={18}
            error={numberError}
            testID="link-number"
          />
          <Button
            label={t('bank.link.confirm')}
            onPress={() => {
              void link();
            }}
            loading={busy}
            disabled={busy || number.length === 0}
            testID="link-confirm"
          />
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sheet: { gap: spacing.md, padding: spacing.lg },
});
