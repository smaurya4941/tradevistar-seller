/**
 * KYC and documents. The three KYC documents (GST certificate, PAN, Aadhaar) sit at the top as
 * slots; once all three exist the server submits the case to compliance by itself, so there is no
 * submit button. The other 15 document types follow in a list. A verified document is locked: the
 * seller asks compliance for a change instead.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  activeDocumentOf,
  deleteDocument,
  DOCUMENT_LABELS,
  missingRequired,
  openChangeRequest,
  otherDocuments,
  REQUIRED_KYC_DOCUMENTS,
  type CompanyDocumentView,
  type DocumentType,
} from '@tradevistar/seller-api';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { queryKeys } from '@/core/query/queryClient';
import { useAccess } from '@/features/access/useAccess';
import {
  Banner,
  Button,
  colors,
  ConfirmDialog,
  EmptyState,
  SectionTitle,
  spacing,
  SwitchRow,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { DocumentCard } from './components/DocumentCards';
import { KycChangeRequestSheet } from './components/KycChangeRequestSheet';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import {
  companyKeys,
  useDocuments,
  useKycChangeRequests,
  useMyKyc,
} from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function DocumentsScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const access = useAccess();
  const [archived, setArchived] = useState(false);
  const [removing, setRemoving] = useState<CompanyDocumentView | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [changeType, setChangeType] = useState<DocumentType | null>(null);

  const docs = useDocuments(archived);
  const requests = useKycChangeRequests();
  const kyc = useMyKyc();

  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.allDocuments }),
      client.invalidateQueries({ queryKey: companyKeys.changeRequests }),
      client.invalidateQueries({ queryKey: queryKeys.access }),
    ]);
  }, [client]);

  const list = useMemo(() => docs.data?.items ?? [], [docs.data]);
  const changeRequests = useMemo(() => requests.data ?? [], [requests.data]);
  const missing = useMemo(() => missingRequired(list), [list]);
  const others = useMemo(
    () => otherDocuments(list.filter(doc => doc.isActive)),
    [list],
  );
  const archivedDocs = useMemo(() => list.filter(doc => !doc.isActive), [list]);
  const asked = (kyc.data?.documentRequests ?? []).filter(
    request => request.status === 'OPEN',
  );
  const askedTypes = [
    ...new Set(asked.flatMap(request => request.documentTypes)),
  ];

  const view = (doc: CompanyDocumentView) =>
    navigation.navigate('DocumentViewer', {
      mediaAssetId: doc.mediaAssetId,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    });

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await deleteDocument(removing.id);
      setRemoving(null);
      await refresh();
      toast.show(t('doc.removed'), 'success');
    } catch (error) {
      setRemoving(null);
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setRemoveBusy(false);
    }
  };

  const upload = (type?: DocumentType) =>
    navigation.navigate('DocumentUpload', { type });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="screen-documents"
      refreshControl={
        <RefreshControl
          refreshing={docs.isFetching && !docs.isPending}
          onRefresh={() => {
            void refresh();
          }}
        />
      }
    >
      <SecureScreen />
      <LoadGate query={docs}>
        {() => (
          <>
            {missing.length > 0 ? (
              <Banner
                tone="amber"
                title={t('doc.banner.requiredTitle')}
                message={t('doc.banner.required', {
                  documents: missing
                    .map(type => DOCUMENT_LABELS[type])
                    .join(', '),
                })}
                testID="kyc-required-banner"
              />
            ) : (
              <Banner
                tone="green"
                title={
                  access.verified
                    ? t('doc.banner.verifiedTitle')
                    : t('doc.banner.completeTitle')
                }
                message={
                  access.verified
                    ? t('doc.banner.verified')
                    : t('doc.banner.complete')
                }
                testID="kyc-complete-banner"
              />
            )}
            {asked.length > 0 ? (
              <Banner
                tone="blue"
                title={t('doc.asked.title')}
                message={t('doc.asked.body', {
                  documents: askedTypes
                    .map(type => DOCUMENT_LABELS[type as DocumentType] ?? type)
                    .join(', '),
                  notes: asked
                    .map(request => request.notes)
                    .filter(Boolean)
                    .join(' '),
                })}
              />
            ) : null}

            <SectionTitle>{t('doc.section.required')}</SectionTitle>
            {REQUIRED_KYC_DOCUMENTS.map(type => (
              <DocumentCard
                key={type}
                type={type}
                required
                document={activeDocumentOf(list, type)}
                request={openChangeRequest(changeRequests, type)}
                onUpload={upload}
                onView={view}
                onRemove={setRemoving}
                onRequestChange={setChangeType}
              />
            ))}

            <SectionTitle>{t('doc.section.other')}</SectionTitle>
            {others.length === 0 ? (
              <EmptyState
                icon="folder_open"
                title={t('doc.other.emptyTitle')}
                message={t('doc.other.emptyBody')}
              />
            ) : (
              others.map(doc => (
                <DocumentCard
                  key={doc.id}
                  type={doc.documentType}
                  document={doc}
                  request={openChangeRequest(changeRequests, doc.documentType)}
                  onUpload={upload}
                  onView={view}
                  onRemove={setRemoving}
                  onRequestChange={setChangeType}
                  testID={`doc-${doc.id}`}
                />
              ))
            )}
            <Button
              label={t('doc.add')}
              icon="add"
              variant="secondary"
              onPress={() => upload(undefined)}
              testID="doc-add"
            />

            <SwitchRow
              label={t('doc.showArchived')}
              description={t('doc.showArchivedHint')}
              value={archived}
              onValueChange={setArchived}
              testID="doc-archived"
            />
            {archived
              ? archivedDocs.map(doc => (
                  <DocumentCard
                    key={doc.id}
                    type={doc.documentType}
                    document={doc}
                    request={null}
                    onUpload={upload}
                    onView={view}
                    onRemove={setRemoving}
                    onRequestChange={setChangeType}
                    testID={`doc-archived-${doc.id}`}
                  />
                ))
              : null}
          </>
        )}
      </LoadGate>

      <ConfirmDialog
        visible={removing !== null}
        title={t('doc.remove.title')}
        message={t('doc.remove.body', {
          document: removing ? DOCUMENT_LABELS[removing.documentType] : '',
        })}
        confirmLabel={t('form.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeBusy}
        onConfirm={() => {
          void confirmRemove();
        }}
        onCancel={() => setRemoving(null)}
      />
      <KycChangeRequestSheet
        type={changeType}
        onClose={() => setChangeType(null)}
        onSent={async request => {
          setChangeType(null);
          await refresh();
          toast.show(
            t('doc.change.sent'),
            'success',
            request.ticketId
              ? {
                  label: t('doc.change.followTicket'),
                  onPress: () =>
                    navigation.navigate('TicketThread', {
                      ticketId: request.ticketId as string,
                    }),
                }
              : undefined,
          );
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
});
