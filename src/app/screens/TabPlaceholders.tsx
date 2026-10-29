/**
 * The main tabs that later phases fill in (Orders in Phase 7, Products in Phase 5). Each is a
 * titled placeholder that says what will live there and links to the same area on the seller web
 * portal. The route can carry a filter a link brought (`query`), which the real screen will read.
 */
import React from 'react';
import { useT } from '@/i18n';
import { TabScreen } from '../components/TabScreen';
import { SectionPlaceholder } from '../components/SectionPlaceholder';
import { TAB_WEB_PATHS } from '../navigation/routeMapping';

export function OrdersScreen() {
  const t = useT();
  return (
    <TabScreen title={t('placeholder.orders.title')} testID="screen-orders">
      <SectionPlaceholder
        icon="shopping_cart"
        title={t('placeholder.orders.title')}
        body={t('placeholder.orders.body')}
        webPath={TAB_WEB_PATHS.Orders}
      />
    </TabScreen>
  );
}

export function ProductsScreen() {
  const t = useT();
  return (
    <TabScreen title={t('placeholder.products.title')} testID="screen-products">
      <SectionPlaceholder
        icon="inventory_2"
        title={t('placeholder.products.title')}
        body={t('placeholder.products.body')}
        webPath={TAB_WEB_PATHS.Products}
      />
    </TabScreen>
  );
}
