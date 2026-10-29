/**
 * Business calendar: whether the business is open right now and why, the calendar's timezone and
 * away message, a summary of the weekly hours, away mode ("Set away" until a date, "Welcome back"
 * to clear it) and the exceptions (holidays, vacations, special working days). Dates are calendar
 * dates in the seller's timezone, not the phone's.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  AVAILABILITY_REASON_LABEL,
  awayMinDate,
  CALENDAR_LIMITS,
  clearAway,
  DAY_NAMES,
  deleteCalendarException,
  EXCEPTION_LABELS,
  formatFullDate,
  minutesToTime,
  normalizeWorkingHours,
  setAway,
  TIMEZONES,
  updateCalendar,
  validateAway,
  type BusinessCalendarView,
  type CalendarExceptionView,
} from '@tradevistar/seller-api';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import { useVersionedForm } from '@/core/forms/useVersionedForm';
import {
  Banner,
  Button,
  Card,
  colors,
  ConfirmDialog,
  DateField,
  EmptyState,
  FormScreen,
  FormSection,
  Icon,
  SectionTitle,
  SelectField,
  spacing,
  TextArea,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { companyKeys, useCalendar, useScope, useUpdatedLabel } from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

interface SettingsForm extends Record<string, unknown> {
  timezone: string;
  awayMessage: string;
}

const toForm = (calendar: BusinessCalendarView): SettingsForm => ({
  timezone: calendar.timezone,
  awayMessage: calendar.awayMessage ?? '',
});

export function CalendarScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const scope = useScope();
  const query = useCalendar();
  const updated = useUpdatedLabel(query);
  const [awayUntil, setAwayUntil] = useState('');
  const [awayNote, setAwayNote] = useState('');
  const [awayErrors, setAwayErrors] = useState<{
    until?: string;
    note?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<CalendarExceptionView | null>(null);

  const refetch = useCallback(
    async () => (await query.refetch()).data,
    [query],
  );

  const store = (saved: BusinessCalendarView) => {
    client.setQueryData([...companyKeys.calendar, scope], saved);
    void client.invalidateQueries({ queryKey: companyKeys.overview });
  };

  const form = useVersionedForm<BusinessCalendarView, SettingsForm>({
    server: query.data,
    toForm,
    refetch,
    save: (changes, version) =>
      updateCalendar({
        ...(changes as { timezone?: string; awayMessage?: string | null }),
        version,
      }),
    onSaved: saved => {
      store(saved);
      toast.show(t('form.saved'), 'success');
    },
  });
  useUnsavedGuard(form.dirty);

  const zones = useMemo(() => {
    const list = TIMEZONES.map(item => ({
      value: item.value,
      label: item.label,
    })) as { value: string; label: string }[];
    const current = form.form?.timezone;
    if (current && !list.some(item => item.value === current))
      list.push({ value: current, label: current });
    return list;
  }, [form.form?.timezone]);

  const run = async <T,>(
    action: () => Promise<T>,
    success: string,
  ): Promise<T | null> => {
    setBusy(true);
    try {
      const result = await action();
      toast.show(success, 'success');
      return result;
    } catch (error) {
      void query.refetch();
      toast.show(profileErrorMessage(error, t), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const setAwayMode = async (timezone: string) => {
    const problems = validateAway(awayUntil, awayNote, timezone);
    setAwayErrors(problems);
    if (problems.until || problems.note) return;
    const saved = await run(
      () => setAway({ until: awayUntil, note: awayNote.trim() || undefined }),
      t('cal.awaySet'),
    );
    if (saved) {
      track('calendar_away_set', {});
      store(saved);
      setAwayUntil('');
      setAwayNote('');
    }
  };

  const welcomeBack = async () => {
    const saved = await run(() => clearAway(), t('cal.awayCleared'));
    if (saved) store(saved);
  };

  const removeException = async () => {
    if (!removing) return;
    const done = await run(
      () => deleteCalendarException(removing.id),
      t('cal.exceptionRemoved'),
    );
    if (done)
      await client.invalidateQueries({ queryKey: companyKeys.calendar });
    setRemoving(null);
  };

  return (
    <FormScreen
      dirty={form.dirty}
      saving={form.saving}
      onSave={() => {
        void form.submit();
      }}
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
      testID="screen-calendar"
    >
      <LoadGate query={query} updatedLabel={updated}>
        {calendar => {
          const availability = calendar.availability;
          const hours = normalizeWorkingHours(calendar.workingHours);
          const timezone = form.form?.timezone ?? calendar.timezone;
          return (
            <>
              {form.staleNotice ? (
                <Banner tone="amber" message={t('form.staleReview')} />
              ) : null}
              {form.error ? (
                <Banner
                  tone="red"
                  message={profileErrorMessage(form.error, t)}
                />
              ) : null}

              <Card style={styles.card} testID="cal-availability">
                <View style={styles.row}>
                  <Icon
                    name={availability.isOpen ? 'storefront' : 'bedtime'}
                    size={24}
                    color={
                      availability.isOpen ? colors.success : colors.warning
                    }
                  />
                  <View style={styles.flex}>
                    <Text variant="cardTitle">
                      {AVAILABILITY_REASON_LABEL[availability.reason] ??
                        availability.reason}
                    </Text>
                    {availability.note ? (
                      <Text variant="small" color={colors.textMuted}>
                        {availability.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text variant="small" color={colors.textMuted}>
                  {t('cal.localTime', {
                    time: availability.localTime,
                    zone: availability.timezone,
                  })}
                </Text>
                {availability.isOpen && availability.closesAt ? (
                  <Text variant="small" color={colors.textMuted}>
                    {t('cal.closesAt', { time: availability.closesAt })}
                  </Text>
                ) : null}
                {!availability.isOpen &&
                (availability.nextOpenLabel || availability.nextOpenAt) ? (
                  <Text variant="small" color={colors.textMuted}>
                    {t('cal.nextOpen', {
                      when:
                        availability.nextOpenLabel ??
                        availability.nextOpenAt ??
                        '',
                    })}
                  </Text>
                ) : null}
              </Card>

              {form.form ? (
                <FormSection title={t('cal.settings')}>
                  <SelectField
                    label={t('cal.timezone')}
                    value={form.form.timezone}
                    options={zones}
                    onChange={value => form.setField('timezone', value)}
                    testID="cal-timezone"
                  />
                  <TextArea
                    label={t('cal.awayMessage')}
                    hint={t('cal.awayMessageHint')}
                    value={form.form.awayMessage}
                    onChangeText={value => form.setField('awayMessage', value)}
                    max={CALENDAR_LIMITS.awayMessage}
                    rows={3}
                    testID="cal-away-message"
                  />
                </FormSection>
              ) : null}

              <FormSection title={t('cal.hours')}>
                {hours.map(hour => (
                  <View key={hour.dayOfWeek} style={styles.hourRow}>
                    <Text variant="body" style={styles.day}>
                      {DAY_NAMES[hour.dayOfWeek]}
                    </Text>
                    <Text
                      variant="body"
                      color={
                        hour.isClosed ? colors.textMuted : colors.onSurface
                      }
                    >
                      {hour.isClosed
                        ? t('cal.closed')
                        : `${minutesToTime(
                            hour.opensAtMinutes,
                          )} – ${minutesToTime(hour.closesAtMinutes)}`}
                    </Text>
                  </View>
                ))}
                <Button
                  label={t('cal.editHours')}
                  variant="outline"
                  icon="schedule"
                  onPress={() => navigation.navigate('WorkingHours')}
                  testID="cal-edit-hours"
                />
              </FormSection>

              <FormSection
                title={t('cal.away')}
                description={t('cal.awayHint')}
              >
                {calendar.away ? (
                  <>
                    <Banner
                      tone="amber"
                      title={t('cal.awayUntil', {
                        date: formatFullDate(calendar.away.until),
                      })}
                      message={calendar.away.note ?? undefined}
                      testID="cal-away-active"
                    />
                    <Button
                      label={t('cal.welcomeBack')}
                      icon="waving_hand"
                      onPress={() => {
                        void welcomeBack();
                      }}
                      loading={busy}
                      disabled={busy}
                      testID="cal-welcome-back"
                    />
                  </>
                ) : (
                  <>
                    <DateField
                      label={t('cal.awayUntilLabel')}
                      value={awayUntil}
                      onChangeText={value => {
                        setAwayUntil(value);
                        setAwayErrors(current => ({
                          ...current,
                          until: undefined,
                        }));
                      }}
                      timezone={timezone}
                      hint={t('cal.awayMin', { date: awayMinDate(timezone) })}
                      error={awayErrors.until}
                      testID="cal-away-until"
                    />
                    <TextArea
                      label={t('cal.awayNote')}
                      hint={t('form.optional')}
                      value={awayNote}
                      onChangeText={setAwayNote}
                      max={CALENDAR_LIMITS.awayNote}
                      rows={2}
                      error={awayErrors.note}
                    />
                    <Button
                      label={t('cal.setAway')}
                      icon="beach_access"
                      onPress={() => {
                        void setAwayMode(timezone);
                      }}
                      loading={busy}
                      disabled={busy || awayUntil.length === 0}
                      testID="cal-set-away"
                    />
                  </>
                )}
              </FormSection>

              <SectionTitle>{t('cal.exceptions')}</SectionTitle>
              {calendar.exceptions.length === 0 ? (
                <EmptyState
                  icon="event"
                  title={t('cal.noExceptions')}
                  message={t('cal.noExceptionsHint')}
                />
              ) : (
                calendar.exceptions.map(item => (
                  <Card
                    key={item.id}
                    style={styles.card}
                    testID={`exception-${item.id}`}
                  >
                    <View style={styles.row}>
                      <View style={styles.flex}>
                        <Text variant="cardTitle">{item.label}</Text>
                        <Text variant="small" color={colors.textMuted}>
                          {EXCEPTION_LABELS[item.exceptionType]}
                        </Text>
                      </View>
                      <Button
                        label={t('form.remove')}
                        size="sm"
                        variant="ghost"
                        onPress={() => setRemoving(item)}
                        testID={`exception-${item.id}-remove`}
                      />
                    </View>
                    <Text variant="small">
                      {item.startDate === item.endDate
                        ? formatFullDate(item.startDate)
                        : `${formatFullDate(item.startDate)} – ${formatFullDate(
                            item.endDate,
                          )}`}
                      {item.opensAtMinutes !== null &&
                      item.closesAtMinutes !== null
                        ? `  ·  ${minutesToTime(
                            item.opensAtMinutes,
                          )} – ${minutesToTime(item.closesAtMinutes)}`
                        : ''}
                    </Text>
                    {item.note ? (
                      <Text variant="small" color={colors.textMuted}>
                        {item.note}
                      </Text>
                    ) : null}
                  </Card>
                ))
              )}
              <Button
                label={t('cal.addException')}
                icon="add"
                variant="outline"
                onPress={() => navigation.navigate('ExceptionForm')}
                testID="cal-add-exception"
              />
            </>
          );
        }}
      </LoadGate>
      <ConfirmDialog
        visible={removing !== null}
        title={t('cal.exceptionRemove.title')}
        message={t('cal.exceptionRemove.body', {
          label: removing?.label ?? '',
        })}
        confirmLabel={t('form.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => {
          void removeException();
        }}
        onCancel={() => setRemoving(null)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  day: { width: 120 },
});
