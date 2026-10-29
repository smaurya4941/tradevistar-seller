/**
 * The typed route list. Screens, deep links and notification taps all navigate with these names
 * and params, so a renamed screen is a compile error rather than a dead link.
 *
 * Each of the five tabs is its own stack, so a detail screen keeps the tab bar. Screens that any
 * tab can open (search, support, settings, a More-menu area…) are registered in every stack from
 * one list (`SharedScreens`): opening one from Home stays on the Home tab and Back returns there,
 * and a link that arrives from outside opens it in the More tab.
 */
import type { NavigatorScreenParams } from '@react-navigation/native';
import type {
  AddressPurpose,
  DocumentType,
  NotificationCategory,
  TicketStatus,
} from '@tradevistar/seller-api';
import type { SectionId } from './sections';

/** Query parameters a link carried (`?order=<id>`), kept for the screen that will read them. */
export type RouteQuery = Record<string, string>;

export type SupportSegment = 'tickets' | 'knowledge' | 'announcements';

/** Screens registered in every tab's stack. */
export type SharedScreens = {
  /** A More-menu area whose screens arrive in a later phase. */
  Section: { sectionId: SectionId; query?: RouteQuery };
  Search: undefined;
  Analytics: undefined;
  SupportHome: { segment?: SupportSegment } | undefined;
  SupportTickets: { status?: TicketStatus } | undefined;
  /** `orderId` is filled when the ticket is raised from an order (Phase 7). */
  NewTicket:
    | {
        orderId?: string;
        category?: string;
        subject?: string;
        message?: string;
      }
    | undefined;
  TicketThread: { ticketId: string };
  NotificationSettings: undefined;
  CommunicationSettings: undefined;
  HelpAbout: undefined;
  InfoPage: { slug: string };
  SuccessStories: undefined;
  AppSettings: undefined;
  // Profile area (Phase 3) -------------------------------------------------
  ProfileHub: undefined;
  AccountDetails: undefined;
  ContactChange: undefined;
  ChangePassword: undefined;
  BusinessDetails: undefined;
  Registrations: undefined;
  Addresses: { purpose?: AddressPurpose } | undefined;
  /** Editing when `addressId` is set; a new address otherwise. */
  AddressForm: { addressId?: string; purpose?: AddressPurpose } | undefined;
  /** The pin map; its result goes back through `mapPinResult`, never a route param. */
  MapPin: { lat?: number; lng?: number; hasAddress?: boolean } | undefined;
  TaxGst: undefined;
  TaxHistory: undefined;
  GstOwnership: undefined;
  Documents: undefined;
  /** `type` fixes the document type (opened from a slot). */
  DocumentUpload: { type?: DocumentType } | undefined;
  DocumentViewer: { mediaAssetId: string; fileName: string; mimeType: string };
  Bank: undefined;
  BankAdd: undefined;
  BankHistory: { accountId: string };
  Team: undefined;
  Invite: undefined;
  Calendar: undefined;
  WorkingHours: undefined;
  ExceptionForm: undefined;
  Security: undefined;
  Sessions: undefined;
  LoginHistory: undefined;
  TwoFactor: undefined;
  AccountClosure: undefined;
  AccountManager: undefined;
};

export type SharedScreenName = keyof SharedScreens;

export type HomeStackParamList = SharedScreens & { HomeMain: undefined };
export type OrdersStackParamList = SharedScreens & {
  /** `query` carries the status or buyer filter (Phase 7 reads it). */
  OrdersMain: { query?: RouteQuery } | undefined;
};
export type ProductsStackParamList = SharedScreens & {
  ProductsMain: { query?: RouteQuery } | undefined;
};
export type InboxStackParamList = SharedScreens & {
  InboxMain: { category?: NotificationCategory } | undefined;
};
export type MoreStackParamList = SharedScreens & {
  MoreMain: undefined;
  /** Dev and staging builds only. */
  Diagnostics: undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Orders: NavigatorScreenParams<OrdersStackParamList> | undefined;
  Products: NavigatorScreenParams<ProductsStackParamList> | undefined;
  Inbox: NavigatorScreenParams<InboxStackParamList> | undefined;
  More: NavigatorScreenParams<MoreStackParamList> | undefined;
};

export type MainTabName = keyof MainTabParamList;

export type RootStackParamList = {
  // Signed out ------------------------------------------------------------
  /** `identifier` prefills the field; `notice` is a one-line message from the screen before. */
  SignIn:
    | { identifier?: string; notice?: 'passwordReset' | 'twoFactorExpired' }
    | undefined;
  /** `requested` means a login code was already sent to `identifier` (from forgot password). */
  SignInOtp: { identifier?: string; requested?: boolean } | undefined;
  /** The challenge itself is held in memory (twoFactorChallenge.ts), never in a route param. */
  TwoFactor: undefined;
  ForgotPassword: { identifier?: string } | undefined;
  ResetPassword: { identifier: string };
  /** `onboardingInvite` is the staff invitation token from a registration link. */
  RegisterMobile: { onboardingInvite?: string } | undefined;
  RegisterEmail: undefined;
  RegisterPassword: undefined;
  RegisterBusiness: undefined;
  RegisterSubmitted: { linked: boolean };
  // Signed in or out --------------------------------------------------------
  /** A team invitation link; without a token it says the link is incomplete. */
  AcceptInvitation: { token?: string } | undefined;
  // Signed in ---------------------------------------------------------------
  /** Signed in: the five tabs. */
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
} & Pick<SharedScreens, 'HelpAbout' | 'InfoPage' | 'SuccessStories'>;

export type RootRouteName = keyof RootStackParamList;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

/** A destination the app can navigate to from anywhere (a link, a notification, a search result). */
export type AppRoute =
  | { name: 'AcceptInvitation'; params: { token?: string } }
  | { name: 'RegisterMobile'; params: { onboardingInvite?: string } }
  | { name: 'Main'; params: { screen: MainTabName; query?: RouteQuery } }
  | { name: 'Section'; params: { sectionId: SectionId; query?: RouteQuery } }
  | { name: 'Diagnostics'; params: undefined }
  | { name: 'Shared'; params: SharedRoute };

/** One of the shared screens with its params; the union keeps each name tied to its own params. */
export type SharedRoute = {
  [K in Exclude<SharedScreenName, 'Section'>]: {
    screen: K;
    params?: SharedScreens[K];
  };
}[Exclude<SharedScreenName, 'Section'>];
