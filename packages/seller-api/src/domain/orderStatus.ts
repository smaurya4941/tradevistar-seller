/**
 * The eight order states the dashboard strip and the status donut show, in the web's order
 * (AnalyticsSection.tsx). The labels are the seller-facing words, which differ from the enum for
 * three states (PROCESSING is "Packaging", SHIPPED is "Out for Delivery", CANCELLED is "Canceled").
 */
import type { StatusTone } from "./statusLabel";

export const ORDER_STATUSES = [
  "PENDING",
  "READY_TO_SHIP",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "FAILED_TO_DELIVER",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  READY_TO_SHIP: "Ready to Ship",
  PROCESSING: "Packaging",
  SHIPPED: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Canceled",
  RETURNED: "Returned",
  FAILED_TO_DELIVER: "Failed to Deliver",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  PENDING: "orange",
  READY_TO_SHIP: "blue",
  PROCESSING: "blue",
  SHIPPED: "purple",
  DELIVERED: "green",
  CANCELLED: "red",
  RETURNED: "orange",
  FAILED_TO_DELIVER: "red",
};

/**
 * Categorical slots for the donut, in a fixed order (the web's validated palette) so a status
 * keeps its colour whatever the counts are.
 */
export const ORDER_STATUS_SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
] as const;

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
  color: string;
}

/** The map from `/seller/orders/status-counts` as the eight ordered entries; missing keys are zero. */
export function statusCountList(counts: Record<string, number> | null | undefined): StatusCount[] {
  return ORDER_STATUSES.map((status, index) => {
    const raw = counts?.[status];
    return {
      status,
      count: typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0,
      color: ORDER_STATUS_SERIES[index],
    };
  });
}

export function totalOrders(list: readonly StatusCount[]): number {
  return list.reduce((sum, entry) => sum + entry.count, 0);
}

/** A raw delivery status (`READY_TO_SHIP`) as a known state, or null for anything else. */
export function orderStatusOf(value: string | null | undefined): OrderStatus | null {
  const key = (value ?? "").toUpperCase();
  return isOrderStatus(key) ? key : null;
}
