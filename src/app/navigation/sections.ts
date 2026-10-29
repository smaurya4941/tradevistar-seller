/**
 * The More menu: every area of the seller web portal that is not one of the four main tabs,
 * grouped like the web sidebar (Seller/src/components/dashboard/Sidebar.tsx). Each entry opens a
 * section screen; later phases replace those screens one at a time without touching the menu.
 *
 * `webPath` is the portal page for the same area, used by "Open on the web" and by the deep-link
 * mapping (routeMapping.ts).
 */
import type { TranslationKey } from '@/i18n';

export type SectionId =
  | 'categories'
  | 'brands'
  | 'inventory'
  | 'rfqs'
  | 'inquiries'
  | 'sampleOrders'
  | 'quotations'
  | 'reviews'
  | 'analytics'
  | 'payments'
  | 'wallet'
  | 'subscription'
  | 'adsCampaigns'
  | 'promotions'
  | 'couponsOffers'
  | 'bannerAds'
  | 'popupBanners'
  | 'brandStore'
  | 'profile'
  | 'exportDocuments'
  | 'support'
  | 'notifications'
  | 'settings';

export interface SectionDef {
  id: SectionId;
  labelKey: TranslationKey;
  icon: string;
  /** Path on the seller web portal, e.g. /seller/dashboard/inventory. */
  webPath: string;
}

export type MoreGroupId =
  | 'catalog'
  | 'sales'
  | 'money'
  | 'marketing'
  | 'company'
  | 'support';

export interface MoreGroup {
  id: MoreGroupId;
  labelKey: TranslationKey;
  items: readonly SectionDef[];
}

const DASHBOARD = '/seller/dashboard';

export const MORE_GROUPS: readonly MoreGroup[] = [
  {
    id: 'catalog',
    labelKey: 'more.group.catalog',
    items: [
      {
        id: 'categories',
        labelKey: 'more.item.categories',
        icon: 'category',
        webPath: `${DASHBOARD}/categories`,
      },
      {
        id: 'brands',
        labelKey: 'more.item.brands',
        icon: 'workspace_premium',
        webPath: `${DASHBOARD}/brands`,
      },
      {
        id: 'inventory',
        labelKey: 'more.item.inventory',
        icon: 'inventory_2',
        webPath: `${DASHBOARD}/inventory`,
      },
    ],
  },
  {
    id: 'sales',
    labelKey: 'more.group.sales',
    items: [
      {
        id: 'rfqs',
        labelKey: 'more.item.rfqs',
        icon: 'description',
        webPath: `${DASHBOARD}/rfqs`,
      },
      {
        id: 'inquiries',
        labelKey: 'more.item.inquiries',
        icon: 'contact_support',
        webPath: `${DASHBOARD}/inquiries`,
      },
      {
        id: 'sampleOrders',
        labelKey: 'more.item.sampleOrders',
        icon: 'science',
        webPath: `${DASHBOARD}/sample-orders`,
      },
      {
        id: 'quotations',
        labelKey: 'more.item.quotations',
        icon: 'request_quote',
        webPath: `${DASHBOARD}/quotations`,
      },
      {
        id: 'reviews',
        labelKey: 'more.item.reviews',
        icon: 'star',
        webPath: `${DASHBOARD}/reviews`,
      },
      {
        id: 'analytics',
        labelKey: 'more.item.analytics',
        icon: 'bar_chart',
        webPath: `${DASHBOARD}/analytics`,
      },
    ],
  },
  {
    id: 'money',
    labelKey: 'more.group.money',
    items: [
      {
        id: 'payments',
        labelKey: 'more.item.payments',
        icon: 'credit_card',
        webPath: `${DASHBOARD}/payments`,
      },
      {
        id: 'wallet',
        labelKey: 'more.item.wallet',
        icon: 'account_balance_wallet',
        webPath: `${DASHBOARD}/wallet`,
      },
      {
        id: 'subscription',
        labelKey: 'more.item.subscription',
        icon: 'workspace_premium',
        webPath: `${DASHBOARD}/subscription`,
      },
    ],
  },
  {
    id: 'marketing',
    labelKey: 'more.group.marketing',
    items: [
      {
        id: 'adsCampaigns',
        labelKey: 'more.item.adsCampaigns',
        icon: 'ads_click',
        webPath: `${DASHBOARD}/marketing/ads-campaigns`,
      },
      {
        id: 'promotions',
        labelKey: 'more.item.promotions',
        icon: 'campaign',
        webPath: `${DASHBOARD}/marketing/promotions`,
      },
      {
        id: 'couponsOffers',
        labelKey: 'more.item.couponsOffers',
        icon: 'sell',
        webPath: `${DASHBOARD}/marketing/coupons-offers`,
      },
      {
        id: 'bannerAds',
        labelKey: 'more.item.bannerAds',
        icon: 'image',
        webPath: `${DASHBOARD}/marketing/banner-ads`,
      },
      {
        id: 'popupBanners',
        labelKey: 'more.item.popupBanners',
        icon: 'web_asset',
        webPath: `${DASHBOARD}/marketing/popup-banners`,
      },
      {
        id: 'brandStore',
        labelKey: 'more.item.brandStore',
        icon: 'storefront',
        webPath: `${DASHBOARD}/marketing/brand-store`,
      },
    ],
  },
  {
    id: 'company',
    labelKey: 'more.group.company',
    items: [
      {
        id: 'profile',
        labelKey: 'more.item.profile',
        icon: 'account_circle',
        webPath: `${DASHBOARD}/profile`,
      },
      {
        id: 'exportDocuments',
        labelKey: 'more.item.exportDocuments',
        icon: 'folder_open',
        webPath: `${DASHBOARD}/export-documents`,
      },
    ],
  },
  {
    id: 'support',
    labelKey: 'more.group.support',
    items: [
      {
        id: 'support',
        labelKey: 'more.item.support',
        icon: 'support_agent',
        webPath: `${DASHBOARD}/support`,
      },
      {
        id: 'notifications',
        labelKey: 'more.item.notifications',
        icon: 'notifications',
        webPath: `${DASHBOARD}/notifications`,
      },
      {
        id: 'settings',
        labelKey: 'more.item.settings',
        icon: 'settings',
        webPath: `${DASHBOARD}/settings`,
      },
    ],
  },
];

const BY_ID = new Map<SectionId, SectionDef>(
  MORE_GROUPS.flatMap(group => group.items).map(item => [item.id, item]),
);

export function sectionById(id: SectionId): SectionDef | undefined {
  return BY_ID.get(id);
}

export function allSections(): SectionDef[] {
  return [...BY_ID.values()];
}
