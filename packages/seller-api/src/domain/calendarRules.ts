/**
 * Business calendar rules. Dates are calendar dates (`YYYY-MM-DD`) in the *seller's* timezone, not
 * the phone's: "today" for the away minimum date comes from the chosen zone.
 */
import type { CalendarExceptionInput, CalendarExceptionType, WorkingHourView } from "../endpoints/calendar";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const EXCEPTION_LABELS: Record<CalendarExceptionType, string> = {
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly off",
  VACATION: "Vacation",
  TEMPORARY_CLOSURE: "Temporary closure",
  SPECIAL_WORKING_DAY: "Special working day",
};

export const EXCEPTION_TYPES = Object.keys(EXCEPTION_LABELS) as CalendarExceptionType[];

export const CALENDAR_LIMITS = { awayNote: 300, awayMessage: 300, exceptionLabel: 150, exceptionNote: 500, timezone: 64 } as const;

export const MINUTES_PER_DAY = 1440;

export function minutesToTime(minutes: number): string {
  const safe = Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** "09:30" to 570; null for anything that is not a time of day (24:00 is allowed as an end). */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24) return null;
  const total = hours * 60 + minutes;
  return total > MINUTES_PER_DAY ? null : total;
}

/** Sunday to Saturday; weekdays 9:00–18:00, the weekend closed. */
export const defaultWorkingHours = (): WorkingHourView[] =>
  DAY_NAMES.map((_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: dayOfWeek === 0 || dayOfWeek === 6,
    opensAtMinutes: 9 * 60,
    closesAtMinutes: 18 * 60,
  }));

/** Seven rows in Sunday-first order, filling any day the server did not send. */
export function normalizeWorkingHours(hours: readonly WorkingHourView[]): WorkingHourView[] {
  const defaults = defaultWorkingHours();
  return defaults.map((fallback) => hours.find((hour) => hour.dayOfWeek === fallback.dayOfWeek) ?? fallback);
}

export const CLOSING_AFTER_OPENING = "Closing time must be after opening time.";

/** The first problem per day, keyed by day of week. An open day needs closing after opening. */
export function validateWorkingHours(hours: readonly WorkingHourView[]): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const hour of hours) {
    if (hour.isClosed) continue;
    const inRange = [hour.opensAtMinutes, hour.closesAtMinutes].every((m) => Number.isInteger(m) && m >= 0 && m <= MINUTES_PER_DAY);
    if (!inRange || hour.closesAtMinutes <= hour.opensAtMinutes) errors[hour.dayOfWeek] = CLOSING_AFTER_OPENING;
  }
  return errors;
}

export const workingHoursChanged = (a: readonly WorkingHourView[], b: readonly WorkingHourView[]): boolean =>
  JSON.stringify(normalizeWorkingHours(a)) !== JSON.stringify(normalizeWorkingHours(b));

/* ------------------------------------------------------------------ dates in a zone */

/** Today's calendar date in an IANA zone (`YYYY-MM-DD`); falls back to UTC for an unknown zone. */
export function todayInZone(timezone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const value = `${pick("year")}-${pick("month")}-${pick("day")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  } catch {
    // Unknown zone, or an engine without Intl time zones: use UTC.
  }
  return now.toISOString().slice(0, 10);
}

export const isCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
};

/** The earliest date "away until" accepts: today in the seller's zone. */
export const awayMinDate = (timezone: string, now?: Date): string => todayInZone(timezone, now);

export function validateAway(until: string, note: string, timezone: string, now?: Date): { until?: string; note?: string } {
  const errors: { until?: string; note?: string } = {};
  if (!isCalendarDate(until)) errors.until = "Enter a date as YYYY-MM-DD.";
  else if (until < awayMinDate(timezone, now)) errors.until = "Choose today or a later date.";
  if (note.trim().length > CALENDAR_LIMITS.awayNote) errors.note = `At most ${CALENDAR_LIMITS.awayNote} characters.`;
  return errors;
}

/** Adds days to a calendar date (`YYYY-MM-DD`), staying a calendar date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface ExceptionForm {
  exceptionType: CalendarExceptionType;
  label: string;
  startDate: string;
  endDate: string;
  opensAt: string;
  closesAt: string;
  note: string;
}

export const emptyExceptionForm = (today: string): ExceptionForm => ({
  exceptionType: "HOLIDAY",
  label: "",
  startDate: today,
  endDate: today,
  opensAt: "",
  closesAt: "",
  note: "",
});

export type ExceptionErrors = Partial<Record<keyof ExceptionForm, string>>;

export function validateException(form: ExceptionForm): ExceptionErrors {
  const errors: ExceptionErrors = {};
  const label = form.label.trim();
  if (!label) errors.label = "Enter a label.";
  else if (label.length > CALENDAR_LIMITS.exceptionLabel) errors.label = `At most ${CALENDAR_LIMITS.exceptionLabel} characters.`;
  if (!isCalendarDate(form.startDate)) errors.startDate = "Enter a date as YYYY-MM-DD.";
  if (!isCalendarDate(form.endDate)) errors.endDate = "Enter a date as YYYY-MM-DD.";
  else if (!errors.startDate && form.endDate < form.startDate) errors.endDate = "End date cannot be before the start date.";
  const opens = form.opensAt.trim() ? timeToMinutes(form.opensAt) : undefined;
  const closes = form.closesAt.trim() ? timeToMinutes(form.closesAt) : undefined;
  if (opens === null) errors.opensAt = "Use a time like 09:00.";
  if (closes === null) errors.closesAt = "Use a time like 18:00.";
  if ((opens === undefined) !== (closes === undefined) && opens !== null && closes !== null) {
    errors[opens === undefined ? "opensAt" : "closesAt"] = "Give both opening and closing times, or neither.";
  }
  if (typeof opens === "number" && typeof closes === "number" && closes <= opens) errors.closesAt = CLOSING_AFTER_OPENING;
  if (form.note.trim().length > CALENDAR_LIMITS.exceptionNote) errors.note = `At most ${CALENDAR_LIMITS.exceptionNote} characters.`;
  return errors;
}

export function exceptionPayload(form: ExceptionForm): CalendarExceptionInput {
  const body: CalendarExceptionInput = {
    exceptionType: form.exceptionType,
    label: form.label.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
  };
  const opens = form.opensAt.trim() ? timeToMinutes(form.opensAt) : null;
  const closes = form.closesAt.trim() ? timeToMinutes(form.closesAt) : null;
  if (opens !== null && closes !== null) {
    body.opensAtMinutes = opens;
    body.closesAtMinutes = closes;
  }
  if (form.note.trim()) body.note = form.note.trim();
  return body;
}

export const AVAILABILITY_REASON_LABEL = {
  OPEN: "Open now",
  OUTSIDE_HOURS: "Closed — outside working hours",
  WEEKLY_OFF: "Closed — weekly off",
  HOLIDAY: "Closed — holiday",
  VACATION: "Closed — vacation",
  AWAY: "Away",
  CLOSED: "Closed",
} as const;
