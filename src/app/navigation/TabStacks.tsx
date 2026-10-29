/**
 * One native stack per tab, so a detail screen keeps the tab bar. The screens any tab can open
 * (search, support, settings, a More-menu area…) are registered in every stack from one list, so
 * opening one from Home stays on the Home tab and Back returns there.
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { env } from '@/config/env';
import { DiagnosticsScreen } from '@/debug/DiagnosticsScreen';
import { AnalyticsScreen } from '@/features/analytics/AnalyticsScreen';
import { HelpAboutScreen } from '@/features/info/HelpAboutScreen';
import { InfoPageScreen } from '@/features/info/InfoPageScreen';
import { SuccessStoriesScreen } from '@/features/info/SuccessStoriesScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { CommunicationSettingsScreen } from '@/features/notifications/CommunicationSettingsScreen';
import { NotificationCenterScreen } from '@/features/notifications/NotificationCenterScreen';
import { NotificationSettingsScreen } from '@/features/notifications/NotificationSettingsScreen';
import { SearchScreen } from '@/features/search/SearchScreen';
import { AppSettingsScreen } from '@/features/settings/AppSettingsScreen';
import { NewTicketScreen } from '@/features/support/NewTicketScreen';
import { SupportHomeScreen } from '@/features/support/SupportHomeScreen';
import { TicketThreadScreen } from '@/features/support/TicketThreadScreen';
import { TicketsScreen } from '@/features/support/TicketsScreen';
import { colors, fonts } from '@/design';
import { useT } from '@/i18n';
import { MoreScreen } from '../screens/MoreScreen';
import { OrdersScreen, ProductsScreen } from '../screens/TabPlaceholders';
import { SectionScreen } from '../screens/SectionScreen';
import { profileScreens } from './profileScreens';
import { sectionById } from './sections';
import type {
  HomeStackParamList,
  InboxStackParamList,
  MoreStackParamList,
  OrdersStackParamList,
  ProductsStackParamList,
} from './types';

const screenOptions = {
  headerTintColor: colors.secondary,
  headerTitleStyle: { fontFamily: fonts.semibold },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
} as const;

// One list of shared screens is mounted in five differently typed stacks, so the navigator is
// typed loosely here; every screen types its own route and navigation props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStack = ReturnType<typeof createNativeStackNavigator<any>>;

function sharedScreens(Stack: AnyStack, t: ReturnType<typeof useT>) {
  return (
    <>
      <Stack.Screen
        name="Section"
        component={SectionScreen}
        options={({
          route,
        }: {
          route: { params?: { sectionId?: string } };
        }) => ({
          title: t(
            sectionById(
              (route.params?.sectionId ?? 'profile') as Parameters<
                typeof sectionById
              >[0],
            )?.labelKey ?? 'more.title',
          ),
        })}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: t('analytics.title') }}
      />
      <Stack.Screen
        name="SupportHome"
        component={SupportHomeScreen}
        options={{ title: t('support.title') }}
      />
      <Stack.Screen
        name="SupportTickets"
        component={TicketsScreen}
        options={{ title: t('support.tickets.title') }}
      />
      <Stack.Screen
        name="NewTicket"
        component={NewTicketScreen}
        options={{ title: t('support.new.title') }}
      />
      <Stack.Screen
        name="TicketThread"
        component={TicketThreadScreen}
        options={{ title: t('support.thread.title') }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: t('prefs.title') }}
      />
      <Stack.Screen
        name="CommunicationSettings"
        component={CommunicationSettingsScreen}
        options={{ title: t('comm.title') }}
      />
      <Stack.Screen
        name="HelpAbout"
        component={HelpAboutScreen}
        options={{ title: t('info.helpAbout.title') }}
      />
      <Stack.Screen
        name="InfoPage"
        component={InfoPageScreen}
        options={{ title: t('info.page.title') }}
      />
      <Stack.Screen
        name="SuccessStories"
        component={SuccessStoriesScreen}
        options={{ title: t('info.stories.title') }}
      />
      <Stack.Screen
        name="AppSettings"
        component={AppSettingsScreen}
        options={{ title: t('settings.title') }}
      />
      {profileScreens(Stack, t)}
    </>
  );
}

const HomeNav = createNativeStackNavigator<HomeStackParamList>();
const OrdersNav = createNativeStackNavigator<OrdersStackParamList>();
const ProductsNav = createNativeStackNavigator<ProductsStackParamList>();
const InboxNav = createNativeStackNavigator<InboxStackParamList>();
const MoreNav = createNativeStackNavigator<MoreStackParamList>();

export function HomeStack() {
  const t = useT();
  return (
    <HomeNav.Navigator screenOptions={screenOptions}>
      <HomeNav.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      {sharedScreens(HomeNav as AnyStack, t)}
    </HomeNav.Navigator>
  );
}

export function OrdersStack() {
  const t = useT();
  return (
    <OrdersNav.Navigator screenOptions={screenOptions}>
      <OrdersNav.Screen
        name="OrdersMain"
        component={OrdersScreen}
        options={{ headerShown: false }}
      />
      {sharedScreens(OrdersNav as AnyStack, t)}
    </OrdersNav.Navigator>
  );
}

export function ProductsStack() {
  const t = useT();
  return (
    <ProductsNav.Navigator screenOptions={screenOptions}>
      <ProductsNav.Screen
        name="ProductsMain"
        component={ProductsScreen}
        options={{ headerShown: false }}
      />
      {sharedScreens(ProductsNav as AnyStack, t)}
    </ProductsNav.Navigator>
  );
}

export function InboxStack() {
  const t = useT();
  return (
    <InboxNav.Navigator screenOptions={screenOptions}>
      <InboxNav.Screen
        name="InboxMain"
        component={NotificationCenterScreen}
        options={{ headerShown: false }}
      />
      {sharedScreens(InboxNav as AnyStack, t)}
    </InboxNav.Navigator>
  );
}

export function MoreStack() {
  const t = useT();
  return (
    <MoreNav.Navigator screenOptions={screenOptions}>
      <MoreNav.Screen
        name="MoreMain"
        component={MoreScreen}
        options={{ headerShown: false }}
      />
      {sharedScreens(MoreNav as AnyStack, t)}
      {env.diagnosticsEnabled ? (
        <MoreNav.Screen
          name="Diagnostics"
          component={DiagnosticsScreen}
          options={{ title: t('diag.title') }}
        />
      ) : null}
    </MoreNav.Navigator>
  );
}
