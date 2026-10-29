/**
 * One answer to "where does this notification lead?", used by the notification list, in-app
 * banners and local-notification taps alike.
 *
 * Destinations are seller-portal paths (`/seller/dashboard/orders?order=…`), which the app turns
 * into screens with its route mapping. Priority, as on the web (NotificationInbox.tsx):
 *   1. a safe `actionUrl` in the metadata (only portal paths starting `/seller/`);
 *   2. a `message.*` notification with a `conversationId` → that conversation;
 *   3. the type-prefix table, longest prefix first.
 */

export const PORTAL_DASHBOARD = "/seller/dashboard";

export type NotificationActionKey =
  | "viewOrder"
  | "viewMessage"
  | "viewInquiries"
  | "viewRfqs"
  | "viewQuotations"
  | "viewProducts"
  | "viewInventory"
  | "viewPayments"
  | "viewWallet"
  | "viewSubscription"
  | "viewProfile"
  | "viewTicket"
  | "viewDetails";

export interface NotificationRoute {
  action: NotificationActionKey;
  /** A portal path with an optional query. */
  href: string;
}

/** The fields the mapping reads; a local-notification payload can supply them without a full row. */
export interface NotificationLike {
  type: string;
  metadata?: Record<string, unknown> | null;
}

/** Longest prefix first: `rfq.invitation` must win over `rfq.`. */
const PREFIX_TARGETS: readonly { prefix: string; href: string; action: NotificationActionKey }[] = [
  { prefix: "order.", href: `${PORTAL_DASHBOARD}/orders`, action: "viewOrder" },
  { prefix: "shipment.", href: `${PORTAL_DASHBOARD}/orders`, action: "viewOrder" },
  { prefix: "return.", href: `${PORTAL_DASHBOARD}/orders`, action: "viewOrder" },
  { prefix: "sample.", href: `${PORTAL_DASHBOARD}/orders`, action: "viewOrder" },
  { prefix: "rfq.invitation", href: `${PORTAL_DASHBOARD}/inquiries`, action: "viewInquiries" },
  { prefix: "rfq.", href: `${PORTAL_DASHBOARD}/rfqs`, action: "viewRfqs" },
  { prefix: "quote.", href: `${PORTAL_DASHBOARD}/quotations`, action: "viewQuotations" },
  { prefix: "product.", href: `${PORTAL_DASHBOARD}/products`, action: "viewProducts" },
  { prefix: "inventory.", href: `${PORTAL_DASHBOARD}/inventory`, action: "viewInventory" },
  { prefix: "escrow.", href: `${PORTAL_DASHBOARD}/payments`, action: "viewPayments" },
  { prefix: "payment.", href: `${PORTAL_DASHBOARD}/payments`, action: "viewPayments" },
  { prefix: "wallet.", href: `${PORTAL_DASHBOARD}/wallet`, action: "viewWallet" },
  { prefix: "withdrawal.", href: `${PORTAL_DASHBOARD}/wallet`, action: "viewWallet" },
  { prefix: "subscription.", href: `${PORTAL_DASHBOARD}/subscription`, action: "viewSubscription" },
  { prefix: "kyc.", href: `${PORTAL_DASHBOARD}/profile`, action: "viewProfile" },
  { prefix: "verification.", href: `${PORTAL_DASHBOARD}/profile/business`, action: "viewProfile" },
  { prefix: "gst_manual_verification.", href: `${PORTAL_DASHBOARD}/profile/tax`, action: "viewProfile" },
  { prefix: "bank.", href: `${PORTAL_DASHBOARD}/profile/bank`, action: "viewProfile" },
  { prefix: "security.", href: `${PORTAL_DASHBOARD}/profile/security`, action: "viewProfile" },
  { prefix: "support.", href: `${PORTAL_DASHBOARD}/support`, action: "viewTicket" },
];

const enc = encodeURIComponent;

function idFrom(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value ? value : null;
}

/**
 * A portal path an `actionUrl` may carry: it must start with `/seller/` and stay a plain path.
 * Anything else (another site, a scheme, a protocol-relative or traversal path, control
 * characters) is ignored, so a crafted notification cannot send the seller elsewhere.
 */
export function safePortalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/seller/")) return null;
  if (path.includes("//") || path.includes("\\") || path.includes("..")) return null;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
  if (/[\u0000-\u001f\u007f\s]/.test(path)) return null;
  if (/^\/seller\/[^/?#]*:/.test(path)) return null;
  return path;
}

/** Adds the entity id the target screen should highlight, when the notification names one. */
function withEntity(base: string, type: string, metadata: Record<string, unknown>): string {
  if (type.startsWith("order.") || type.startsWith("shipment.") || type.startsWith("return.")) {
    const orderId = idFrom(metadata, "orderId");
    if (orderId) return `${base}?order=${enc(orderId)}`;
  }
  if (type.startsWith("rfq.invitation")) {
    const rfqId = idFrom(metadata, "rfqId") ?? idFrom(metadata, "requestId");
    if (rfqId) return `${base}?rfq=${enc(rfqId)}`;
  }
  if (type.startsWith("support.")) {
    const ticketId = idFrom(metadata, "ticketId");
    if (ticketId) return `${base}?ticket=${enc(ticketId)}`;
  }
  return base;
}

/** Where a notification leads. Null when nothing is actionable — the row then just expands. */
export function notificationRoute(notification: NotificationLike): NotificationRoute | null {
  const type = notification.type ?? "";
  const metadata = (notification.metadata ?? {}) as Record<string, unknown>;

  const actionUrl = safePortalPath(metadata.actionUrl);
  if (actionUrl) return { action: "viewDetails", href: actionUrl };

  if (type.startsWith("message.")) {
    const conversationId = idFrom(metadata, "conversationId");
    if (conversationId) {
      return { action: "viewMessage", href: `${PORTAL_DASHBOARD}/messages?conversation=${enc(conversationId)}` };
    }
  }

  const target = PREFIX_TARGETS.find((entry) => type.startsWith(entry.prefix));
  if (!target) return null;
  return { action: target.action, href: withEntity(target.href, type, metadata) };
}

/** The conversation a message notification is about, if any. */
export function conversationIdOf(notification: NotificationLike): string | null {
  if (!notification.type?.startsWith("message.")) return null;
  return idFrom((notification.metadata ?? {}) as Record<string, unknown>, "conversationId");
}

/** True when the server flagged this row for a system alert (the seller's Push preference is on). */
export function isPushFlagged(notification: NotificationLike): boolean {
  return (notification.metadata ?? {})._push === true;
}
