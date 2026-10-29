/**
 * Business registrations (GSTIN, PAN, IEC, CIN, TAN, Udyam, FSSAI, export licence, other): one per
 * type, each with its own row version. Adding a type that already exists updates it (the row
 * version goes with the update). Numbers are upper-cased and checked per type. The registrations
 * "typically expected" for this business type are listed so nothing is missed.
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  formatFullDate,
  normalizeRegistrationNumber,
  REGISTRATION_LABELS,
  REGISTRATION_TYPES,
  removeRegistration,
  upsertRegistration,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationForm,
  type RegistrationType,
  type RegistrationView,
} from '@tradevistar/seller-api';
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { serverFieldErrors } from '@/core/forms/serverErrors';
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  colors,
  ConfirmDialog,
  DateField,
  EmptyState,
  Field,
  SectionTitle,
  SelectField,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { StateBadge } from './components/StateBadge';
import { companyKeys, useBusiness } from './data';
import { profileErrorMessage } from './errors';

const empty = (type: RegistrationType = 'GSTIN'): RegistrationForm => ({
  type,
  number: '',
  issuedOn: '',
  expiresOn: '',
});

export function RegistrationsScreen() {
  const t = useT();
  const toast = useToast();
  const client = useQueryClient();
  const query = useBusiness();
  const [editing, setEditing] = useState<{
    form: RegistrationForm;
    version?: number;
  } | null>(null);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<RegistrationView | null>(null);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.business }),
      client.invalidateQueries({ queryKey: companyKeys.overview }),
    ]);

  const typeOptions = useMemo(
    () =>
      REGISTRATION_TYPES.map(value => ({
        value,
        label: REGISTRATION_LABELS[value],
      })),
    [],
  );

  const close = () => {
    setEditing(null);
    setErrors({});
    setServerError(null);
  };

  const openFor = (registration?: RegistrationView, type?: RegistrationType) =>
    setEditing(
      registration
        ? {
            form: {
              type: registration.registrationType,
              number: registration.number,
              issuedOn: registration.issuedOn?.slice(0, 10) ?? '',
              expiresOn: registration.expiresOn?.slice(0, 10) ?? '',
            },
            version: registration.version,
          }
        : { form: empty(type) },
    );

  const save = async (existing: RegistrationView[]) => {
    if (!editing) return;
    const problems = validateRegistration(editing.form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    // Adding a type that is already saved updates that row, so its version must go along.
    const current = existing.find(
      item => item.registrationType === editing.form.type,
    );
    const version = editing.version ?? current?.version;
    setBusy(true);
    setServerError(null);
    try {
      await upsertRegistration({
        registrationType: editing.form.type,
        number: normalizeRegistrationNumber(editing.form.number),
        issuedOn: editing.form.issuedOn.trim() || undefined,
        expiresOn: editing.form.expiresOn.trim() || undefined,
        version,
      });
      await refresh();
      close();
      toast.show(t('reg.saved'), 'success');
    } catch (caught) {
      const fields = serverFieldErrors(caught);
      if (fields.number) setErrors({ number: fields.number });
      setServerError(profileErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await removeRegistration(removing.registrationType);
      await refresh();
      toast.show(t('reg.removed'), 'success');
    } catch (caught) {
      toast.show(profileErrorMessage(caught, t), 'error');
    } finally {
      setRemoving(null);
      setBusy(false);
    }
  };

  const set = <K extends keyof RegistrationForm>(
    key: K,
    value: RegistrationForm[K],
  ) =>
    setEditing(current =>
      current
        ? { ...current, form: { ...current.form, [key]: value } }
        : current,
    );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="screen-registrations"
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    >
      <LoadGate query={query}>
        {business => {
          const saved = business.registrations;
          const missingExpected = business.requiredRegistrations.filter(
            type => !saved.some(item => item.registrationType === type),
          );
          return (
            <>
              {missingExpected.length > 0 ? (
                <Banner
                  tone="blue"
                  title={t('reg.expectedTitle')}
                  message={t('reg.expected', {
                    types: missingExpected
                      .map(type => REGISTRATION_LABELS[type])
                      .join(', '),
                  })}
                  testID="reg-expected"
                />
              ) : null}
              <SectionTitle>{t('reg.saved.title')}</SectionTitle>
              {saved.length === 0 ? (
                <EmptyState
                  icon="badge"
                  title={t('reg.emptyTitle')}
                  message={t('reg.emptyBody')}
                />
              ) : (
                saved.map(item => (
                  <Card
                    key={item.id}
                    style={styles.card}
                    testID={`reg-${item.registrationType}`}
                  >
                    <View style={styles.head}>
                      <Text variant="cardTitle" style={styles.flex}>
                        {REGISTRATION_LABELS[item.registrationType]}
                      </Text>
                      <StateBadge state={item.verificationState} />
                    </View>
                    <Text variant="body">{item.number}</Text>
                    {item.issuedOn || item.expiresOn ? (
                      <Text variant="small" color={colors.textMuted}>
                        {[
                          item.issuedOn
                            ? t('reg.issued', {
                                date: formatFullDate(item.issuedOn),
                              })
                            : null,
                          item.expiresOn
                            ? t('reg.expires', {
                                date: formatFullDate(item.expiresOn),
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    {item.verificationState === 'REJECTED' &&
                    item.rejectionReason ? (
                      <Text variant="small" color={colors.error}>
                        {t('doc.rejectedWhy', { reason: item.rejectionReason })}
                      </Text>
                    ) : null}
                    <View style={styles.actions}>
                      <Button
                        label={t('form.edit')}
                        size="sm"
                        variant="outline"
                        onPress={() => openFor(item)}
                        testID={`reg-${item.registrationType}-edit`}
                      />
                      <Button
                        label={t('form.remove')}
                        size="sm"
                        variant="ghost"
                        onPress={() => setRemoving(item)}
                        testID={`reg-${item.registrationType}-remove`}
                      />
                    </View>
                  </Card>
                ))
              )}
              <Button
                label={t('reg.add')}
                icon="add"
                onPress={() => openFor()}
                testID="reg-add"
              />

              <BottomSheet
                visible={editing !== null}
                onClose={close}
                title={t('reg.form.title')}
                scrollable
              >
                {editing ? (
                  <View style={styles.sheet}>
                    {serverError ? (
                      <Banner tone="red" message={serverError} />
                    ) : null}
                    <SelectField
                      label={t('reg.type')}
                      value={editing.form.type}
                      options={typeOptions}
                      onChange={value => set('type', value as RegistrationType)}
                      disabled={editing.version !== undefined}
                      testID="reg-type"
                    />
                    <Field
                      label={t('reg.number')}
                      value={editing.form.number}
                      onChangeText={value => set('number', value.toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={50}
                      error={errors.number}
                      testID="reg-number"
                    />
                    <DateField
                      label={t('reg.issuedOn')}
                      hint={t('form.optional')}
                      value={editing.form.issuedOn}
                      onChangeText={value => set('issuedOn', value)}
                      shortcuts={false}
                      error={errors.issuedOn}
                    />
                    <DateField
                      label={t('reg.expiresOn')}
                      hint={t('form.optional')}
                      value={editing.form.expiresOn}
                      onChangeText={value => set('expiresOn', value)}
                      shortcuts={false}
                      error={errors.expiresOn}
                    />
                    <Button
                      label={t('form.save')}
                      onPress={() => {
                        void save(saved);
                      }}
                      loading={busy}
                      disabled={busy}
                      testID="reg-save"
                    />
                  </View>
                ) : null}
              </BottomSheet>
            </>
          );
        }}
      </LoadGate>
      <ConfirmDialog
        visible={removing !== null}
        title={t('reg.remove.title')}
        message={t('reg.remove.body', {
          type: removing ? REGISTRATION_LABELS[removing.registrationType] : '',
        })}
        confirmLabel={t('form.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => {
          void confirmRemove();
        }}
        onCancel={() => setRemoving(null)}
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
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  sheet: { gap: spacing.md, padding: spacing.lg },
});
