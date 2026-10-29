/**
 * The in-app banner for a notification that arrived while the app is open. One at a time: a newer
 * arrival replaces the one showing. The banner component reads this and clears it after a few
 * seconds or when tapped.
 */
import type { SellerNotification } from '@tradevistar/seller-api';
import { createStore } from '@/core/store';

export const arrivalBannerStore = createStore<SellerNotification | null>(null);

export function showArrivalBanner(row: SellerNotification): void {
  arrivalBannerStore.set(row);
}

export function dismissArrivalBanner(): void {
  arrivalBannerStore.set(null);
}
