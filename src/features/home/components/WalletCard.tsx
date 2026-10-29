/**
 * The wallet: the withdrawable balance large, then tiles for what is pending, earned and held.
 * Commission shows only while the admin has it switched on. There is no Withdraw button here:
 * withdrawing is a write that needs verified access and a checked bank account (Phase 8).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  formatCompactRupees,
  formatRupees,
  type WalletSummary,
} from '@tradevistar/seller-api';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { openRoute } from '@/app/navigation/openHref';
import { colors, Icon, palette, radii, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { HomeCard } from './HomeCard';

interface Tile {
  key: string;
  label: string;
  amount: number;
  icon: string;
  tint: string;
  background: string;
}

export function WalletCard({
  query,
}: {
  query: UseQueryResult<WalletSummary>;
}) {
  const t = useT();
  return (
    <HomeCard
      title={t('home.wallet.title')}
      query={query}
      skeletonRows={3}
      actionLabel={t('home.wallet.view')}
      actionTestID="wallet-view"
      onAction={() =>
        openRoute({ name: 'Section', params: { sectionId: 'wallet' } })
      }
      testID="wallet-card"
    >
      {wallet => {
        const tiles: Tile[] = [
          {
            key: 'pendingWithdraw',
            label: t('home.wallet.pendingWithdraw'),
            amount: wallet.pendingWithdraw,
            icon: 'schedule',
            tint: palette.amber700,
            background: palette.amber100,
          },
          ...(wallet.commissionEnabled
            ? [
                {
                  key: 'commission',
                  label: t('home.wallet.commission'),
                  amount: wallet.totalCommission,
                  icon: 'percent',
                  tint: palette.blue700,
                  background: palette.blue50,
                },
              ]
            : []),
          {
            key: 'withdrawn',
            label: t('home.wallet.withdrawn'),
            amount: wallet.alreadyWithdrawn,
            icon: 'check_circle',
            tint: palette.green700,
            background: palette.green50,
          },
          {
            key: 'escrow',
            label: t('home.wallet.escrow'),
            amount: wallet.escrowHeld,
            icon: 'local_shipping',
            tint: palette.orange600,
            background: palette.orange50,
          },
          {
            key: 'balance',
            label: t('home.wallet.balance'),
            amount: wallet.walletBalance,
            icon: 'account_balance_wallet',
            tint: colors.secondary,
            background: palette.slate100,
          },
        ];
        return (
          <View style={styles.body}>
            <View
              accessible
              accessibilityLabel={t('home.wallet.withdrawableSpoken', {
                amount: formatRupees(wallet.withdrawableBalance),
              })}
            >
              <Text variant="meta" color={colors.textMuted}>
                {t('home.wallet.withdrawable')}
              </Text>
              <Text
                variant="stat"
                style={styles.big}
                testID="wallet-withdrawable"
              >
                {formatRupees(wallet.withdrawableBalance)}
              </Text>
            </View>
            <View style={styles.grid}>
              {tiles.map(tile => (
                <View
                  key={tile.key}
                  style={styles.tile}
                  accessible
                  accessibilityLabel={`${tile.label}, ${formatRupees(
                    tile.amount,
                  )}`}
                >
                  <View
                    style={[styles.icon, { backgroundColor: tile.background }]}
                  >
                    <Icon name={tile.icon} size={18} color={tile.tint} />
                  </View>
                  <Text
                    variant="small"
                    color={colors.textMuted}
                    numberOfLines={2}
                  >
                    {tile.label}
                  </Text>
                  <Text variant="cardTitle">
                    {formatCompactRupees(tile.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      }}
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  big: { fontSize: 30, lineHeight: 38 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
