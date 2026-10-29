/**
 * "Request change" for a verified document. Verified documents are locked; compliance can unlock
 * one for a single replacement upload. The request (5–1,000 characters) opens a support ticket,
 * which the seller follows in the Support tab.
 */
import {
  DOCUMENT_LABELS,
  requestKycDocumentChange,
  validateChangeReason,
  type DocumentType,
  type KycChangeRequest,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { track } from '@/core/analytics/analytics';
import { BottomSheet, Button, colors, spacing, Text, TextArea } from '@/design';
import { useT } from '@/i18n';
import { profileErrorMessage } from '../errors';

export function KycChangeRequestSheet({
  type,
  onClose,
  onSent,
}: {
  type: DocumentType | null;
  onClose: () => void;
  onSent: (request: KycChangeRequest) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!type || busy) return;
    const problem = validateChangeReason(reason);
    if (problem) {
      setError(t('doc.change.reasonShort'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const request = await requestKycDocumentChange(type, reason.trim());
      track('document_change_requested', {});
      setReason('');
      onSent(request);
    } catch (caught) {
      setError(profileErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={type !== null}
      onClose={close}
      title={t('doc.change.title')}
      scrollable
    >
      <View style={styles.body}>
        <Text variant="body" color={colors.onSurfaceVariant}>
          {t('doc.change.body', {
            document: type ? DOCUMENT_LABELS[type] : '',
          })}
        </Text>
        <TextArea
          label={t('doc.change.reason')}
          value={reason}
          onChangeText={value => {
            setReason(value);
            setError(null);
          }}
          max={1000}
          rows={4}
          error={error}
          testID="change-reason"
        />
        <Button
          label={t('doc.change.send')}
          onPress={submit}
          loading={busy}
          disabled={busy}
          testID="change-send"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, padding: spacing.lg },
});
