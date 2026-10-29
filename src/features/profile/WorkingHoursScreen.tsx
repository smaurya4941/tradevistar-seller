/**
 * Working hours: seven rows, Sunday first, each open or closed with an opening and closing time.
 * Closing must be after opening. All seven days are saved at once with the calendar version; a
 * stale answer refetches and keeps the edits ("This changed elsewhere. Review and save again.").
 */
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  CLOSING_AFTER_OPENING,
  DAY_NAMES,
  isStaleVersion,
  minutesToTime,
  normalizeWorkingHours,
  setWorkingHours,
  timeToMinutes,
  workingHoursChanged,
  type WorkingHourView,
} from '@tradevistar/seller-api';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import {
  Banner,
  Card,
  colors,
  FormScreen,
  spacing,
  SwitchRow,
  Text,
  TimeField,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { companyKeys, useCalendar, useScope } from './data';
import { profileErrorMessage } from './errors';

interface Row {
  dayOfWeek: number;
  isClosed: boolean;
  opens: string;
  closes: string;
}

const toRows = (hours: readonly WorkingHourView[]): Row[] =>
  normalizeWorkingHours(hours).map(hour => ({
    dayOfWeek: hour.dayOfWeek,
    isClosed: hour.isClosed,
    opens: minutesToTime(hour.opensAtMinutes),
    closes: minutesToTime(hour.closesAtMinutes),
  }));

/** The rows as the API wants them, and the first problem per day. */
export function rowsToHours(rows: readonly Row[]): {
  hours: WorkingHourView[];
  errors: Record<number, string>;
} {
  const errors: Record<number, string> = {};
  const hours = rows.map(row => {
    const opens = timeToMinutes(row.opens);
    const closes = timeToMinutes(row.closes);
    if (!row.isClosed) {
      if (opens === null || closes === null) errors[row.dayOfWeek] = 'time';
      else if (closes <= opens) errors[row.dayOfWeek] = 'order';
    }
    return {
      dayOfWeek: row.dayOfWeek,
      isClosed: row.isClosed,
      opensAtMinutes: opens ?? 540,
      closesAtMinutes: closes ?? 1080,
    };
  });
  return { hours, errors };
}

export function WorkingHoursScreen() {
  const t = useT();
  const navigation = useNavigation();
  const toast = useToast();
  const client = useQueryClient();
  const scope = useScope();
  const query = useCalendar();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!rows && query.data) setRows(toRows(query.data.workingHours));
  }, [query.data, rows]);

  const checked = useMemo(() => (rows ? rowsToHours(rows) : null), [rows]);
  const dirty = Boolean(
    rows &&
      query.data &&
      workingHoursChanged(query.data.workingHours, checked?.hours ?? []),
  );
  const { allowLeave } = useUnsavedGuard(dirty && !saving);

  const update = (dayOfWeek: number, patch: Partial<Row>) => {
    setStale(false);
    setError(null);
    setRows(current =>
      current
        ? current.map(row =>
            row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row,
          )
        : current,
    );
  };

  const save = async () => {
    if (!checked || !query.data) return;
    setShowErrors(true);
    if (Object.keys(checked.errors).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setWorkingHours(checked.hours, query.data.version);
      client.setQueryData([...companyKeys.calendar, scope], saved);
      void client.invalidateQueries({ queryKey: companyKeys.overview });
      toast.show(t('form.saved'), 'success');
      allowLeave();
      navigation.goBack();
    } catch (caught) {
      if (isStaleVersion(caught)) {
        await query.refetch();
        setStale(true);
      } else {
        setError(profileErrorMessage(caught, t));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen
      dirty={dirty}
      saving={saving}
      onSave={() => {
        void save();
      }}
      testID="screen-working-hours"
    >
      <LoadGate query={query}>
        {() => (
          <>
            {stale ? (
              <Banner
                tone="amber"
                message={t('form.staleReview')}
                testID="stale-notice"
              />
            ) : null}
            {error ? <Banner tone="red" message={error} /> : null}
            {rows
              ? rows.map(row => {
                  const problem = showErrors
                    ? checked?.errors[row.dayOfWeek]
                    : undefined;
                  return (
                    <Card
                      key={row.dayOfWeek}
                      style={styles.card}
                      testID={`hours-${row.dayOfWeek}`}
                    >
                      <SwitchRow
                        label={DAY_NAMES[row.dayOfWeek]}
                        description={
                          row.isClosed ? t('cal.closed') : t('cal.open')
                        }
                        value={!row.isClosed}
                        onValueChange={open =>
                          update(row.dayOfWeek, { isClosed: !open })
                        }
                        testID={`hours-${row.dayOfWeek}-open`}
                      />
                      {!row.isClosed ? (
                        <View style={styles.times}>
                          <View style={styles.flex}>
                            <TimeField
                              label={t('cal.opens')}
                              value={row.opens}
                              onChangeText={value =>
                                update(row.dayOfWeek, { opens: value })
                              }
                              error={
                                problem === 'time' &&
                                timeToMinutes(row.opens) === null
                                  ? t('cal.timeInvalid')
                                  : undefined
                              }
                              testID={`hours-${row.dayOfWeek}-opens`}
                            />
                          </View>
                          <View style={styles.flex}>
                            <TimeField
                              label={t('cal.closes')}
                              value={row.closes}
                              onChangeText={value =>
                                update(row.dayOfWeek, { closes: value })
                              }
                              error={
                                problem === 'order'
                                  ? CLOSING_AFTER_OPENING
                                  : problem === 'time' &&
                                    timeToMinutes(row.closes) === null
                                  ? t('cal.timeInvalid')
                                  : undefined
                              }
                              testID={`hours-${row.dayOfWeek}-closes`}
                            />
                          </View>
                        </View>
                      ) : null}
                    </Card>
                  );
                })
              : null}
            <Text variant="small" color={colors.textMuted}>
              {t('cal.hoursNote')}
            </Text>
          </>
        )}
      </LoadGate>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  times: { flexDirection: 'row', gap: spacing.md },
});
