import {
  DOCUMENT_LABELS,
  formatBytes,
  formatFullDate,
  slotActions,
  slotState,
  type CompanyDocumentView,
  type DocumentType,
  type KycChangeRequest,
  type SlotState,
  type StatusTone,
} from '@tradevistar/seller-api';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  colors,
  Icon,
  spacing,
  StatusBadge,
  Text,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';

const SLOT_TONE: Record<SlotState, StatusTone> = {
  missing: 'gray',
  uploaded: 'orange',
  underReview: 'blue',
  verified: 'green',
  rejected: 'red',
  expired: 'red',
  changeRequested: 'blue',
  changeApproved: 'green',
};

export const SLOT_LABEL: Record<SlotState, TranslationKey> = {
  missing: 'doc.state.missing',
  uploaded: 'doc.state.uploaded',
  underReview: 'doc.state.underReview',
  verified: 'doc.state.verified',
  rejected: 'doc.state.rejected',
  expired: 'doc.state.expired',
  changeRequested: 'doc.state.changeRequested',
  changeApproved: 'doc.state.changeApproved',
};

export interface DocumentCardProps {
  type: DocumentType;
  document: CompanyDocumentView | null;
  request: KycChangeRequest | null;
  /** One of the three KYC documents (shows "Required"). */
  required?: boolean;
  onUpload: (type: DocumentType) => void;
  onView: (document: CompanyDocumentView) => void;
  onRemove: (document: CompanyDocumentView) => void;
  onRequestChange: (type: DocumentType) => void;
  testID?: string;
}

/** One document slot (or one uploaded file): its state, its details and the actions that apply. */
export function DocumentCard({
  type,
  document,
  request,
  required = false,
  onUpload,
  onView,
  onRemove,
  onRequestChange,
  testID,
}: DocumentCardProps) {
  const t = useT();
  const state = slotState(document, request);
  const actions = slotActions(state, document);
  const archived = Boolean(document && !document.isActive);
  const title = DOCUMENT_LABELS[type];
  return (
    <Card style={styles.card} testID={testID ?? `doc-${type}`}>
      <View style={styles.head}>
        <Icon
          name={document ? 'description' : 'upload_file'}
          size={22}
          color={colors.secondary}
        />
        <View style={styles.headText}>
          <Text variant="cardTitle">{title}</Text>
          {required ? (
            <Text variant="small" color={colors.textMuted}>
              {t('doc.required')}
            </Text>
          ) : null}
        </View>
        <StatusBadge
          status={archived ? t('doc.state.archived') : t(SLOT_LABEL[state])}
          tone={archived ? 'gray' : SLOT_TONE[state]}
          testID={`${testID ?? `doc-${type}`}-state`}
        />
      </View>

      {document ? (
        <View style={styles.details}>
          <Text variant="meta" numberOfLines={1}>
            {document.fileName} · {formatBytes(document.sizeBytes)}
          </Text>
          {document.documentNumber ? (
            <Text variant="small" color={colors.textMuted}>
              {t('doc.number', { number: document.documentNumber })}
            </Text>
          ) : null}
          {document.label ? (
            <Text variant="small" color={colors.textMuted}>
              {document.label}
            </Text>
          ) : null}
          <Text variant="small" color={colors.textMuted}>
            {t('doc.uploadedBy', {
              name: document.uploadedByName ?? t('doc.you'),
              date: formatFullDate(document.uploadedAt),
            })}
          </Text>
          {document.expiresOn ? (
            <View style={styles.row}>
              <Text variant="small" color={colors.textMuted}>
                {t('doc.expires', { date: formatFullDate(document.expiresOn) })}
              </Text>
              {document.isExpired ? (
                <Badge label={t('doc.expiredBadge')} tone="red" />
              ) : null}
            </View>
          ) : null}
          {document.verificationState === 'REJECTED' &&
          document.rejectionReason ? (
            <Text variant="small" color={colors.error}>
              {t('doc.rejectedWhy', { reason: document.rejectionReason })}
            </Text>
          ) : null}
          {state === 'changeRequested' ? (
            <Text variant="small" color={colors.textMuted}>
              {t('doc.changeRequestedNote')}
            </Text>
          ) : null}
          {state === 'changeApproved' ? (
            <Text variant="small" color={colors.success}>
              {t('doc.changeApprovedNote')}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="meta" color={colors.textMuted}>
          {t('doc.missingHint')}
        </Text>
      )}

      <View style={styles.actions}>
        {document ? (
          <Button
            label={t('doc.view')}
            icon="visibility"
            size="sm"
            variant="outline"
            onPress={() => onView(document)}
            testID={`${testID ?? `doc-${type}`}-view`}
          />
        ) : null}
        {!archived && actions.canUpload ? (
          <Button
            label={
              state === 'changeApproved'
                ? t('doc.uploadNew')
                : document
                ? t('doc.replace')
                : t('doc.upload')
            }
            icon="upload"
            size="sm"
            variant={document ? 'outline' : 'primary'}
            onPress={() => onUpload(type)}
            testID={`${testID ?? `doc-${type}`}-upload`}
          />
        ) : null}
        {!archived && actions.canRequestChange ? (
          <Button
            label={t('doc.requestChange')}
            icon="lock_open"
            size="sm"
            variant="outline"
            onPress={() => onRequestChange(type)}
            testID={`${testID ?? `doc-${type}`}-change`}
          />
        ) : null}
        {document && !archived && actions.canRemove ? (
          <Button
            label={t('form.remove')}
            icon="delete"
            size="sm"
            variant="ghost"
            onPress={() => onRemove(document)}
            testID={`${testID ?? `doc-${type}`}-remove`}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1 },
  details: { gap: spacing.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
