/**
 * "Rate our support", shown on a resolved or closed ticket.
 *
 * - Not rated yet: five stars, an optional comment (up to 1,000 characters) and "Submit rating".
 *   The button stays off until a star is chosen. (The web has stars only; the API takes a comment.)
 * - Rated: the stars and comment as given, with "Change rating" — a new rating replaces the old.
 * - Offline: nothing can be sent, and the card says so instead of failing on submit.
 */
import {
  ApiError,
  checkRating,
  hasRating,
  rateTicket,
  TICKET_LIMITS,
  type SupportTicketDetail,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { track } from '@/core/analytics/analytics';
import { useIsOffline } from '@/core/network/useIsOffline';
import {
  Button,
  Card,
  colors,
  spacing,
  StarRatingDisplay,
  StarRatingInput,
  Text,
  TextArea,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';

const LEVEL: Record<number, TranslationKey> = {
  1: 'support.rate.level.1',
  2: 'support.rate.level.2',
  3: 'support.rate.level.3',
  4: 'support.rate.level.4',
  5: 'support.rate.level.5',
};

export function RateSupportCard({
  ticket,
  onRated,
}: {
  ticket: SupportTicketDetail;
  /** Called with the ticket the API returns, so the thread shows the stored rating. */
  onRated: (detail: SupportTicketDetail) => void;
}) {
  const t = useT();
  const toast = useToast();
  const offline = useIsOffline();
  const given = hasRating(ticket)
    ? {
        stars: ticket.rating as number,
        comment: ticket.ratingComment?.trim() || null,
      }
    : null;
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (given && !editing) {
    return (
      <Card style={styles.card} testID="rate-given">
        <Text variant="cardTitle" accessibilityRole="header">
          {t('support.rate.title')}
        </Text>
        <View style={styles.row}>
          <StarRatingDisplay value={given.stars} />
          <Text variant="bodyStrong" color={colors.secondary}>
            {t('support.rate.given', { stars: given.stars })}
          </Text>
        </View>
        {given.comment ? (
          <Text variant="body" color={colors.onSurfaceVariant}>
            “{given.comment}”
          </Text>
        ) : null}
        <Text variant="small" color={colors.textMuted}>
          {t('support.rate.givenThanks')}
        </Text>
        <Button
          testID="rate-change"
          label={t('support.rate.change')}
          variant="ghost"
          size="sm"
          icon="edit"
          disabled={offline}
          onPress={() => {
            setStars(given.stars);
            setComment(given.comment ?? '');
            setError(null);
            setEditing(true);
          }}
          style={styles.start}
        />
      </Card>
    );
  }

  const submit = async () => {
    const check = checkRating(stars, comment);
    if (!check.ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await rateTicket(
        ticket.id,
        check.value.rating,
        check.value.comment,
      );
      track('ticket_rated', { score: stars });
      onRated(detail);
      setEditing(false);
      setStars(0);
      setComment('');
      toast.show(t('support.rate.thanks'), 'success');
    } catch (failure) {
      // A refusal comes in the server's words (for example, the ticket is not resolved yet).
      setError(
        failure instanceof ApiError &&
          failure.statusCode >= 400 &&
          failure.statusCode < 500 &&
          failure.message
          ? failure.message
          : t('support.rate.failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card} testID="rate-form">
      <Text variant="cardTitle" accessibilityRole="header">
        {t('support.rate.title')}
      </Text>
      <Text variant="meta" color={colors.textMuted}>
        {t('support.rate.prompt')}
      </Text>
      <StarRatingInput
        testID="rate-stars"
        value={stars}
        onChange={setStars}
        disabled={busy}
        groupLabel={t('support.rate.title')}
        starLabel={count => t('support.rate.starA11y', { count })}
      />
      {stars ? (
        <Text
          variant="label"
          color={colors.secondary}
          accessibilityLiveRegion="polite"
        >
          {t(LEVEL[stars] ?? 'support.rate.level.3')}
        </Text>
      ) : (
        <Text variant="small" color={colors.textMuted}>
          {t('support.rate.pickStars')}
        </Text>
      )}
      <TextArea
        testID="rate-comment"
        label={t('support.rate.commentLabel')}
        placeholder={t('support.rate.commentPlaceholder')}
        value={comment}
        onChangeText={setComment}
        max={TICKET_LIMITS.commentMax}
        counterFrom={900}
        rows={3}
        editable={!busy}
      />
      {error ? (
        <Text variant="small" color={colors.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {offline ? (
        <Text variant="small" color={colors.textMuted}>
          {t('support.offlineWrite')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          testID="rate-submit"
          label={t('support.rate.submit')}
          icon="send"
          onPress={() => {
            void submit();
          }}
          loading={busy}
          disabled={stars === 0 || offline}
        />
        {given ? (
          <Button
            testID="rate-cancel"
            label={t('support.rate.cancelChange')}
            variant="ghost"
            onPress={() => {
              setEditing(false);
              setError(null);
            }}
            disabled={busy}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  start: { alignSelf: 'flex-start' },
});
