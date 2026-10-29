/**
 * A moment in India Standard Time as "7 Oct 2026, 4:30 pm". Notices and maintenance windows run on
 * IST, so their dates read the same wherever the seller is. Computed from the offset rather than
 * the device's time-zone database, which not every JavaScript engine ships. Empty when the value
 * is unreadable.
 */
const HOUR = 60 * 60_000;
const IST_OFFSET_MS = 5.5 * HOUR;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatIstDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const ist = new Date(time + IST_OFFSET_MS);
  const hours = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}, ${hour12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
}
