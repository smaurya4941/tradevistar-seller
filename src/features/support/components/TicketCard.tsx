/**
 * One ticket in a list: its number, subject, status, and when it was raised. A KYC document change
 * ticket also shows how far the change has got.
 */
import {
  formatFullDate,
  kycChangeStageLabel,
  TICKET_STATUS_TONE,
  type SupportTicket,
} from '@tradevistar/seller-api';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Badge,
  colors,
  Icon,
  radii,
  spacing,
  StatusBadge,
  Text,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';

export const STATUS_LABEL: Record<SupportTicket['status'], TranslationKey> = {
  OPEN: 'support.status.OPEN',
  IN_PROGRESS: 'support.status.IN_PROGRESS',
  RESOLVED: 'support.status.RESOLVED',
  CLOSED: 'support.status.CLOSED',
};

export const TicketCard = memo(function TicketCardView({
  ticket,
  onPress,
}: {
  ticket: SupportTicket;
  onPress: (ticket: SupportTicket) => void;
}) {
  const t = useT();
  const status = t(STATUS_LABEL[ticket.status]);
  const date = formatFullDate(ticket.createdAt);
  return (
    <Pressable
      testID={`ticket-${ticket.ticketNumber}`}
      onPress={() => onPress(ticket)}
      accessibilityRole="button"
      accessibilityLabel={`${ticket.ticketNumber}, ${ticket.subject}, ${status}, ${date}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text variant="small" color={colors.textMuted}>
          {ticket.ticketNumber}
        </Text>
        <StatusBadge status={status} tone={TICKET_STATUS_TONE[ticket.status]} />
      </View>
      <Text variant="cardTitle" numberOfLines={2}>
        {ticket.subject}
      </Text>
      {ticket.changeRequest ? (
        <Badge
          icon="description"
          tone="blue"
          label={`${t('support.kycChange')}: ${kycChangeStageLabel(
            ticket.changeRequest.status,
          )}`}
        />
      ) : null}
      <View style={styles.bottom}>
        <Text variant="small" color={colors.textMuted}>
          {t('support.created', { date })}
        </Text>
        <View style={styles.count}>
          <Icon name="chat_bubble" size={14} color={colors.outline} />
          <Text variant="small" color={colors.textMuted}>
            {ticket.messageCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  pressed: { backgroundColor: colors.surfaceContainerLow },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
