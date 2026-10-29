/**
 * Small display rules shared by the dashboard cards: who the seller is called, how old a record
 * is, and a short date. Pure, so they run (and are tested) under plain Node.
 */

export const FALLBACK_SELLER_NAME = "TradeVistar Seller";

/**
 * What Home calls the seller: the saved business name, then first and last name, then
 * "TradeVistar Seller" — as the web does. Never the login email.
 */
export function sellerDisplayName(
  business: { companyName?: string | null } | null | undefined,
  user: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string {
  const company = business?.companyName?.trim();
  if (company) return company;
  const person = [user?.firstName, user?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return person || FALLBACK_SELLER_NAME;
}

export type RelativeTime =
  | { unit: "now" }
  | { unit: "minutes" | "hours" | "days"; count: number };

/** How long ago `iso` was, in whole units. A time in the future (a skewed clock) reads as "now". */
export function relativeTimeOf(iso: string, now: number = Date.now()): RelativeTime {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return { unit: "now" };
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return { unit: "now" };
  if (minutes < 60) return { unit: "minutes", count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hours", count: hours };
  return { unit: "days", count: Math.floor(hours / 24) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Oct" for a date; an empty string when the value is not a date. */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]}`;
}

/** "12 Oct 2026" for a date; an empty string when the value is not a date. */
export function formatFullDate(iso: string | null | undefined): string {
  const short = formatDayMonth(iso);
  if (!short) return "";
  return `${short} ${new Date(iso as string).getFullYear()}`;
}

export type CalendarBucket = "today" | "yesterday" | "earlier";

/** Which day-group a timestamp belongs to, by the phone's calendar: Today, Yesterday, Earlier. */
export function calendarBucket(iso: string, now: Date = new Date()): CalendarBucket {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return "earlier";
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(time)) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "yesterday" : "earlier";
}

/** "12 Oct, 3:45 pm" in the phone's time zone; an empty string when the value is not a date. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "pm" : "am";
  return `${formatDayMonth(iso)}, ${hours % 12 || 12}:${minutes} ${suffix}`;
}
