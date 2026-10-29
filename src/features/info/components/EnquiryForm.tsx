/**
 * The contact form on a footer page that has one (Contact Us, Contact Expert). Messages land in
 * Admin → Footer → Enquiries.
 *
 * - A signed-in buyer starts with their name, email, phone and company filled in.
 * - Fields are checked against the API's own rules; errors show after the first send attempt and
 *   clear as the buyer fixes them.
 * - Sending is retried safely: while the form is unchanged and the last attempt may have reached
 *   the server (no connection, a server error), the same idempotency key is reused, so one message
 *   cannot arrive twice. A refusal (4xx, including the 5-a-minute limit) starts fresh and shows the
 *   server's own words.
 */
import {
  ApiError,
  ENQUIRY_LIMITS,
  enquiryBody,
  enquiryPrefill,
  errorMessage,
  newIdempotencyKey,
  sendFooterEnquiry,
  validateEnquiry,
  type EnquiryField,
  type EnquiryForm as EnquiryValues,
} from '@tradevistar/seller-api';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { track } from '@/core/analytics/analytics';
import {
  Button,
  Card,
  colors,
  Field,
  Icon,
  spacing,
  Text,
  TextArea,
  tones,
} from '@/design';
import { useSession } from '@/core/auth/SessionProvider';
import { useIsOffline } from '@/core/network/useIsOffline';
import { useT, type TranslationKey } from '@/i18n';

const ERROR_KEY: Record<string, TranslationKey> = {
  nameInvalid: 'enq.err.nameInvalid',
  emailInvalid: 'enq.err.emailInvalid',
  phoneInvalid: 'enq.err.phoneInvalid',
  companyLong: 'enq.err.companyLong',
  messageShort: 'enq.err.messageShort',
  messageLong: 'enq.err.messageLong',
};

export function EnquiryForm({ pageSlug }: { pageSlug: string }) {
  const t = useT();
  const session = useSession();
  const user =
    session.status === 'signedIn' || session.status === 'offline'
      ? session.user
      : null;
  const canEdit = !useIsOffline();
  const initial = useMemo(() => enquiryPrefill(user), [user]);
  const [values, setValues] = useState<EnquiryValues>(initial);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ body: string; key: string } | null>(null);

  const errors = tried ? validateEnquiry(values) : {};
  const errorFor = (field: EnquiryField) => {
    const code = errors[field];
    return code ? t(ERROR_KEY[code]) : null;
  };
  const set = (field: EnquiryField) => (text: string) => {
    setValues(current => ({ ...current, [field]: text }));
    setFailure(null);
  };

  const send = async () => {
    setTried(true);
    setFailure(null);
    const body = enquiryBody(pageSlug, values);
    if (!body || sending || !canEdit) return;
    const signature = JSON.stringify(body);
    const key =
      attempt.current?.body === signature
        ? attempt.current.key
        : newIdempotencyKey();
    attempt.current = { body: signature, key };
    setSending(true);
    try {
      await sendFooterEnquiry(body, key);
      track('contact_form_sent', {});
      attempt.current = null;
      setSent(true);
      setTried(false);
      setValues(enquiryPrefill(user));
    } catch (error) {
      const refused =
        error instanceof ApiError &&
        error.statusCode >= 400 &&
        error.statusCode < 500;
      if (refused) attempt.current = null;
      setFailure(
        refused ? errorMessage(error, t('enq.failed')) : t('enq.failed'),
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Card style={[styles.card, styles.done]} testID="enquiry-sent">
        <Icon name="check_circle" size={40} color={tones.green.foreground} />
        <Text variant="bodyStrong" align="center" color={colors.secondary}>
          {t('enq.sent')}
        </Text>
        <Button
          testID="enquiry-send-another"
          label={t('enq.sendAnother')}
          variant="ghost"
          onPress={() => setSent(false)}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card} testID="enquiry-form">
      <View style={styles.head}>
        <Text variant="cardTitle" accessibilityRole="header">
          {t('enq.title')}
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          {t('enq.subtitle')}
        </Text>
      </View>
      <Field
        testID="enquiry-name"
        label={t('enq.name')}
        value={values.name}
        onChangeText={set('name')}
        error={errorFor('name')}
        maxLength={ENQUIRY_LIMITS.nameMax}
        autoComplete="name"
        textContentType="name"
        editable={!sending}
      />
      <Field
        testID="enquiry-email"
        label={t('enq.email')}
        value={values.email}
        onChangeText={set('email')}
        error={errorFor('email')}
        maxLength={ENQUIRY_LIMITS.emailMax}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        editable={!sending}
      />
      <Field
        testID="enquiry-phone"
        label={t('enq.phone')}
        value={values.phone}
        onChangeText={set('phone')}
        error={errorFor('phone')}
        maxLength={ENQUIRY_LIMITS.phoneMax}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        editable={!sending}
      />
      <Field
        testID="enquiry-company"
        label={t('enq.company')}
        value={values.companyName}
        onChangeText={set('companyName')}
        error={errorFor('companyName')}
        maxLength={ENQUIRY_LIMITS.companyMax}
        autoComplete="organization"
        textContentType="organizationName"
        editable={!sending}
      />
      <TextArea
        testID="enquiry-message"
        label={t('enq.message')}
        placeholder={t('enq.messagePlaceholder')}
        value={values.message}
        onChangeText={set('message')}
        error={errorFor('message')}
        max={ENQUIRY_LIMITS.messageMax}
        counterFrom={ENQUIRY_LIMITS.counterFrom}
        rows={5}
        editable={!sending}
      />
      {failure ? (
        <Text variant="small" color={colors.error} accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
      {!canEdit ? (
        <Text variant="small" color={colors.textMuted}>
          {t('enq.offline')}
        </Text>
      ) : null}
      <Button
        testID="enquiry-send"
        label={t('enq.send')}
        icon="send"
        onPress={() => {
          void send();
        }}
        loading={sending}
        disabled={!canEdit}
        fullWidth
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { gap: spacing.xxs },
  done: { alignItems: 'center' },
});
