/**
 * The profile area's screens (Phase 3), registered in every tab's stack like the other shared
 * screens. One list keeps the titles, the components and the route names together.
 */
import type { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AccountClosureScreen } from '@/features/profile/AccountClosureScreen';
import { AccountDetailsScreen } from '@/features/profile/AccountDetailsScreen';
import { AccountManagerScreen } from '@/features/profile/AccountManagerScreen';
import { AddressesScreen } from '@/features/profile/AddressesScreen';
import { AddressFormScreen } from '@/features/profile/AddressFormScreen';
import { BankAddScreen } from '@/features/profile/BankAddScreen';
import { BankHistoryScreen } from '@/features/profile/BankHistoryScreen';
import { BankScreen } from '@/features/profile/BankScreen';
import { BusinessDetailsScreen } from '@/features/profile/BusinessDetailsScreen';
import { CalendarScreen } from '@/features/profile/CalendarScreen';
import { ChangePasswordScreen } from '@/features/profile/ChangePasswordScreen';
import { ContactChangeScreen } from '@/features/profile/ContactChangeScreen';
import { DocumentsScreen } from '@/features/profile/DocumentsScreen';
import { DocumentUploadScreen } from '@/features/profile/DocumentUploadScreen';
import { DocumentViewerScreen } from '@/features/profile/DocumentViewerScreen';
import { ExceptionFormScreen } from '@/features/profile/ExceptionFormScreen';
import { GstOwnershipScreen } from '@/features/profile/GstOwnershipScreen';
import { InviteScreen } from '@/features/profile/InviteScreen';
import { LoginHistoryScreen } from '@/features/profile/LoginHistoryScreen';
import { MapPinScreen } from '@/features/profile/MapPinScreen';
import { ProfileHubScreen } from '@/features/profile/ProfileHubScreen';
import { RegistrationsScreen } from '@/features/profile/RegistrationsScreen';
import { SecurityScreen } from '@/features/profile/SecurityScreen';
import { SessionsScreen } from '@/features/profile/SessionsScreen';
import { TaxGstScreen } from '@/features/profile/TaxGstScreen';
import { TaxHistoryScreen } from '@/features/profile/TaxHistoryScreen';
import { TeamScreen } from '@/features/profile/TeamScreen';
import { TwoFactorScreen } from '@/features/profile/TwoFactorScreen';
import { WorkingHoursScreen } from '@/features/profile/WorkingHoursScreen';
import type { Translate, TranslationKey } from '@/i18n';
import type { SharedScreenName } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStack = ReturnType<typeof createNativeStackNavigator<any>>;

interface ProfileScreenDef {
  name: SharedScreenName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  title: TranslationKey;
}

export const PROFILE_SCREENS: readonly ProfileScreenDef[] = [
  { name: 'ProfileHub', component: ProfileHubScreen, title: 'profile.title' },
  {
    name: 'AccountDetails',
    component: AccountDetailsScreen,
    title: 'account.title',
  },
  {
    name: 'ContactChange',
    component: ContactChangeScreen,
    title: 'contact.title',
  },
  {
    name: 'ChangePassword',
    component: ChangePasswordScreen,
    title: 'pw.title',
  },
  {
    name: 'BusinessDetails',
    component: BusinessDetailsScreen,
    title: 'business.title',
  },
  { name: 'Registrations', component: RegistrationsScreen, title: 'reg.title' },
  { name: 'Addresses', component: AddressesScreen, title: 'addr.title' },
  {
    name: 'AddressForm',
    component: AddressFormScreen,
    title: 'addr.form.title',
  },
  { name: 'MapPin', component: MapPinScreen, title: 'pin.title' },
  { name: 'TaxGst', component: TaxGstScreen, title: 'tax.title' },
  {
    name: 'TaxHistory',
    component: TaxHistoryScreen,
    title: 'tax.history.title',
  },
  {
    name: 'GstOwnership',
    component: GstOwnershipScreen,
    title: 'gst.own.title',
  },
  { name: 'Documents', component: DocumentsScreen, title: 'doc.title' },
  {
    name: 'DocumentUpload',
    component: DocumentUploadScreen,
    title: 'doc.upload.title',
  },
  {
    name: 'DocumentViewer',
    component: DocumentViewerScreen,
    title: 'doc.viewer.title',
  },
  { name: 'Bank', component: BankScreen, title: 'bank.title' },
  { name: 'BankAdd', component: BankAddScreen, title: 'bank.add.title' },
  {
    name: 'BankHistory',
    component: BankHistoryScreen,
    title: 'bank.history.title',
  },
  { name: 'Team', component: TeamScreen, title: 'team.title' },
  { name: 'Invite', component: InviteScreen, title: 'team.invite.title' },
  { name: 'Calendar', component: CalendarScreen, title: 'cal.title' },
  { name: 'WorkingHours', component: WorkingHoursScreen, title: 'cal.hours' },
  {
    name: 'ExceptionForm',
    component: ExceptionFormScreen,
    title: 'cal.exceptionAdd',
  },
  { name: 'Security', component: SecurityScreen, title: 'sec.title' },
  { name: 'Sessions', component: SessionsScreen, title: 'sessions.title' },
  {
    name: 'LoginHistory',
    component: LoginHistoryScreen,
    title: 'history.title',
  },
  { name: 'TwoFactor', component: TwoFactorScreen, title: 'tf.title' },
  {
    name: 'AccountClosure',
    component: AccountClosureScreen,
    title: 'closure.title',
  },
  {
    name: 'AccountManager',
    component: AccountManagerScreen,
    title: 'manager.title',
  },
];

export function profileScreens(Stack: AnyStack, t: Translate) {
  return (
    <>
      {PROFILE_SCREENS.map(screen => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{ title: t(screen.title) }}
        />
      ))}
    </>
  );
}
