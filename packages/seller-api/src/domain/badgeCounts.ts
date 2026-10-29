/**
 * Navigation badge counts from the live notification snapshot, grouped exactly as the web sidebar
 * does (Seller/src/components/dashboard/Sidebar.tsx): unread notification rows, not dashboard
 * KPIs, drive every badge.
 */
import type { NotificationArea, NotificationSnapshot } from "../endpoints/notifications";

export type BadgeKey =
  | "notifications"
  | "messages"
  | "orders"
  | "products"
  | "payments"
  | "wallet"
  | "support"
  | "inquiries"
  | "quotations"
  | "rfs"
  | "samples"
  | "inventory"
  | "disputes"
  | "approvals";

export type BadgeCounts = Record<BadgeKey, number>;

export const ZERO_BADGES: BadgeCounts = Object.freeze({
  notifications: 0,
  messages: 0,
  orders: 0,
  products: 0,
  payments: 0,
  wallet: 0,
  support: 0,
  inquiries: 0,
  quotations: 0,
  rfs: 0,
  samples: 0,
  inventory: 0,
  disputes: 0,
  approvals: 0,
});

export const EMPTY_AREAS: Readonly<Record<NotificationArea, number>> = Object.freeze({
  orders: 0,
  cancellations: 0,
  returns: 0,
  refunds: 0,
  rfs: 0,
  samples: 0,
  messages: 0,
  payments: 0,
  wallet: 0,
  products: 0,
  support: 0,
  disputes: 0,
  approvals: 0,
  updates: 0,
});

const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/**
 * Each badge reads its own area, with the web's combinations:
 * - notifications: the unread total;
 * - messages: the larger of the unread messages and the messages area;
 * - rfs ("RFQs and samples"): rfs plus samples;
 * - orders: orders plus cancellations, returns and refunds;
 * - payments: payments plus refunds.
 * `inquiries`, `quotations` and `rfs` all read the web's single "rfs" area, which is where both
 * RFQ invitations and quotations land.
 */
export function badgeCounts(snapshot: NotificationSnapshot | null | undefined): BadgeCounts {
  if (!snapshot) return ZERO_BADGES;
  const area = { ...EMPTY_AREAS, ...(snapshot.unreadByArea ?? {}) };
  const rfs = count(area.rfs);
  return {
    notifications: count(snapshot.unreadNotifications),
    messages: Math.max(count(area.messages), count(snapshot.unreadMessages)),
    orders: count(area.orders) + count(area.cancellations) + count(area.returns) + count(area.refunds),
    products: count(area.products),
    payments: count(area.payments) + count(area.refunds),
    wallet: count(area.wallet),
    support: count(area.support),
    inquiries: rfs,
    quotations: rfs,
    rfs: rfs + count(area.samples),
    samples: count(area.samples),
    inventory: count(area.products),
    disputes: count(area.disputes),
    approvals: count(area.approvals),
  };
}

/** "99+" past two digits, as the web badge renders it; undefined for zero so nothing is drawn. */
export function badgeLabel(value: number): string | undefined {
  if (!value || value < 0) return undefined;
  return value > 99 ? "99+" : String(value);
}

/** The launcher icon number: the unread total, capped at 99. */
export function launcherCount(total: number): number {
  return Math.min(99, count(total));
}
