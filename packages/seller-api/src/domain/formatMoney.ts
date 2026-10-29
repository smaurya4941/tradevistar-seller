/**
 * Rupee formatting for the dashboard. Compact amounts follow the web (`inr` in seller-data.ts:
 * Cr, L, K with one decimal) with one fix: the web's 99,999 reads "₹100.0K" because the value is
 * rounded after the unit is chosen. Here the unit moves up when rounding reaches the next one, so
 * 99,999 is "₹1.0L" and 9,999,999 is "₹1.0Cr".
 */

const UNITS = [
  { size: 10_000_000, suffix: "Cr" },
  { size: 100_000, suffix: "L" },
  { size: 1_000, suffix: "K" },
] as const;

const SYMBOL = "₹";

/** Digits grouped the Indian way: 1234567 → "12,34,567". Works on the integer part only. */
export function groupIndian(value: number): string {
  const negative = value < 0;
  const digits = String(Math.trunc(Math.abs(value)));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return negative ? `-${grouped}` : grouped;
}

const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

/** Full rupees with Indian grouping and paise only when there are some: ₹1,23,456.50 */
export function formatRupees(amount: number): string {
  const value = finite(amount);
  const negative = value < 0;
  const cents = Math.round(Math.abs(value) * 100);
  const whole = Math.floor(cents / 100);
  const paise = cents % 100;
  const body = groupIndian(whole) + (paise ? `.${String(paise).padStart(2, "0")}` : "");
  return `${negative && cents > 0 ? "-" : ""}${SYMBOL}${body}`;
}

/** Compact rupees: ₹950, ₹1.2K, ₹4.2L, ₹3.4Cr. Negative amounts keep their sign. */
export function formatCompactRupees(amount: number): string {
  const value = finite(amount);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const rounded = Math.round(abs);
  // UNITS runs largest first, so the first unit the amount reaches is the one used.
  let unitIndex = -1;
  for (let index = 0; index < UNITS.length; index += 1) {
    if (rounded >= UNITS[index].size) {
      unitIndex = index;
      break;
    }
  }
  if (unitIndex === -1) return `${sign}${SYMBOL}${groupIndian(rounded)}`;
  let shown = oneDecimal(abs / UNITS[unitIndex].size);
  // 99.96K rounds to 100.0K, which is 1.0L: move up a unit at the rounding boundary.
  while (shown >= 100 && unitIndex > 0) {
    unitIndex -= 1;
    shown = oneDecimal(abs / UNITS[unitIndex].size);
  }
  return `${sign}${SYMBOL}${shown.toFixed(1)}${UNITS[unitIndex].suffix}`;
}

/** Axis ticks: the compact form without a trailing ".0" (₹1K, ₹2.5L). */
export function formatCompactTick(amount: number): string {
  return formatCompactRupees(amount).replace(/\.0(?=[A-Za-z]|$)/, "");
}
