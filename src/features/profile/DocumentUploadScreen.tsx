/**
 * Add or replace a document. The seller chooses the type (fixed when opened from a slot), adds an
 * optional number, expiry and label, then captures the file:
 * - Scan with the camera (multi-page),
 * - pick photos from the gallery,
 * - pick a PDF from files.
 * Scans and photos show a page preview with reorder and delete, then become one PDF (≤10 pages,
 * about 5 MB). The upload is two calls — send the file, then attach it — and a failed attach is
 * retried without sending the file again, because every upload counts toward the storage allowance.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  attachDocument,
  DOCUMENT_LABELS,
  DOCUMENT_UPLOAD_LIMITS,
  DocumentUploadFlow,
  documentErrorKind,
  formatBytes,
  movePage,
  OTHER_DOCUMENT_TYPES,
  REQUIRED_KYC_DOCUMENTS,
  removePage,
  sizeBucket,
  validateDocumentFields,
  type DocumentType,
} from '@tradevistar/seller-api';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import {
  buildPdfFromPages,
  deleteLocalFile,
  deleteLocalFiles,
  pickGalleryPages,
  pickPdfFile,
  scanPages,
} from '@/core/files/documentCapture';
import { uploadSellerDocument } from '@/core/files/privateUpload';
import { CaptureError, type PickedFile } from '@/core/files/types';
import { queryKeys } from '@/core/query/queryClient';
import {
  Banner,
  Button,
  Card,
  colors,
  DateField,
  Field,
  FormScreen,
  FormSection,
  Icon,
  radii,
  SelectField,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { SecureScreen } from './components/SecureScreen';
import { companyKeys } from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;
type Source = 'scan' | 'gallery' | 'files';

const CAPTURE_ERROR: Record<string, TranslationKey> = {
  unavailable: 'doc.capture.unavailable',
  unreadable: 'doc.capture.unreadable',
  permission: 'doc.capture.permission',
  type: 'doc.capture.type',
  size: 'doc.capture.size',
};

export function DocumentUploadScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<SharedScreens, 'DocumentUpload'>>();
  const toast = useToast();
  const client = useQueryClient();
  const fixedType = route.params?.type;

  const [type, setType] = useState<DocumentType | ''>(fixedType ?? '');
  const [number, setNumber] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [label, setLabel] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState<'capture' | 'upload' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notClean, setNotClean] = useState(false);
  const [errors, setErrors] = useState<{
    number?: string;
    label?: string;
    expiresOn?: string;
    type?: string;
  }>({});

  // The built PDF is reused by retries; it is rebuilt only when the pages change.
  const built = useRef<PickedFile | null>(null);
  const flow = useRef<DocumentUploadFlow<PickedFile> | null>(null);
  const cancelUpload = useRef<(() => void) | null>(null);
  const pagesRef = useRef<string[]>([]);
  const pdfRef = useRef<PickedFile | null>(null);
  const fieldsRef = useRef({ number, expiresOn, label });
  pagesRef.current = pages;
  pdfRef.current = pdf;
  fieldsRef.current = { number, expiresOn, label };

  const hasFile = pages.length > 0 || pdf !== null;
  const { allowLeave } = useUnsavedGuard(hasFile && busy === null);

  // Scanned images, built PDFs and picked copies never outlive the screen.
  useEffect(
    () => () => {
      cancelUpload.current?.();
      void deleteLocalFiles([
        ...pagesRef.current,
        pdfRef.current?.uri,
        built.current?.uri,
      ]);
    },
    [],
  );

  const typeOptions = useMemo(
    () =>
      [...REQUIRED_KYC_DOCUMENTS, ...OTHER_DOCUMENT_TYPES].map(value => ({
        value,
        label: DOCUMENT_LABELS[value],
      })),
    [],
  );

  const invalidateBuilt = useCallback(async () => {
    flow.current = null;
    if (built.current) {
      await deleteLocalFile(built.current.uri);
      built.current = null;
    }
  }, []);

  const reportCapture = (caught: unknown) => {
    const problem =
      caught instanceof CaptureError ? caught.problem : 'unreadable';
    setError(t(CAPTURE_ERROR[problem] ?? 'doc.capture.unreadable'));
  };

  const capture = async (next: Source) => {
    if (busy) return;
    setError(null);
    setNotClean(false);
    setBusy('capture');
    try {
      if (next === 'files') {
        const picked = await pickPdfFile();
        if (!picked) return;
        await invalidateBuilt();
        await deleteLocalFiles(pages);
        setPages([]);
        if (pdf) await deleteLocalFile(pdf.uri);
        setPdf(picked);
        setSource('files');
        return;
      }
      const room = DOCUMENT_UPLOAD_LIMITS.maxPages - pages.length;
      if (room <= 0) {
        setError(
          t('doc.capture.pageLimit', {
            count: DOCUMENT_UPLOAD_LIMITS.maxPages,
          }),
        );
        return;
      }
      const added =
        next === 'scan' ? await scanPages(room) : await pickGalleryPages(room);
      if (added.length === 0) return;
      await invalidateBuilt();
      if (pdf) {
        await deleteLocalFile(pdf.uri);
        setPdf(null);
      }
      setPages(current =>
        [...current, ...added].slice(0, DOCUMENT_UPLOAD_LIMITS.maxPages),
      );
      setSource(next);
    } catch (caught) {
      reportCapture(caught);
    } finally {
      setBusy(null);
    }
  };

  const changePages = async (next: string[], removedUri?: string) => {
    await invalidateBuilt();
    setPages(next);
    if (removedUri) await deleteLocalFile(removedUri);
    if (next.length === 0) setSource(null);
  };

  const submit = async () => {
    if (busy || !type) {
      if (!type) setErrors({ type: t('doc.upload.typeRequired') });
      return;
    }
    const fieldErrors = validateDocumentFields({ number, label, expiresOn });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors({
        number: fieldErrors.number ? t('form.max100') : undefined,
        label: fieldErrors.label ? t('form.max150') : undefined,
        expiresOn: fieldErrors.expiresOn ? t('form.dateFormat') : undefined,
      });
      return;
    }
    setErrors({});
    setError(null);
    setNotClean(false);
    setBusy('upload');
    setProgress(0);
    try {
      let file = pdf ?? built.current;
      if (!file) {
        file = await buildPdfFromPages(pages, DOCUMENT_LABELS[type]);
        built.current = file;
      }
      const ready = file;
      if (!flow.current) {
        track('document_upload_started', { type, source: source ?? 'files' });
        flow.current = new DocumentUploadFlow<PickedFile>({
          upload: async picked => {
            const handle = uploadSellerDocument(type, picked, setProgress);
            cancelUpload.current = handle.cancel;
            return handle.promise;
          },
          attach: mediaAssetId => {
            const fields = fieldsRef.current;
            return attachDocument({
              documentType: type,
              mediaAssetId,
              documentNumber: fields.number.trim() || undefined,
              expiresOn: fields.expiresOn.trim() || undefined,
              label: fields.label.trim() || undefined,
            });
          },
        });
      }
      await flow.current.run(ready);
      track('document_uploaded', {
        type,
        pages: pages.length || 1,
        size_bucket: sizeBucket(ready.sizeBytes),
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.allDocuments }),
        client.invalidateQueries({ queryKey: companyKeys.changeRequests }),
        client.invalidateQueries({ queryKey: queryKeys.access }),
      ]);
      // Scanned pages and the PDF are deleted by the unmount cleanup once the screen closes.
      toast.show(t('doc.upload.done'), 'success');
      allowLeave();
      navigation.goBack();
    } catch (caught) {
      if (caught instanceof CaptureError) {
        reportCapture(caught);
      } else {
        const kind = documentErrorKind(caught);
        if (kind === 'notClean') {
          setNotClean(true);
        } else if (kind === 'locked') {
          setError(t('error.documentLocked'));
        } else {
          setError(profileErrorMessage(caught, t));
        }
      }
    } finally {
      cancelUpload.current = null;
      setBusy(null);
    }
  };

  const uploading = busy === 'upload';
  const retryingAttach = Boolean(flow.current?.uploadedMediaId);

  return (
    <FormScreen testID="screen-document-upload">
      <SecureScreen />
      {error ? (
        <Banner tone="red" message={error} testID="upload-error" />
      ) : null}
      {notClean ? (
        <Banner
          tone="amber"
          title={t('doc.upload.scanningTitle')}
          message={t('doc.upload.scanning')}
          actionLabel={t('common.tryAgain')}
          onAction={() => {
            void submit();
          }}
          testID="upload-scanning"
        />
      ) : null}

      <FormSection title={t('doc.upload.details')}>
        <SelectField
          label={t('doc.upload.type')}
          value={type}
          options={typeOptions}
          onChange={value => {
            setType(value as DocumentType);
            setErrors(current => ({ ...current, type: undefined }));
          }}
          disabled={Boolean(fixedType) || uploading || retryingAttach}
          error={errors.type}
          searchable
          testID="upload-type"
        />
        <Field
          label={t('doc.upload.number')}
          hint={t('form.optional')}
          value={number}
          onChangeText={setNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={100}
          error={errors.number}
          editable={!uploading}
          testID="upload-number"
        />
        <DateField
          label={t('doc.upload.expiry')}
          hint={t('form.optional')}
          value={expiresOn}
          onChangeText={setExpiresOn}
          error={errors.expiresOn}
          editable={!uploading}
          shortcuts={false}
          testID="upload-expiry"
        />
        <Field
          label={t('doc.upload.label')}
          hint={t('form.optional')}
          value={label}
          onChangeText={setLabel}
          maxLength={150}
          error={errors.label}
          editable={!uploading}
          testID="upload-label"
        />
      </FormSection>

      <FormSection
        title={t('doc.upload.file')}
        description={t('doc.upload.fileHint', {
          pages: DOCUMENT_UPLOAD_LIMITS.maxPages,
        })}
      >
        <View style={styles.sources}>
          <SourceButton
            icon="document_scanner"
            label={t('doc.source.scan')}
            onPress={() => capture('scan')}
            disabled={busy !== null}
            testID="source-scan"
          />
          <SourceButton
            icon="photo_library"
            label={t('doc.source.gallery')}
            onPress={() => capture('gallery')}
            disabled={busy !== null}
            testID="source-gallery"
          />
          <SourceButton
            icon="picture_as_pdf"
            label={t('doc.source.files')}
            onPress={() => capture('files')}
            disabled={busy !== null}
            testID="source-files"
          />
        </View>

        {pdf ? (
          <Card style={styles.fileCard} testID="picked-pdf">
            <Icon name="picture_as_pdf" size={24} color={colors.secondary} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {pdf.name}
              </Text>
              <Text variant="small" color={colors.textMuted}>
                {formatBytes(pdf.sizeBytes)}
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                await invalidateBuilt();
                await deleteLocalFile(pdf.uri);
                setPdf(null);
                setSource(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('form.remove')}
              hitSlop={12}
              disabled={uploading}
            >
              <Icon name="close" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          </Card>
        ) : null}

        {pages.length > 0 ? (
          <View style={styles.pages} testID="page-list">
            <Text variant="meta" color={colors.textMuted}>
              {t('doc.pages.count', {
                count: pages.length,
                max: DOCUMENT_UPLOAD_LIMITS.maxPages,
              })}
            </Text>
            {pages.map((uri, index) => (
              <View key={uri} style={styles.pageRow}>
                <Image
                  source={{ uri }}
                  style={styles.thumb}
                  accessibilityIgnoresInvertColors
                />
                <Text variant="label" style={styles.flex}>
                  {t('doc.pages.page', { number: index + 1 })}
                </Text>
                <IconButton
                  icon="arrow_upward"
                  label={t('doc.pages.up')}
                  disabled={index === 0 || uploading}
                  onPress={() => {
                    void changePages(movePage(pages, index, index - 1));
                  }}
                />
                <IconButton
                  icon="arrow_downward"
                  label={t('doc.pages.down')}
                  disabled={index === pages.length - 1 || uploading}
                  onPress={() => {
                    void changePages(movePage(pages, index, index + 1));
                  }}
                />
                <IconButton
                  icon="delete"
                  label={t('doc.pages.delete')}
                  disabled={uploading}
                  onPress={() => {
                    void changePages(removePage(pages, index), uri);
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}
      </FormSection>

      {uploading ? (
        <Text
          variant="meta"
          color={colors.textMuted}
          accessibilityLiveRegion="polite"
        >
          {retryingAttach
            ? t('doc.upload.attaching')
            : t('doc.upload.uploading', {
                percent: Math.round(progress * 100),
              })}
        </Text>
      ) : null}
      <Button
        label={
          retryingAttach ? t('doc.upload.retryAttach') : t('doc.upload.submit')
        }
        onPress={() => {
          void submit();
        }}
        loading={uploading}
        disabled={!hasFile || busy !== null || !type}
        icon="upload"
        testID="upload-submit"
      />
      <Text variant="small" color={colors.textMuted}>
        {t('doc.upload.pdfNote')}
      </Text>
    </FormScreen>
  );
}

function SourceButton({
  icon,
  label,
  onPress,
  disabled,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.source,
        pressed && styles.sourcePressed,
        disabled && styles.sourceDisabled,
      ]}
    >
      <Icon name={icon} size={26} color={colors.secondary} />
      <Text variant="small" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.iconButton, disabled && styles.sourceDisabled]}
    >
      <Icon name={icon} size={20} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sources: { flexDirection: 'row', gap: spacing.sm },
  source: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  sourcePressed: { backgroundColor: colors.surfaceContainer },
  sourceDisabled: { opacity: 0.5 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pages: { gap: spacing.sm },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
