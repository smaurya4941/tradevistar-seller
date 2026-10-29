/**
 * A ticket's thread: the messages as bubbles marked "You" or "TradeVistar Support", status changes
 * between them, a reply box (2–5,000 characters), Close with a confirmation, and — once resolved
 * or closed — the rating card. A closed ticket cannot be replied to; the screen offers a new one.
 *
 * The thread refreshes when the socket reports a support event and every 30 seconds while open.
 * Replies have no idempotency on the API, so a retry after a lost answer checks the thread first.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  allowedActions,
  canRateTicket,
  checkReply,
  closeTicket,
  formatDateTime,
  getTicket,
  kycChangeStageLabel,
  replyToTicket,
  TICKET_LIMITS,
  TICKET_STATUS_TONE,
  ticketTimeline,
  type SupportTicketDetail,
  type TicketEventKind,
  type TicketFieldError,
} from '@tradevistar/seller-api';
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { openRoute } from '@/app/navigation/openHref';
import { track } from '@/core/analytics/analytics';
import { writeFailureMessage } from '@/core/errors/errorMapper';
import { useIsOffline } from '@/core/network/useIsOffline';
import {
  Badge,
  Banner,
  Button,
  Card,
  colors,
  ConfirmDialog,
  EmptyState,
  radii,
  Skeleton,
  spacing,
  StatusBadge,
  Text,
  TextArea,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { RateSupportCard } from './components/RateSupportCard';
import { STATUS_LABEL } from './components/TicketCard';
import { refreshSupport, supportKeys, useTicket } from './data';
import { ReplySender } from './writes';

type Nav = NativeStackNavigationProp<SharedScreens>;

const EVENT_LABEL: Record<
  Exclude<TicketEventKind, 'created'>,
  TranslationKey
> = {
  open: 'support.event.open',
  inProgress: 'support.event.inProgress',
  resolved: 'support.event.resolved',
  closed: 'support.event.closed',
  closedByYou: 'support.event.closedByYou',
};

const REPLY_ERROR: Record<TicketFieldError, TranslationKey> = {
  required: 'support.reply.error.required',
  short: 'support.reply.error.short',
  long: 'support.reply.error.long',
};

export function TicketThreadScreen() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<SharedScreens, 'TicketThread'>>();
  const { ticketId } = route.params;
  const offline = useIsOffline();
  const ticket = useTicket(ticketId);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sender = useMemo(
    () =>
      new ReplySender({
        reply: (id, body) => replyToTicket(id, body),
        thread: id => getTicket(id),
      }),
    [],
  );

  const detail = ticket.data;
  const timeline = useMemo(
    () => (detail ? ticketTimeline(detail) : []),
    [detail],
  );

  /** Puts the server's answer in the cache so the thread updates before the next refetch. */
  const store = (next: SupportTicketDetail) => {
    queryClient.setQueriesData(
      { queryKey: supportKeys.ticket(ticketId) },
      next,
    );
    refreshSupport();
  };

  if (detail === undefined) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {ticket.isError ? (
          <EmptyState
            icon="cloud_off"
            title={t('support.thread.loadFailed')}
            actionLabel={t('common.tryAgain')}
            onAction={() => {
              void ticket.refetch();
            }}
          />
        ) : (
          <View style={styles.stack} testID="thread-loading">
            <Skeleton height={96} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        )}
      </ScrollView>
    );
  }

  const actions = allowedActions(detail);
  const statusLabel = t(STATUS_LABEL[detail.status]);

  const send = async () => {
    const check = checkReply(reply);
    if (!check.ok) {
      setReplyError(t(REPLY_ERROR[check.reason]));
      return;
    }
    setReplyError(null);
    setSending(true);
    try {
      const next = await sender.send(ticketId, check.value);
      store(next);
      setReply('');
      track('ticket_replied', {});
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      setReplyError(writeFailureMessage(error, t('support.reply.failed')));
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    setClosing(true);
    try {
      store(await closeTicket(ticketId));
      toast.show(t('support.close.done'), 'success');
    } catch (error) {
      toast.show(
        writeFailureMessage(error, t('support.close.failed')),
        'error',
      );
    } finally {
      setClosing(false);
      setConfirmClose(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scroller}
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void ticket.refetch().finally(() => setRefreshing(false));
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        testID="screen-ticket-thread"
      >
        <Card style={styles.summary} testID="thread-summary">
          <View style={styles.summaryTop}>
            <Text variant="small" color={colors.textMuted}>
              {detail.ticketNumber}
            </Text>
            <StatusBadge
              status={statusLabel}
              tone={TICKET_STATUS_TONE[detail.status]}
              testID="thread-status"
            />
          </View>
          <Text variant="h3" accessibilityRole="header">
            {detail.subject}
          </Text>
          {detail.orderNumber ? (
            <Badge
              label={t('support.thread.order', { number: detail.orderNumber })}
              tone="blue"
              icon="receipt_long"
            />
          ) : null}
          {detail.changeRequest ? (
            <View style={styles.stack}>
              <Badge
                tone="blue"
                icon="description"
                label={`${t('support.kycChange')}: ${kycChangeStageLabel(
                  detail.changeRequest.status,
                )}`}
              />
              <Button
                label={t('support.kycChange.open')}
                variant="outline"
                size="sm"
                onPress={() =>
                  openRoute({
                    name: 'Shared',
                    params: { screen: 'Documents' },
                  })
                }
                testID="thread-open-documents"
              />
            </View>
          ) : null}
        </Card>

        <View style={styles.stack} testID="thread-messages">
          {timeline.map(item =>
            item.kind === 'message' ? (
              <View
                key={item.key}
                style={[
                  styles.bubbleRow,
                  item.message.fromSupport ? styles.left : styles.right,
                ]}
                testID={`message-${item.message.id}`}
              >
                <View
                  style={[
                    styles.bubble,
                    item.message.fromSupport ? styles.support : styles.mine,
                  ]}
                  accessible
                  accessibilityLabel={`${
                    item.message.fromSupport
                      ? t('support.thread.supportName')
                      : t('support.thread.you')
                  }, ${formatDateTime(item.message.createdAt)}. ${
                    item.message.body
                  }`}
                >
                  <Text
                    variant="badge"
                    color={
                      item.message.fromSupport
                        ? colors.secondary
                        : colors.onSecondary
                    }
                  >
                    {item.message.fromSupport
                      ? t('support.thread.supportName')
                      : t('support.thread.you')}
                  </Text>
                  <Text
                    variant="body"
                    color={
                      item.message.fromSupport
                        ? colors.onSurface
                        : colors.onSecondary
                    }
                    selectable
                  >
                    {item.message.body}
                  </Text>
                  <Text
                    variant="small"
                    color={
                      item.message.fromSupport
                        ? colors.textMuted
                        : colors.onSecondary
                    }
                  >
                    {formatDateTime(item.message.createdAt)}
                  </Text>
                </View>
              </View>
            ) : (
              <View
                key={item.key}
                style={styles.event}
                testID={`event-${item.key}`}
              >
                <Text variant="small" color={colors.textMuted} align="center">
                  {t(
                    EVENT_LABEL[
                      item.event as Exclude<TicketEventKind, 'created'>
                    ],
                  )}
                  {' · '}
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
            ),
          )}
        </View>

        {canRateTicket(detail) ? (
          <RateSupportCard ticket={detail} onRated={store} />
        ) : null}

        {actions.reply ? (
          <Card style={styles.composer} testID="thread-composer">
            <TextArea
              label={t('support.reply.label')}
              value={reply}
              onChangeText={value => {
                setReply(value);
                if (replyError) setReplyError(null);
              }}
              error={replyError}
              max={TICKET_LIMITS.replyMax}
              counterFrom={TICKET_LIMITS.counterFrom}
              rows={4}
              placeholder={t('support.reply.placeholder')}
              testID="thread-reply"
            />
            {offline ? (
              <Banner
                tone="amber"
                icon="cloud_off"
                message={t('support.offlineWrite')}
              />
            ) : null}
            <View style={styles.actions}>
              <Button
                label={t('support.reply.send')}
                icon="send"
                loading={sending}
                disabled={offline}
                onPress={() => {
                  void send();
                }}
                testID="thread-send"
              />
              {actions.close ? (
                <Button
                  label={t('support.close.cta')}
                  variant="outline"
                  disabled={offline || sending}
                  onPress={() => setConfirmClose(true)}
                  testID="thread-close"
                />
              ) : null}
            </View>
          </Card>
        ) : null}

        {actions.raiseNew ? (
          <Card style={styles.stack} testID="thread-closed-note">
            <Text variant="body" color={colors.textMuted}>
              {t('support.thread.closedNote')}
            </Text>
            <Button
              label={t('support.new.cta')}
              icon="add"
              variant="outline"
              onPress={() => navigation.navigate('NewTicket')}
              testID="thread-raise-new"
            />
          </Card>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirmClose}
        title={t('support.close.title')}
        message={t('support.close.body')}
        confirmLabel={t('support.close.confirm')}
        cancelLabel={t('common.cancel')}
        loading={closing}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          void close();
        }}
        testID="thread-close-dialog"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  stack: { gap: spacing.md },
  summary: { gap: spacing.sm },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bubbleRow: { flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '88%',
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  support: { backgroundColor: colors.surfaceContainer },
  mine: { backgroundColor: colors.secondary },
  event: { paddingVertical: spacing.xs },
  composer: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
