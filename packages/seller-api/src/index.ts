/**
 * @tradevistar/seller-api — the seller app's API client and endpoint functions. Nothing in here
 * may touch React Native or the DOM: the package compiles without DOM types, so it is guaranteed
 * to run anywhere `fetch` does.
 */

// HTTP
export * from "./http/config";
export * from "./http/client";
export * from "./http/tokenStore";
export { tokenExpiresAt, tokenSessionId } from "./http/jwt";
export { parseSetCookie, refreshCookieName } from "./http/refreshCookie";
export * from "./events/sellerEvents";

// Endpoints
export * from "./endpoints/auth";
export * from "./endpoints/access";
export * from "./endpoints/health";
export * from "./endpoints/siteNotices";
export * from "./endpoints/onboarding";
export * from "./endpoints/reference";

// Domain
export * from "./domain/statusLabel";
export * from "./domain/version";
export * from "./domain/countryRules";
export * from "./domain/fieldInput";
export * from "./domain/identifier";
export * from "./domain/password";
export * from "./domain/registration";
export * from "./domain/siteNotices";
export * from "./domain/celebration";
export * from "./domain/verifiedAccess";
export * from "./endpoints/appConfig";
export * from "./domain/istTime";

// Phase 2: dashboard, notifications, support, search, footer
export * from "./endpoints/paged";
export * from "./endpoints/dashboard";
export * from "./endpoints/notifications";
export * from "./endpoints/support";
export * from "./endpoints/search";
export * from "./endpoints/footer";
export * from "./domain/formatMoney";
export * from "./domain/orderStatus";
export * from "./domain/badgeCounts";
export * from "./domain/notificationCategories";
export * from "./domain/notificationRoute";
export * from "./domain/notificationPrefs";
export * from "./domain/searchRoute";
export * from "./domain/searchInput";
export * from "./domain/analyticsMath";
export * from "./domain/arrival";
export * from "./domain/ticketRules";
export * from "./domain/footerBody";
export * from "./domain/display";

// Phase 3: profile, company, KYC and GST, bank, team, calendar, security
export * from "./endpoints/profile";
export * from "./endpoints/tax";
export * from "./endpoints/documents";
export * from "./endpoints/bank";
export * from "./endpoints/team";
export * from "./endpoints/calendar";
export * from "./endpoints/security";
export * from "./domain/profileDisplay";
export * from "./domain/gst";
export * from "./domain/documentRules";
export * from "./domain/formDiff";
export * from "./domain/addressRules";
export * from "./domain/teamRules";
export * from "./domain/calendarRules";
export * from "./domain/newPassword";
export * from "./domain/bankVerification";
export * from "./domain/bankRules";
export * from "./domain/profileForms";
export * from "./domain/geo";
