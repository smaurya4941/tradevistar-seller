/**
 * Notification categories, mirrored from the API's `CATEGORY_PREFIXES` (notificationsService.ts).
 * On Android each category is also a notification channel, so a seller can mute quotes without
 * muting orders. The category is derived from the `type` prefix, never stored.
 */
import type { NotificationCategory } from "../endpoints/notifications";

const CATEGORY_PREFIXES: Record<Exclude<NotificationCategory, "updates">, string[]> = {
  orders: ["order.", "return.", "shipment."],
  quotes: ["quote.", "rfq."],
  samples: ["sample."],
  messages: ["message."],
};

/** Everything with no bucket of its own — KYC, payments, support, account — lands in updates. */
export function categoryOf(type: string): NotificationCategory {
  for (const [category, prefixes] of Object.entries(CATEGORY_PREFIXES)) {
    if (prefixes.some((prefix) => type.startsWith(prefix))) return category as NotificationCategory;
  }
  return "updates";
}

export interface PushChannel {
  id: NotificationCategory;
  name: string;
  description: string;
  /** Maps to the platform's importance levels; "high" shows a heads-up banner. */
  importance: "high" | "default" | "low";
}

export const PUSH_CHANNELS: readonly PushChannel[] = [
  {
    id: "orders",
    name: "Orders & shipments",
    description: "New orders, payments released, shipping updates, returns and delivery.",
    importance: "high",
  },
  {
    id: "quotes",
    name: "Quotes & RFQs",
    description: "Buyer inquiries, quotation decisions and changes to requests for quotation.",
    importance: "high",
  },
  {
    id: "samples",
    name: "Samples",
    description: "Sample requests, dispatch and delivery.",
    importance: "default",
  },
  {
    id: "messages",
    name: "Messages",
    description: "New messages from buyers.",
    importance: "high",
  },
  {
    id: "updates",
    name: "Account & other updates",
    description: "KYC, payments, wallet, subscription, support and account notices.",
    importance: "default",
  },
];

/** The channel id for a category, falling back to "updates" for anything unknown. */
export function channelIdFor(category: string | undefined): NotificationCategory {
  return PUSH_CHANNELS.some((channel) => channel.id === category) ? (category as NotificationCategory) : "updates";
}

export interface NotificationLook {
  /** Material Symbols glyph name. */
  icon: string;
  tone: "amber" | "blue" | "green" | "orange" | "purple" | "red";
}

/** Matched longest-prefix-first, so `order.cancelled` beats the generic `order.`. */
const LOOKS: { prefix: string; look: NotificationLook }[] = [
  { prefix: "order.shipped", look: { icon: "local_shipping", tone: "amber" } },
  { prefix: "order.delivered", look: { icon: "inventory", tone: "green" } },
  { prefix: "order.cancelled", look: { icon: "cancel", tone: "red" } },
  { prefix: "order.", look: { icon: "shopping_cart", tone: "green" } },
  { prefix: "shipment.", look: { icon: "local_shipping", tone: "amber" } },
  { prefix: "return.", look: { icon: "assignment_return", tone: "orange" } },
  { prefix: "quote.", look: { icon: "description", tone: "purple" } },
  { prefix: "rfq.", look: { icon: "request_quote", tone: "purple" } },
  { prefix: "sample.", look: { icon: "science", tone: "orange" } },
  { prefix: "message.", look: { icon: "chat", tone: "blue" } },
  { prefix: "dispute.", look: { icon: "gavel", tone: "red" } },
  { prefix: "kyc.", look: { icon: "verified_user", tone: "blue" } },
  { prefix: "verification.", look: { icon: "verified_user", tone: "blue" } },
  { prefix: "gst", look: { icon: "verified_user", tone: "blue" } },
  { prefix: "bank.", look: { icon: "account_balance", tone: "blue" } },
  { prefix: "security.", look: { icon: "lock", tone: "red" } },
  { prefix: "support.", look: { icon: "support_agent", tone: "blue" } },
  { prefix: "product.", look: { icon: "inventory_2", tone: "blue" } },
  { prefix: "inventory.", look: { icon: "inventory_2", tone: "amber" } },
  { prefix: "payment.", look: { icon: "payments", tone: "green" } },
  { prefix: "escrow.", look: { icon: "account_balance", tone: "green" } },
  { prefix: "wallet.", look: { icon: "account_balance_wallet", tone: "green" } },
  { prefix: "withdrawal.", look: { icon: "account_balance_wallet", tone: "green" } },
  { prefix: "subscription.", look: { icon: "workspace_premium", tone: "purple" } },
  { prefix: "promotion.", look: { icon: "campaign", tone: "red" } },
];

const FALLBACK_LOOK: NotificationLook = { icon: "info", tone: "blue" };

export function lookOf(type: string, serverIcon?: string | null): NotificationLook {
  const match = LOOKS.find((entry) => type.startsWith(entry.prefix));
  const look = match?.look ?? FALLBACK_LOOK;
  return serverIcon ? { ...look, icon: serverIcon } : look;
}
