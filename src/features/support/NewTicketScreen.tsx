/**
 * Raise a ticket: a category from the public list, a subject (3–200 characters) and a message
 * (5–5,000), plus the related order when opened from one (Phase 7). The form is kept as a draft
 * while the seller types, so leaving the screen or the app does not lose it, and restored when
 * they come back.
 *
 * The API has no idempotency for creating a ticket, so a retry after a timeout looks for the
 * ticket first (see `TicketCreator`) before sending it again.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  createTicket,
  listTickets,
  TICKET_LIMITS,
  ticketBody,
  validateTicket,
  type TicketField,
  type TicketFieldError,
} from '@tradevistar/seller-api';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { logger } from '@/core/logger';
import { useIsOffline } from '@/core/network/useIsOffline';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChoiceRow,
  colors,
  EmptyState,
  Field,
  SectionTitle,
  Skeleton,
  spacing,
  Text,
  TextArea,
  useToast,
} from '@/design';
import { writeFailureMessage } from '@/core/errors/errorMapper';
import { useT, type TranslationKey } from '@/i18n';
import { refreshSupport, useSupportCategories } from './data';
import {
  clearTicketDraft,
  loadTicketDraft,
  saveTicketDraft,
  type StoredTicketDraft,
} from './ticketDraft';
import { TicketCreator } from './writes';

type Nav = NativeStackNavigationProp<SharedScreens>;

const FIELD_ERROR: Record<
  TicketFieldError,
  Record<TicketField, TranslationKey>
> = {
  required: {
    subject: 'support.new.error.subjectRequired',
    category: 'support.new.error.categoryRequired',
    message: 'support.new.error.messageRequired',
  },
  short: {
    subject: 'support.new.error.subjectShort',
    category: 'support.new.error.categoryRequired',
    message: 'support.new.error.messageShort',
  },
  long: {
    subject: 'support.new.error.subjectLong',
    category: 'support.new.error.categoryRequired',
    message: 'support.new.error.messageLong',
  },
};

export function NewTicketScreen() {
  const t = useT();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<SharedScreens, 'NewTicket'>>();
  const offline = useIsOffline();
  const categories = useSupportCategories();
  const orderId = route.params?.orderId;

  const [draft, setDraft] = useState<StoredTicketDraft>(() => {
    const stored = loadTicketDraft();
    const preset = route.params?.category;
    const presetSubject = route.params?.subject;
    const presetMessage = route.params?.message;
    // A prefilled ticket (account closure) replaces an old draft; a bare category only fills a gap.
    if (presetSubject || presetMessage) {
      return {
        subject: presetSubject ?? stored.subject,
        message: presetMessage ?? stored.message,
        category: preset ?? stored.category,
      };
    }
    return preset && !stored.category
      ? { ...stored, category: preset }
      : stored;
  });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const restored = useRef(
    Boolean(draft.subject.trim() || draft.message.trim()),
  );

  // Keep what has been typed: written shortly after each change, and on leaving.
  useEffect(() => {
    const timer = setTimeout(() => saveTicketDraft(draft), 400);
    return () => {
      clearTimeout(timer);
      saveTicketDraft(draft);
    };
  }, [draft]);

  const creator = useMemo(
    () =>
      new TicketCreator({
        create: body => createTicket(body),
        recent: async () => (await listTickets({ page: 1, limit: 20 })).items,
      }),
    [],
  );

  const codes = categories.data?.map(item => item.code);
  const errors = validateTicket({ ...draft, orderId }, codes);
  const show = (field: TicketField): string | null => {
    const error = errors[field];
    if (!error || !submitted) return null;
    return t(FIELD_ERROR[error][field]);
  };

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    const body = ticketBody({ ...draft, orderId }, codes);
    if (!body || busy) return;
    setBusy(true);
    try {
      const ticket = await creator.submit(body);
      clearTicketDraft();
      track('ticket_created', { category: body.category });
      refreshSupport();
      toast.show(
        t('support.new.created', { number: ticket.ticketNumber }),
        'success',
      );
      navigation.replace('TicketThread', { ticketId: ticket.id });
    } catch (error) {
      logger.info('[support] ticket was not created');
      setFailure(writeFailureMessage(error, t('support.new.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="screen-new-ticket"
      >
        {restored.current ? (
          <Banner
            tone="blue"
            icon="edit_note"
            message={t('support.new.restored')}
            actionLabel={t('support.new.discard')}
            onAction={() => {
              clearTicketDraft();
              restored.current = false;
              setDraft({ subject: '', category: '', message: '' });
              setSubmitted(false);
            }}
            testID="ticket-draft-restored"
          />
        ) : null}

        {orderId ? (
          <View style={styles.order}>
            <Badge
              label={t('support.new.relatedOrder')}
              icon="receipt_long"
              tone="blue"
            />
          </View>
        ) : null}

        <View style={styles.group}>
          <SectionTitle>{t('support.new.category')}</SectionTitle>
          {categories.data === undefined ? (
            categories.isError ? (
              <EmptyState
                icon="cloud_off"
                title={t('support.new.categoriesFailed')}
                actionLabel={t('common.tryAgain')}
                onAction={() => {
                  void categories.refetch();
                }}
              />
            ) : (
              <View style={styles.group}>
                <Skeleton height={52} />
                <Skeleton height={52} />
              </View>
            )
          ) : (
            <View style={styles.group}>
              {categories.data.map(category => (
                <ChoiceRow
                  key={category.code}
                  testID={`ticket-category-${category.code}`}
                  label={category.label}
                  selected={draft.category === category.code}
                  onPress={() =>
                    setDraft(d => ({ ...d, category: category.code }))
                  }
                />
              ))}
              {show('category') ? (
                <Text
                  variant="small"
                  color={colors.error}
                  accessibilityRole="alert"
                >
                  {show('category')}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        <Card style={styles.form}>
          <Field
            label={t('support.new.subject')}
            value={draft.subject}
            onChangeText={subject => setDraft(d => ({ ...d, subject }))}
            error={show('subject')}
            maxLength={TICKET_LIMITS.subjectMax}
            placeholder={t('support.new.subjectPlaceholder')}
            returnKeyType="next"
            testID="ticket-subject"
          />
          <TextArea
            label={t('support.new.message')}
            value={draft.message}
            onChangeText={message => setDraft(d => ({ ...d, message }))}
            error={show('message')}
            hint={t('support.new.messageHint')}
            max={TICKET_LIMITS.messageMax}
            counterFrom={TICKET_LIMITS.counterFrom}
            rows={6}
            placeholder={t('support.new.messagePlaceholder')}
            testID="ticket-message"
          />
          <Text variant="small" color={colors.textMuted}>
            {t('support.new.noAttachments')}
          </Text>
        </Card>

        {failure ? (
          <Banner
            tone="red"
            icon="error"
            message={failure}
            testID="ticket-failure"
          />
        ) : null}
        {offline ? (
          <Banner
            tone="amber"
            icon="cloud_off"
            message={t('support.offlineWrite')}
          />
        ) : null}

        <Button
          label={t('support.new.submit')}
          icon="send"
          loading={busy}
          disabled={offline}
          onPress={() => {
            void submit();
          }}
          testID="ticket-submit"
        />
      </ScrollView>
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
  group: { gap: spacing.sm },
  form: { gap: spacing.lg },
  order: { flexDirection: 'row' },
});
