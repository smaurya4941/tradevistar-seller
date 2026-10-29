# TradeVistar Seller

The TradeVistar seller mobile app (React Native 0.87, Android first). It talks to the existing
TradeVistar API as the `seller` portal; nothing in the backend is changed for it.

Phase 0 is the foundation: an empty but production-shaped app that builds in three flavors, signs a
seller in with a password, keeps the session across restarts, and has the shell (tabs, More menu,
placeholders) that later phases fill in.

## Requirements

- Node 22.11 or newer, JDK 17, Android Studio with an SDK and an emulator.
- The backend running locally on port 4000. The emulator reaches it at `10.0.2.2:4000`; a USB phone
  uses `adb reverse tcp:4000 tcp:4000` and `API_BASE_URL=http://localhost:4000`.
- On Windows, run Gradle with network access: the offline cache starts empty.

## First run

```sh
npm install
cp .env.example .env.development      # the real .env.* files are git-ignored
npm start                              # Metro
npm run android                        # builds and installs the dev flavor
```

## Flavors and environments

| Flavor  | Application id                      | App name                    | Env file           |
| ------- | ----------------------------------- | --------------------------- | ------------------ |
| dev     | `com.tradevistar.seller.dev`        | TradeVistar Seller Dev      | `.env.development` |
| staging | `com.tradevistar.seller.staging`    | TradeVistar Seller Staging  | `.env.staging`     |
| prod    | `com.tradevistar.seller`            | TradeVistar Seller          | `.env.production`  |

They install side by side; the dev and staging launcher icons carry a DEV / STG band
(`scripts/generate-app-icons.ps1` regenerates them).

All configuration comes from the flavor's env file through `src/config/env.ts`, the only file that
imports `react-native-config`. A missing or malformed URL fails at startup. Keys are documented in
`.env.example`.

Cleartext HTTP (needed for `10.0.2.2`) is allowed in debug builds only
(`android/app/src/debug/res/xml/network_security_config.xml`); release builds are HTTPS only.

### Release signing

Never in the repository. Set `TV_UPLOAD_STORE_FILE`, `TV_UPLOAD_STORE_PASSWORD`,
`TV_UPLOAD_KEY_ALIAS` and `TV_UPLOAD_KEY_PASSWORD` in `~/.gradle/gradle.properties` or as CI
environment variables. Without them a release build falls back to the debug key (fine locally,
rejected by Play).

### Firebase

Put each flavor's `google-services.json` in `android/app/src/<flavor>/` (git-ignored). The Google
Services plugin is applied only when one exists, so the app builds and runs without it.

## Scripts

| Script                     | What it does                                              |
| -------------------------- | --------------------------------------------------------- |
| `npm run android[:staging\|:prod]` | Build and install a flavor (debug)                |
| `npm run typecheck`        | `tsc` for the app and for `packages/seller-api`           |
| `npm run lint`             | ESLint                                                    |
| `npm test`                 | Jest: the app project and the plain-Node `seller-api` one |
| `npm run verify`           | typecheck, lint and test                                  |
| `npm run build:android:*`  | `assembleDevDebug`, `assembleStagingRelease`, `bundleProdRelease` |

## Layout

```
index.js                      entry: random-values polyfill, observability, then the app
packages/seller-api/          the API client; no React Native imports (runs under plain Node)
  src/http/                   client, token store, refresh cookie, JWT
  src/endpoints/              auth, access, appConfig, health (one file per area, added per phase)
  src/domain/                 pure rules (status labels, version gate)
src/
  config/env.ts               typed environment
  core/                       api setup, auth (session engine), storage, query, observability,
                              errors, device info, preferences, network, redaction
  design/                     tokens (light and dark), components, icons
  i18n/                       `t()` and the English messages; every visible string goes through it
  app/                        App, LaunchGate, navigation (typed routes, sections, deep links),
                              shell screens and components
  features/                   one folder per product area (auth so far)
  debug/                      Diagnostics (dev and staging builds only)
docs/BACKEND_GAPS.md          what the app works around, for the backend team
.maestro/                     end-to-end flows
```

Path aliases: `@/` is `src/`, `@tradevistar/seller-api` is `packages/seller-api/src`.
Keep component and logic file names distinct: on Windows two files that differ only by case collide.

## How the session works

The API returns the refresh token only as the `tv_refresh_seller` `Set-Cookie`. The client reads it
from the response, stores it in the Android Keystore (`src/core/storage/secureStore.ts`, writes
serialised so a rotation can never be overtaken by a stale token), keeps the access token in memory
only, and presents the refresh token explicitly on `POST /auth/refresh`.

- One refresh in flight at a time; a 401 is retried once after a refresh, then the session ends.
- After sign-in or refresh, a user without the `SELLER` role is rejected before anything is stored,
  and the server session it created is closed.
- Offline at launch keeps the stored token and shows the offline banner; only a rejected refresh
  signs the seller out.
- Logs, breadcrumbs and crash reports are scrubbed of tokens, passwords, OTPs, account numbers,
  GSTIN and PAN (`src/core/redact.ts`).

## Sign-in, registration and access (Phase 1)

Screens (signed out): `SignIn`, `SignInOtp`, `TwoFactor`, `ForgotPassword`, `ResetPassword`,
`RegisterMobile` -> `RegisterEmail` -> `RegisterPassword` (skipped when the account being joined
already has a password) -> `RegisterBusiness` -> `RegisterSubmitted`; `AcceptInvitation` opens signed
in or out. The approval screen (pending or rejected) is driven by the session state, not stored: it
shows once, and leaving it or restarting the app returns to sign-in.

- **Session engine** (`src/core/auth/sessionEngine.ts`): password, OTP and two-factor sign-in return
  an outcome (`signedIn`, `twoFactorRequired`, `approval`). A refresh refused with
  `SELLER_APPROVAL_PENDING` / `SELLER_REJECTED` ends the session with reason `approval_pending` /
  `approval_rejected`. The two-factor challenge token lives in memory only
  (`features/auth/twoFactorChallenge.ts`).
- **Registration draft** (`features/auth/registration`): identifiers and business fields are kept in
  MMKV; the password and the verification tickets are memory only.
- **Access** (`features/access`): `useAccess()` returns `verified`, `kycStatus`, `canWrite`. Every
  later phase must guard write actions with `useVerifiedWrite()` / `<VerifiedButton path=...>`; the
  list of areas an unverified seller may write to is `UNVERIFIED_WRITE_AREAS` in
  `packages/seller-api/src/domain/verifiedAccess.ts`, mirroring the backend `@AllowUnverified` routes.
- **Notices** (`features/notices`, `features/celebration`): a banner above every screen, rotating
  every 7 s, polling every 60 s. A write refused during maintenance shows an inline sheet; nobody is
  signed out.
- **Links**: `tradevistarseller://invitations/accept?token=...`,
  `https://<web host>/seller/invitations/accept?token=...` and `.../seller/register?onboardingInvite=...`.
  The https form needs `assetlinks.json` on the web host (see `docs/BACKEND_GAPS.md`).
- **Maestro**: `.maestro/phase1`; the data each flow needs is listed in `.maestro/staging.env.example`.

## Home, analytics, notifications, support, search and help (Phase 2)

Each tab is its own stack, so detail screens keep the tab bar. The screens any tab can open (Search,
Analytics, SupportHome, SupportTickets, NewTicket, TicketThread, NotificationSettings,
CommunicationSettings, HelpAbout, InfoPage, SuccessStories, AppSettings, and the More-menu
placeholders) are registered in every stack from one list (`app/navigation/TabStacks.tsx`); a link
or notification from outside opens them in the More stack (`navigationRef.navigateToRoute`). Help
and info pages also exist in the signed-out stack.

- **API layer** (`packages/seller-api`): `endpoints/{dashboard,notifications,support,search,footer}.ts`
  and pure, tested rules in `domain/` (`badgeCounts`, `notificationRoute`, `searchRoute`,
  `formatMoney`, `analyticsMath`, `arrival`, `ticketRules`, `footerBody`, `searchInput`,
  `notificationPrefs`). The Home and Analytics reads that belong to later phases (orders, RFQs,
  shipments, wallet, plan usage, products, quotes) are defined once, minimally, in `dashboard.ts`.
- **Realtime** (`core/realtime`): a socket on `/notifications` while signed in (websocket only,
  token on every attempt, backoff to 30 s) invalidates the `notifications` query family. One query,
  `GET /notifications/live`, feeds every badge; components read slices with `useBadge(key)`. A
  fallback poll runs every 30 s (10 s while the socket is down and Home or the Inbox is in front).
- **Alerts without server push** (`features/notifications/NotificationEffects.tsx`,
  `core/push`): foreground = in-app banner + the platform sound; background = a Notifee
  notification for rows flagged `metadata._push`; a cold start never alerts for old rows. The seen
  list is MMKV, capped at 2,000 ids, cleared on sign-out. Device registration (`POST /me/devices`)
  is dormant (404 is remembered for a day). The Android permission is asked only from the Push
  switch or the Inbox card, after our own explainer.
- **Home** (`features/home`): independent cards, each with its own skeleton/error/retry; the
  dashboard is requested once for the KPIs and the analytics card; lists wait for the headline
  queries; the last good answers are stored (`core/query/persistedQuery.ts`) and shown offline with
  "Updated ...".
- **Analytics** (`features/analytics`): plan gate from `GET /seller/subscription/usage`; charts in
  `design/charts` (react-native-svg, one accessible image each with a spoken summary); CSV export
  through the system share sheet.
- **Notification centre / preferences** (`features/notifications`): optimistic, batched, rolled-back
  preference saves (`preferenceSaver.ts`); communication preferences retry once on a stale version.
- **Support** (`features/support`): duplicate-protected create and reply (`writes.ts`), draft kept
  for the new-ticket form, ratings, knowledge base (one view and one helpful vote per article),
  announcements.
- **Search** (`features/search`): 300 ms debounce, 2 to 80 characters, previous request aborted.
- **Help and info** (`features/info`): footer columns, `/info/<slug>` pages, a plain-text body
  renderer (no HTML), contact form (public), success stories; the footer is fresh for 5 minutes and
  kept 24 hours so legal pages open offline.
- **Settings** (`features/settings`): preferences, sound switch, permission status, version.
  Diagnostics (dev/staging) shows the socket and device-registration state and can raise a local
  test alert.
- **Native**: `@notifee/react-native`, `@react-native-firebase/messaging` (dormant),
  `react-native-nitro-sound`, `react-native-blob-util`, `react-native-share`, plus a tiny Kotlin
  module `TVRingerMode` (silent mode) in `android/app/src/main/java/.../audio`. Android 13+
  `POST_NOTIFICATIONS` is declared and requested at run time.
- **Maestro**: `.maestro/phase2` (12 flows) and `.maestro/scripts/staff-api.js` (admin broadcast,
  ticket reply); the data each flow needs is in `.maestro/staging.env.example`.
- **Not done on purpose** (see `docs/BACKEND_GAPS.md`, rows 16 to 29): Withdraw, Export Catalog,
  Share Storefront, Appearance, account deletion, and the lead form.

## Profile, company, KYC and GST, bank, team, calendar and security (Phase 3)

Everything lives under `src/features/profile` (screens, `data.ts` for server state, `errors.ts`),
with the pure rules in `packages/seller-api` (`domain/gst.ts`, `documentRules.ts`,
`addressRules.ts`, `teamRules.ts`, `calendarRules.ts`, `bankRules.ts`, `newPassword.ts`,
`formDiff.ts`) and the endpoints in `endpoints/{profile,tax,documents,bank,team,calendar,security}.ts`.
No backend file was edited.

- **Entry points**: Home header avatar, More > My Profile, the "Complete verification" banner (opens
  Documents), the profile checklist, and notifications for `kyc.`, `verification.`,
  `gst_manual_verification.`, `bank.` and `security.` (web paths are mapped in
  `src/app/navigation/routeMapping.ts`).
- **Form kit**: `src/design/form` (form shell with a save bar that appears only when something
  changed, searchable select, phone, date, time and secure-number fields) and `src/core/forms`
  (`useVersionedForm`: send only changed fields plus the version; on a stale answer refetch and keep
  the seller's edits; `useUnsavedGuard`: the leave-without-saving prompt).
- **Files**: `src/core/files` (scanner, gallery and PDF picker, a TypeScript PDF builder, a
  two-step upload that never uploads twice, a signed-URL viewer that deletes its cache copy, the
  avatar picker). Everything stays in the app cache; nothing is written to the gallery or Downloads.
- **Sensitive screens** (Documents, KYC, GST, Bank, Security, Password) set `FLAG_SECURE` through
  the `TVSecureScreen` native module. The scrubber (`src/core/redact.ts`) also covers document
  numbers, signed URLs, invitation links and one-time codes.
- **Maps**: set `GOOGLE_MAPS_API_KEY` in the flavor env file to turn on "Set pin on map". Without it
  the map option is hidden and "Use my current location" and "Find from address" still work.
- **Session renew**: after a password change or a login contact change the phone refreshes its
  session straight away (`SessionEngine.renewSession`).
- **Maestro**: `.maestro/phase3` (14 flows). The upload flows pick PDFs from Downloads:
  `adb push .maestro/fixtures/. /sdcard/Download/`. The backend needs the development virus-scan
  setting so uploads become clean.
- **Checked by hand on a device** (they need a camera or touch): the document scanner, the avatar
  camera and crop, and dragging the map pin.
- **Gaps**: `docs/BACKEND_GAPS.md`, rows 30 to 43.

## Device test protocol (Phase 0, task 0.7)

Run on a physical Android phone with the dev or staging flavor; open **More > Diagnostics**. The
screen never shows a token, only a 6-character fingerprint of the refresh token.

1. Sign in with a password. The fingerprint appears.
2. Force-close and reopen: Home shows, no sign-in screen.
3. **Discard access token**, then **Call /auth/me**: one refresh request, the call succeeds.
4. **Discard access token**, then **Call /auth/me x5 at once**: the result line says exactly 1
   refresh request.
5. After a refresh the fingerprint changes (history shows the rotation). Use **Refresh x3 in a
   row**: no failure.
6. Sign out: `/auth/logout` is called and the Keychain entry is gone (relaunch shows sign-in).
7. Sign in on the web with the same seller, revoke the phone's session from the web security
   page, return to the app: it signs out cleanly with the "session has ended" message.
8. Sign in with a buyer-only account: rejected, nothing stored.
9. Airplane mode at launch: the stored session stays and the offline banner shows.

If step 1 or 2 fails because `Set-Cookie` is not visible to JavaScript on the device, stop: the
complete fix is a backend change (see `docs/BACKEND_GAPS.md`, item 1).

## End-to-end tests

```sh
cp .maestro/staging.env.example .maestro/staging.env   # fill in a staging seller
maestro test .maestro/phase0 --env-file .maestro/staging.env
maestro test .maestro/phase2 --env-file .maestro/staging.env
```
#   t r a d e v i s t a r - s e l l e r  
 