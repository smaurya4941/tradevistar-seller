/** Seller-facing words for the eight order states, through the message files. */
import type { OrderStatus } from '@tradevistar/seller-api';
import type { Translate, TranslationKey } from '@/i18n';

const KEY: Record<OrderStatus, TranslationKey> = {
  PENDING: 'order.status.PENDING',
  READY_TO_SHIP: 'order.status.READY_TO_SHIP',
  PROCESSING: 'order.status.PROCESSING',
  SHIPPED: 'order.status.SHIPPED',
  DELIVERED: 'order.status.DELIVERED',
  CANCELLED: 'order.status.CANCELLED',
  RETURNED: 'order.status.RETURNED',
  FAILED_TO_DELIVER: 'order.status.FAILED_TO_DELIVER',
};

export function orderStatusLabel(t: Translate, status: OrderStatus): string {
  return t(KEY[status]);
}
