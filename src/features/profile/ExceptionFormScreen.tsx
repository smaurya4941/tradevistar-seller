/**
 * Add a calendar exception: a holiday, weekly off, vacation, temporary closure or special working
 * day, with a date range (the end is not before the start), optional opening and closing times
 * and a note. Dates are calendar dates in the seller's timezone.
 */
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  addCalendarException,
  CALENDAR_LIMITS,
  emptyExceptionForm,
  EXCEPTION_LABELS,
  EXCEPTION_TYPES,
  exceptionPayload,
  todayInZone,
  validateException,
  type CalendarExceptionType,
  type ExceptionForm,
} from '@tradevistar/seller-api';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import { serverFieldErrors } from '@/core/forms/serverErrors';
import {
  Banner,
  DateField,
  Field,
  FormScreen,
  FormSection,
  SelectField,
  spacing,
  TextArea,
  TimeField,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { companyKeys, useCalendar } from './data';
import { profileErrorMessage } from './errors';

export function ExceptionFormScreen() {
  const t = useT();
  const navigation = useNavigation();
  const toast = useToast();
  const client = useQueryClient();
  const calendar = useCalendar();
  const timezone = calendar.data?.timezone ?? 'Asia/Kolkata';
  const [form, setForm] = useState<ExceptionForm>(() =>
    emptyExceptionForm(todayInZone(timezone)),
  );
  const [touched, setTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const { allowLeave } = useUnsavedGuard(touched && !saving);

  const set = <K extends keyof ExceptionForm>(
    key: K,
    value: ExceptionForm[K],
  ) => {
    setTouched(true);
    setForm(current => ({ ...current, [key]: value }));
  };

  const errors = useMemo(() => validateException(form), [form]);
  const shown = (name: keyof ExceptionForm) =>
    (showErrors ? errors[name] : undefined) ?? serverErrors[name];
  const options = useMemo(
    () =>
      EXCEPTION_TYPES.map(value => ({ value, label: EXCEPTION_LABELS[value] })),
    [],
  );

  const save = async () => {
    setShowErrors(true);
    setError(null);
    setServerErrors({});
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await addCalendarException(exceptionPayload(form));
      await Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.calendar }),
        client.invalidateQueries({ queryKey: companyKeys.overview }),
      ]);
      toast.show(t('cal.exceptionAdded'), 'success');
      allowLeave();
      navigation.goBack();
    } catch (caught) {
      setServerErrors(serverFieldErrors(caught));
      setError(profileErrorMessage(caught, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen
      dirty={touched}
      saving={saving}
      onSave={() => {
        void save();
      }}
      saveLabel={t('cal.exceptionSave')}
      testID="screen-exception"
    >
      {error ? <Banner tone="red" message={error} /> : null}
      <FormSection title={t('cal.exceptionWhat')}>
        <SelectField
          label={t('cal.exceptionType')}
          value={form.exceptionType}
          options={options}
          onChange={value =>
            set('exceptionType', value as CalendarExceptionType)
          }
          testID="exception-type"
        />
        <Field
          label={t('cal.exceptionLabel')}
          value={form.label}
          onChangeText={value => set('label', value)}
          maxLength={CALENDAR_LIMITS.exceptionLabel}
          error={shown('label')}
          testID="exception-label"
        />
      </FormSection>
      <FormSection title={t('cal.exceptionWhen')}>
        <DateField
          label={t('cal.exceptionStart')}
          value={form.startDate}
          onChangeText={value => set('startDate', value)}
          timezone={timezone}
          error={shown('startDate')}
          testID="exception-start"
        />
        <DateField
          label={t('cal.exceptionEnd')}
          value={form.endDate}
          onChangeText={value => set('endDate', value)}
          timezone={timezone}
          error={shown('endDate')}
          testID="exception-end"
        />
        <View style={styles.times}>
          <View style={styles.flex}>
            <TimeField
              label={t('cal.opens')}
              hint={t('form.optional')}
              value={form.opensAt}
              onChangeText={value => set('opensAt', value)}
              error={shown('opensAt')}
            />
          </View>
          <View style={styles.flex}>
            <TimeField
              label={t('cal.closes')}
              hint={t('form.optional')}
              value={form.closesAt}
              onChangeText={value => set('closesAt', value)}
              error={shown('closesAt')}
            />
          </View>
        </View>
      </FormSection>
      <FormSection>
        <TextArea
          label={t('cal.exceptionNote')}
          hint={t('form.optional')}
          value={form.note}
          onChangeText={value => set('note', value)}
          max={CALENDAR_LIMITS.exceptionNote}
          rows={3}
          error={shown('note')}
        />
      </FormSection>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  times: { flexDirection: 'row', gap: spacing.md },
});
