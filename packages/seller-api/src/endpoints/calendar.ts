/**
 * Business calendar (`/seller/profile/calendar*`): working hours, away mode and exceptions.
 * Dates are calendar dates (`YYYY-MM-DD`) in the seller's timezone, not the phone's.
 */
import { api } from "../http/client";

export type CalendarExceptionType =
  | "HOLIDAY"
  | "WEEKLY_OFF"
  | "VACATION"
  | "TEMPORARY_CLOSURE"
  | "SPECIAL_WORKING_DAY";

export interface WorkingHourView {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  isClosed: boolean;
  opensAtMinutes: number;
  closesAtMinutes: number;
}

export interface CalendarExceptionView {
  id: string;
  exceptionType: CalendarExceptionType;
  label: string;
  startDate: string;
  endDate: string;
  opensAtMinutes: number | null;
  closesAtMinutes: number | null;
  note: string | null;
}

export type AvailabilityReason = "OPEN" | "OUTSIDE_HOURS" | "WEEKLY_OFF" | "HOLIDAY" | "VACATION" | "AWAY" | "CLOSED";

export interface CalendarAvailabilityView {
  isOpen: boolean;
  reason: AvailabilityReason;
  note: string | null;
  localTime: string;
  timezone: string;
  closesAt: string | null;
  nextOpenAt: string | null;
  nextOpenLabel: string | null;
}

export interface BusinessCalendarView {
  timezone: string;
  awayMessage: string | null;
  away: { until: string; note: string | null } | null;
  workingHours: WorkingHourView[];
  exceptions: CalendarExceptionView[];
  availability: CalendarAvailabilityView;
  version: number;
}

export const getCalendar = (signal?: AbortSignal) =>
  api.get<BusinessCalendarView>("/seller/profile/calendar", { requireAuth: true, signal });

export const updateCalendar = (body: { timezone?: string; awayMessage?: string | null; version: number }) =>
  api.patch<BusinessCalendarView>("/seller/profile/calendar", body, { requireAuth: true });

export const setWorkingHours = (days: WorkingHourView[], version: number) =>
  api.put<BusinessCalendarView>("/seller/profile/calendar/working-hours", { days, version }, { requireAuth: true });

export const setAway = (body: { until: string; note?: string }) =>
  api.put<BusinessCalendarView>("/seller/profile/calendar/away", body, { requireAuth: true });

export const clearAway = () =>
  api.delete<BusinessCalendarView>("/seller/profile/calendar/away", { requireAuth: true });

export interface CalendarExceptionInput {
  exceptionType: CalendarExceptionType;
  label: string;
  startDate: string;
  endDate: string;
  opensAtMinutes?: number;
  closesAtMinutes?: number;
  note?: string;
}

export const addCalendarException = (body: CalendarExceptionInput) =>
  api.post<CalendarExceptionView>("/seller/profile/calendar/exceptions", body, { requireAuth: true });

export const deleteCalendarException = (id: string) =>
  api.delete<{ removed: true }>(`/seller/profile/calendar/exceptions/${encodeURIComponent(id)}`, {
    requireAuth: true,
  });
