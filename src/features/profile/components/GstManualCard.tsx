/**
 * The manual GST path: when the registry has no usable email and mobile for the GSTIN (or OTP is
 * switched off), the seller uploads the GST certificate as a PDF and TradeVistar reviews it. The
 * file goes through the KYC-evidence upload route, which enforces PDF, and is then submitted for
 * review. A failed submit is retried without uploading the file again.
 */
import { useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  DocumentUploadFlow,
  formatFullDate,
  submitGstManualVerification,
  type GstManualVerificationCase,
} from '@tradevistar/seller-api';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { track } from '@/core/analytics/analytics';
import {
  buildPdfFromPages,
  deleteLocalFile,
  deleteLocalFiles,
  pickPdfFile,
  scanPages,
} from '@/core/files/documentCapture';
import { uploadKycEvidence } from '@/core/files/privateUpload';
import { CaptureError, type PickedFile } from '@/core/files/types';
import {
  Banner,
  Button,
  Card,
  colors,
  Icon,
  spacing,
  StatusBadge,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { companyKeys, useScope } from '../data';
import { profileErrorMessage } from '../errors';

export function GstManualCard({
  gstin,
  reason,
  caseQuery,
  onSubmitted,
}: {
  gstin: string;
  reason: 'otpUnavailable' | 'contactUnavailable';
  caseQuery: UseQueryResult<GstManualVerificationCase | null>;
  onSubmitted: () => Promise<void>;
}) {
  const t = useT();
  const toast = useToast();
  const client = useQueryClient();
  const scope = useScope();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flow = useRef<DocumentUploadFlow<
    PickedFile,
    GstManualVerificationCase
  > | null>(null);
  const fileRef = useRef<PickedFile | null>(null);
  fileRef.current = file;

  useEffect(
    () => () => {
      void deleteLocalFile(fileRef.current?.uri);
    },
    [],
  );

  const current = caseQuery.data ?? null;
  // A decision about an older GSTIN does not apply to this one.
  const forThisGstin = current && current.gstin === gstin ? current : null;

  const choose = async (via: 'scan' | 'files') => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      let next: PickedFile | null = null;
      if (via === 'files') {
        next = await pickPdfFile();
      } else {
        const pages = await scanPages(10);
        if (pages.length > 0) {
          try {
            next = await buildPdfFromPages(pages, 'gst-certificate');
          } finally {
            await deleteLocalFiles(pages);
          }
        }
      }
      if (!next) return;
      flow.current = null;
      await deleteLocalFile(file?.uri);
      setFile(next);
    } catch (caught) {
      setError(
        caught instanceof CaptureError
          ? t(`doc.capture.${caught.problem}` as 'doc.capture.unreadable')
          : t('doc.capture.unreadable'),
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!flow.current) {
        flow.current = new DocumentUploadFlow<
          PickedFile,
          GstManualVerificationCase
        >({
          upload: picked =>
            uploadKycEvidence('GST_CERTIFICATE', picked).promise,
          attach: mediaAssetId => submitGstManualVerification({ mediaAssetId }),
        });
      }
      await flow.current.run(file);
      track('gst_manual_submitted', {});
      await deleteLocalFile(file.uri);
      setFile(null);
      flow.current = null;
      await client.invalidateQueries({
        queryKey: [...companyKeys.gstManual, scope],
      });
      await onSubmitted();
      toast.show(t('gst.manual.submitted'), 'success');
    } catch (caught) {
      setError(profileErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const status = forThisGstin?.status;

  return (
    <Card style={styles.card} testID="gst-manual">
      <View style={styles.head}>
        <Icon name="upload_file" size={22} color={colors.secondary} />
        <Text variant="cardTitle" style={styles.flex}>
          {t('gst.manual.title')}
        </Text>
        {status ? (
          <StatusBadge
            status={t(
              `gst.manual.status.${status}` as 'gst.manual.status.PENDING',
            )}
            tone={
              status === 'APPROVED'
                ? 'green'
                : status === 'REJECTED'
                ? 'red'
                : 'blue'
            }
          />
        ) : null}
      </View>
      <Text variant="meta" color={colors.textMuted}>
        {reason === 'otpUnavailable'
          ? t('gst.manual.whyOtpOff')
          : t('gst.manual.whyNoContact')}
      </Text>
      {error ? (
        <Banner tone="red" message={error} testID="gst-manual-error" />
      ) : null}

      {status === 'PENDING' ? (
        <Banner
          tone="blue"
          title={t('gst.manual.pendingTitle')}
          message={t('gst.manual.pending', {
            date: formatFullDate(forThisGstin?.createdAt),
          })}
        />
      ) : null}
      {status === 'APPROVED' ? (
        <Banner tone="green" message={t('gst.manual.approved')} />
      ) : null}
      {status === 'REJECTED' ? (
        <Banner
          tone="red"
          title={t('gst.manual.rejectedTitle')}
          message={forThisGstin?.rejectionReason ?? t('gst.manual.rejected')}
        />
      ) : null}

      {status !== 'PENDING' && status !== 'APPROVED' ? (
        <>
          {file ? (
            <View style={styles.file} testID="gst-manual-file">
              <Icon name="picture_as_pdf" size={22} color={colors.secondary} />
              <Text variant="meta" numberOfLines={1} style={styles.flex}>
                {file.name}
              </Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Button
              label={t('doc.source.scan')}
              icon="document_scanner"
              variant="outline"
              size="sm"
              disabled={busy}
              onPress={() => {
                void choose('scan');
              }}
              testID="gst-manual-scan"
            />
            <Button
              label={t('doc.source.files')}
              icon="picture_as_pdf"
              variant="outline"
              size="sm"
              disabled={busy}
              onPress={() => {
                void choose('files');
              }}
              testID="gst-manual-pick"
            />
          </View>
          <Button
            label={t('gst.manual.submit')}
            onPress={() => {
              void submit();
            }}
            loading={busy}
            disabled={!file || busy}
            testID="gst-manual-submit"
          />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  file: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
