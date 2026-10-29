/**
 * The five tabs: Home, Orders, Products, Inbox, More. Each tab is its own stack (TabStacks.tsx), so
 * detail screens keep the tab bar. Android back from any tab returns to Home first
 * (`backBehavior: firstRoute`).
 *
 * Badges come from the live notification snapshot: Inbox shows the unread notifications, Orders
 * the orders badge, Products the products area, and More a dot when any item inside it has a badge.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BadgeKey } from '@tradevistar/seller-api';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnyBadge, useBadge } from '@/core/realtime/liveSnapshot';
import { colors, CountBadge, fonts, Icon, spacing, Text } from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { MORE_BADGE_KEYS } from './moreBadges';
import {
  HomeStack,
  InboxStack,
  MoreStack,
  OrdersStack,
  ProductsStack,
} from './TabStacks';
import type { MainTabName, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS: {
  name: MainTabName;
  label: TranslationKey;
  icon: string;
  component: React.ComponentType;
}[] = [
  { name: 'Home', label: 'tabs.home', icon: 'home', component: HomeStack },
  {
    name: 'Orders',
    label: 'tabs.orders',
    icon: 'receipt_long',
    component: OrdersStack,
  },
  {
    name: 'Products',
    label: 'tabs.products',
    icon: 'inventory_2',
    component: ProductsStack,
  },
  { name: 'Inbox', label: 'tabs.inbox', icon: 'forum', component: InboxStack },
  { name: 'More', label: 'tabs.more', icon: 'menu', component: MoreStack },
];

function tabLabel(label: string) {
  return ({ color }: { color: string }) => (
    <Text
      variant="small"
      color={color}
      numberOfLines={1}
      maxFontSizeMultiplier={1.3}
      style={styles.label}
    >
      {label}
    </Text>
  );
}

/** A tab icon with its count; the badge reads its own slice so only it re-renders. */
function BadgedIcon({
  name,
  color,
  badge,
}: {
  name: string;
  color: string;
  badge: BadgeKey;
}) {
  const count = useBadge(badge);
  return (
    <View>
      <Icon name={name} size={24} color={color} />
      <CountBadge count={count} style={styles.badge} />
    </View>
  );
}

/** The More tab's icon: a small dot while anything inside the menu has a badge. */
function MoreIcon({ name, color }: { name: string; color: string }) {
  const any = useAnyBadge(MORE_BADGE_KEYS);
  return (
    <View>
      <Icon name={name} size={24} color={color} />
      {any ? <View style={styles.dot} testID="more-dot" /> : null}
    </View>
  );
}

const TAB_BADGE: Partial<Record<MainTabName, BadgeKey>> = {
  Orders: 'orders',
  Products: 'products',
  Inbox: 'notifications',
};

function tabIcon(tab: MainTabName, name: string) {
  return ({ color }: { color: string }) => {
    const badge = TAB_BADGE[tab];
    if (badge) return <BadgedIcon name={name} color={color} badge={badge} />;
    if (tab === 'More') return <MoreIcon name={name} color={color} />;
    return <Icon name={name} size={24} color={color} />;
  };
}

export function MainTabs() {
  const t = useT();
  const orders = useBadge('orders');
  const products = useBadge('products');
  const unread = useBadge('notifications');
  const spoken: Partial<Record<MainTabName, string>> = {
    Orders: orders > 0 ? t('tabs.badge.orders', { count: orders }) : undefined,
    Products:
      products > 0 ? t('tabs.badge.products', { count: products }) : undefined,
    Inbox: unread > 0 ? t('tabs.badge.inbox', { count: unread }) : undefined,
  };
  return (
    <Tab.Navigator
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: styles.bar,
        tabBarHideOnKeyboard: true,
      }}
    >
      {TABS.map(tab => {
        const label = t(tab.label);
        return (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={tab.component}
            options={{
              title: label,
              tabBarButtonTestID: `tab-${tab.name}`,
              tabBarAccessibilityLabel: spoken[tab.name]
                ? `${label}, ${spoken[tab.name]}`
                : label,
              tabBarLabel: tabLabel(label),
              tabBarIcon: tabIcon(tab.name, tab.icon),
            }}
          />
        );
      })}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.divider,
    minHeight: 60,
  },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
  badge: { position: 'absolute', top: -6, right: -12 },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surface,
    marginLeft: spacing.xs,
  },
});
