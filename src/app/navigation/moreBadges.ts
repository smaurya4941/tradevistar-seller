/**
 * Which More-menu entry shows which badge, following the web sidebar's grouping. The More tab
 * itself shows a dot while any of these is above zero.
 */
import type { BadgeKey } from '@tradevistar/seller-api';
import type { SectionId } from './sections';

export const SECTION_BADGE: Partial<Record<SectionId, BadgeKey>> = {
  payments: 'payments',
  wallet: 'wallet',
  support: 'support',
  notifications: 'notifications',
  quotations: 'quotations',
  inquiries: 'inquiries',
  sampleOrders: 'samples',
  rfqs: 'rfs',
};

export const MORE_BADGE_KEYS: readonly BadgeKey[] = [
  ...new Set(Object.values(SECTION_BADGE)),
] as BadgeKey[];
