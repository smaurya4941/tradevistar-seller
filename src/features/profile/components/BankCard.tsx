import {
  BANK_ACCOUNT_TYPE_LABEL,
  BANK_STATUS_LABEL,
  bankActions,
  type BankAccountView,
} from '@tradevistar/seller-api';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Button, Card, colors, Icon, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { StateBadge } from './StateBadge';

export interface BankCardProps {
  account: BankAccountView;
  onMakePrimary: (account: BankAccountView) => void;
  onLinkPayouts: (account: BankAccountView) => void;
  onHistory: (account: BankAccountView) => void;
  onRemove: (account: BankAccountView) => void;
  busy?: boolean;
}

/** One settlement account: its state, what it can do, and the actions that apply to it. */
export function BankCard({
  account,
  onMakePrimary,
  onLinkPayouts,
  onHistory,
  onRemove,
  busy = false,
}: BankCardProps) {
  const t = useT();
  const actions = bankActions(account);
  return (
    <Card style={styles.card} testID={`bank-${account.id}`}>
      <View style={styles.head}>
        <Icon name="account_balance" size={24} color={colors.secondary} />
        <View style={styles.flex}>
          <Text variant="cardTitle">
            {account.bankName ?? t('bank.unknownBank')}
          </Text>
          <Text variant="meta" color={colors.textMuted}>
            {account.accountNumberMasked}
          </Text>
        </View>
        <StateBadge
          state={account.status}
          label={BANK_STATUS_LABEL[account.status]}
          testID={`bank-${account.id}-state`}
        />
      </View>

      <View style={styles.badges}>
        {account.isPrimary ? (
          <Badge label={t('bank.primary')} tone="green" icon="check_circle" />
        ) : null}
        {account.automaticPayoutLinked ? (
          <Badge label={t('bank.payoutsOn')} tone="blue" icon="bolt" />
        ) : null}
        {actions.settlementPending ? (
          <Badge label={t('bank.cannotSettle')} tone="amber" icon="schedule" />
        ) : null}
      </View>

      <View style={styles.details}>
        <Text variant="small" color={colors.textMuted}>
          {account.holderName}
        </Text>
        <Text variant="small" color={colors.textMuted}>
          {t('bank.ifscLine', {
            ifsc: account.ifsc,
            branch: account.branch ?? '—',
          })}
        </Text>
        <Text variant="small" color={colors.textMuted}>
          {BANK_ACCOUNT_TYPE_LABEL[account.accountType]}
        </Text>
        {account.failureReason ? (
          <Text variant="small" color={colors.error}>
            {account.failureReason}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {actions.makePrimary ? (
          <Button
            label={t('bank.makePrimary')}
            size="sm"
            variant="outline"
            disabled={busy}
            onPress={() => onMakePrimary(account)}
            testID={`bank-${account.id}-primary`}
          />
        ) : null}
        {actions.linkPayouts ? (
          <Button
            label={t('bank.linkPayouts')}
            size="sm"
            variant="outline"
            disabled={busy}
            onPress={() => onLinkPayouts(account)}
            testID={`bank-${account.id}-link`}
          />
        ) : null}
        <Button
          label={t('bank.history')}
          size="sm"
          variant="ghost"
          onPress={() => onHistory(account)}
          testID={`bank-${account.id}-history`}
        />
        <Button
          label={t('form.remove')}
          size="sm"
          variant="ghost"
          disabled={busy}
          onPress={() => onRemove(account)}
          testID={`bank-${account.id}-remove`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  details: { gap: spacing.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
