/**
 * Every user-visible string in the seller app. English only for now; the shape is already
 * per-language (`Record<Language, ...>`), so adding Hindi later means adding a second object
 * with the same keys, not touching a screen.
 *
 * `{name}` placeholders are filled by `t`. Keys are grouped by feature with a dotted prefix.
 */
import { phase2En } from './phase2Messages';
import { phase3En } from './phase3Messages';

const en = {
  ...phase2En,
  ...phase3En,
  // Shared
  'common.tryAgain': 'Try again',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
  'common.dismiss': 'Dismiss',
  'common.openInBrowser': 'Open on the web',
  'common.loading': 'Loading…',
  'common.copy': 'Copy',
  'common.back': 'Back',
  'common.continue': 'Continue',
  'common.change': 'Change',
  'common.offlineForm':
    'You are offline. Your entries are kept — try again when you reconnect.',

  // App shell
  'app.name': 'TradeVistar Seller',
  'app.crashTitle': 'Something went wrong',
  'app.crashBody':
    'The app hit an unexpected problem. We have been told about it. Try again, or restart the app if it keeps happening.',
  'offline.banner': 'You are offline',
  'launch.tagline': 'Sell to businesses across India',

  // Force update and maintenance
  'update.title': 'Update required',
  'update.body':
    'This version ({installed}) is no longer supported. Please update to version {min} or newer to keep selling.',
  'update.noStore':
    'Ask your TradeVistar contact for the latest version of the app.',
  'update.action': 'Update the app',
  'maintenance.title': 'Scheduled maintenance',
  'maintenance.body':
    'TradeVistar is being updated. Your data is safe. Please try again in a little while.',
  'maintenance.until': 'Expected back by {when}.',
  'maintenance.stillOn': 'Maintenance is still in progress.',

  // Navigation
  'tabs.home': 'Home',
  'tabs.orders': 'Orders',
  'tabs.products': 'Products',
  'tabs.inbox': 'Inbox',
  'tabs.more': 'More',

  // Placeholders (screens arrive in later phases)
  'placeholder.home.title': 'Home',
  'placeholder.home.body':
    'Your sales dashboard will appear here: orders to ship, enquiries waiting for a reply and your earnings.',
  'placeholder.orders.title': 'Orders',
  'placeholder.orders.body':
    'Bulk orders, sample orders and shipping will be managed here.',
  'placeholder.products.title': 'Products',
  'placeholder.products.body':
    'Your catalogue, prices and stock will be managed here.',
  'placeholder.inbox.title': 'Inbox',
  'placeholder.inbox.body':
    'Buyer messages and notifications will arrive here.',
  'placeholder.section.body':
    'This section is not in the app yet. You can use it on the seller web portal in the meantime.',
  'placeholder.signedInAs': 'Signed in as {name}',

  // More menu
  'more.title': 'More',
  'more.group.catalog': 'Catalog',
  'more.group.sales': 'Sales',
  'more.group.money': 'Money',
  'more.group.marketing': 'Marketing',
  'more.group.company': 'Profile and company',
  'more.group.support': 'Support and settings',
  'more.item.categories': 'Categories',
  'more.item.brands': 'Brands',
  'more.item.inventory': 'Inventory',
  'more.item.rfqs': 'Requests for sourcing',
  'more.item.inquiries': 'Buyer inquiries',
  'more.item.sampleOrders': 'Sample orders',
  'more.item.quotations': 'Quotations',
  'more.item.reviews': 'Reviews',
  'more.item.analytics': 'Analytics',
  'more.item.payments': 'Payments',
  'more.item.wallet': 'Wallet',
  'more.item.subscription': 'Subscription plan',
  'more.item.adsCampaigns': 'Ads campaigns',
  'more.item.promotions': 'Promotions',
  'more.item.couponsOffers': 'Coupons and offers',
  'more.item.bannerAds': 'Banner ads',
  'more.item.popupBanners': 'Popup banner',
  'more.item.brandStore': 'Brand store',
  'more.item.profile': 'My profile',
  'more.item.exportDocuments': 'Export documents',
  'more.item.support': 'Support',
  'more.item.notifications': 'Notifications',
  'more.item.settings': 'Settings',
  'more.item.diagnostics': 'Diagnostics',
  'more.signOut': 'Sign out',
  'more.signOut.title': 'Sign out of TradeVistar?',
  'more.signOut.body':
    'You will need your password to sign in again on this phone.',

  // Sign-in
  'auth.title': 'Seller sign in',
  'auth.subtitle': 'Sign in to manage your TradeVistar store.',
  'auth.identifier': 'Email or mobile number',
  'auth.identifier.placeholder': 'you@company.com',
  'auth.password': 'Password',
  'auth.password.show': 'Show password',
  'auth.password.hide': 'Hide password',
  'auth.signIn': 'Sign in',
  'auth.required.identifier': 'Enter your email or mobile number.',
  'auth.required.password': 'Enter your password.',
  'auth.rememberMe': 'Keep me signed in',
  'auth.forgotPassword': 'Forgot password?',
  'auth.signInWithOtp': 'Sign in with a code instead',
  'auth.signInWithPassword': 'Sign in with password instead',
  'auth.createAccount': 'New to TradeVistar?',
  'auth.createAccount.action': 'Create a seller account',
  'auth.invalidIdentifier': 'Enter a valid email address or mobile number.',
  'auth.invitation.hint':
    'Sign in with the email address the invitation was sent to.',
  'auth.passwordUpdated': 'Password updated. Sign in with your new password.',
  'auth.locked.help': 'You can reset your password, or ask support to help.',
  'auth.contactSupport': 'Contact support',
  'auth.resetPassword': 'Reset password',
  'auth.cooldown': 'Try again in {seconds}s',
  'auth.backToSignIn': 'Back to sign in',

  // Sign in with a code
  'auth.otp.title': 'Sign in with a code',
  'auth.otp.subtitle':
    'We will send a 6-digit code to your registered email or mobile number.',
  'auth.otp.send': 'Send code',
  'auth.otp.invalid': 'Invalid or expired code.',
  'auth.otp.incomplete': 'Enter the 6-digit code.',
  'auth.otp.sentTo': 'We sent a 6-digit code to {target}.',
  'auth.otp.change': 'Change email/mobile',
  'auth.otp.verify': 'Verify and sign in',
  'auth.otp.label': '6-digit code',
  'auth.otp.progress': '{count} of 6 digits entered',
  'auth.otp.resendIn': 'Resend in {seconds}s',
  'auth.otp.resend': 'Resend code',
  'auth.otp.resent': 'A new code is on its way.',
  'auth.otp.hint': 'Codes are valid for a few minutes. Do not share them.',

  // Two-factor
  'auth.twoFactor.title': 'Two-step verification',
  'auth.twoFactor.sms':
    'Your password was accepted. Enter the code we sent by SMS to {destination}.',
  'auth.twoFactor.email':
    'Your password was accepted. Enter the code we sent by email to {destination}.',
  'auth.twoFactor.verify': 'Verify and sign in',
  'auth.twoFactor.cancel': 'Cancel and go back',
  'auth.twoFactor.expired': 'Your sign-in took too long. Start again.',
  'auth.twoFactor.expiresIn': 'This sign-in expires in {time}.',

  // Passwords
  'password.required': 'Enter a password.',
  'password.min': 'Use at least {count} characters.',
  'password.max': 'Use at most {count} characters.',
  'password.mismatch': 'Passwords do not match.',
  'password.show': 'Show password',
  'password.hide': 'Hide password',

  // Forgot and reset password
  'forgot.title': 'Forgot your password?',
  'forgot.subtitle':
    'Enter your email or mobile number and we will send a 6-digit reset code.',
  'forgot.send': 'Send reset code',
  'forgot.useOtp': 'Sign in with a code instead',
  'forgot.codeTitle': 'Enter the reset code',
  'forgot.codeSent': 'Code sent to your registered {kind}.',
  'forgot.kind.email': 'email',
  'forgot.kind.mobile': 'mobile number',
  'forgot.codeContinue': 'Continue',
  'forgot.passwordTitle': 'Choose a new password',
  'forgot.newPassword': 'New password',
  'forgot.confirmPassword': 'Confirm new password',
  'forgot.save': 'Update password',
  'forgot.codeRejected':
    'That code was not accepted. Check it or request a new one; your new password is kept.',
  'forgot.changeCode': 'Change code',

  // Registration
  'register.title': 'Create a seller account',
  'register.step': 'Step {current} of {total}',
  'register.mobile.title': 'Verify your mobile number',
  'register.mobile.label': 'Mobile number',
  'register.mobile.placeholder': '10-digit mobile number',
  'register.email.title': 'Verify your email',
  'register.email.label': 'Business email',
  'register.email.placeholder': 'you@company.com',
  'register.email.invalid': 'Enter a valid email address.',
  'register.getOtp': 'Get OTP',
  'register.resendOtp': 'Resend OTP',
  'register.verified': 'Verified',
  'register.verifying': 'Verifying…',
  'register.enterOtp.mobile': 'Enter the OTP sent to your mobile number',
  'register.enterOtp.email': 'Enter the OTP sent to your email',
  'register.otpFailed': 'Incorrect code. Try again.',
  'register.sendFailed': 'Could not send OTP. Try again.',
  'register.locked':
    'The number is locked once a code is sent. Change it to start again.',
  'register.change': 'Change',
  'register.linked.withPassword':
    'You already have a TradeVistar account with this mobile number or email. Seller access will be added to it. After approval, sign in to the seller app with your existing password or a mobile OTP.',
  'register.linked.noPassword':
    'You already use TradeVistar as a buyer with this mobile number or email. Seller access will be added to the same account — create a password below for the seller app. Your buyer sign-in does not change.',
  'register.password.title': 'Create a password',
  'register.password.label': 'Create password',
  'register.password.confirm': 'Confirm password',
  'register.password.hint': 'At least 8 characters.',
  'register.business.title': 'About your business',
  'register.business.company': 'Company name',
  'register.business.companyRequired': 'Company name is required.',
  'register.business.gstin': 'GSTIN (optional)',
  'register.business.gstinHint': '15 characters, e.g. 27AAPFU0939F1ZV',
  'register.business.country': 'Business country',
  'register.business.countryRequired': 'Please select your business country.',
  'register.business.category': 'Business category (optional)',
  'register.business.categoryNone': 'No category selected',
  'register.business.pickCountry': 'Select a country',
  'register.business.pickCategory': 'Select a category',
  'register.business.search': 'Search',
  'register.business.noResults': 'No matches',
  'register.business.listFailed': 'Could not load the list. Try again.',
  'register.submit': 'Submit for approval',
  'register.terms.prefix': 'By continuing you agree to our ',
  'register.terms.terms': 'Terms of Service',
  'register.terms.and': ' and ',
  'register.terms.privacy': 'Privacy Policy',
  'register.ticketRejected':
    'Your verification has expired or was already used. Verify again to continue.',
  'register.ticketExpired.mobile':
    'Your mobile verification expired. Verify your number again.',
  'register.ticketExpired.email':
    'Your email verification expired. Verify your email again.',
  'register.failed': 'Registration failed. Please try again.',
  'register.invite.failed': 'This onboarding invitation could not be loaded.',
  'register.invite.applied':
    'We filled in the details from your invitation. Verify your mobile and email to continue.',
  'register.submitted.title': 'Registration submitted',
  'register.submitted.body':
    'Your seller account is awaiting approval from the TradeVistar team. Once it is approved you will be notified, and you can sign in with your mobile number (OTP) or your password.',
  'register.submitted.linked':
    'Seller access was added to your existing TradeVistar account. Your buyer account keeps working exactly as before.',
  'register.submitted.action': 'Back to sign in',

  // Approval
  'approval.pending.title': 'Your account is waiting for approval',
  'approval.pending.fallback':
    'Your seller account is pending approval. You can sign in once it is approved.',
  'approval.pending.step1':
    'The TradeVistar team is reviewing your registration.',
  'approval.pending.step2':
    'We will notify you as soon as there is a decision.',
  'approval.pending.step3': 'Then sign in with your password or a mobile code.',
  'approval.pending.retry': 'Try signing in again',
  'approval.rejected.title': 'Your registration was not approved',
  'approval.rejected.fallback':
    'Your seller registration was not approved. Contact TradeVistar support.',
  'approval.contactSupport': 'Contact support',
  'approval.useAnother': 'Use another account',

  // Team invitation
  'invite.incomplete.title': 'Invitation link is incomplete',
  'invite.incomplete.body':
    'Open the link exactly as it appears in your invitation email, or ask your team admin to resend it.',
  'invite.signedOut.title': 'You have been invited to a team',
  'invite.signedOut.body':
    'Sign in with the email address the invitation was sent to. New to TradeVistar? Create a seller account first, then open the invitation link again.',
  'invite.signIn': 'Sign in',
  'invite.createAccount': 'Create a seller account',
  'invite.join.title': "Join this company's team",
  'invite.join.body':
    'You are signed in as {email}. Accepting makes this company your active workspace.',
  'invite.join.account': 'your account',
  'invite.accept': 'Accept invitation',
  'invite.switch': 'Use a different account',
  'invite.accepted.title': 'Welcome to the team',
  'invite.accepted.body': 'Taking you to your dashboard…',
  'invite.failed': 'That invitation could not be accepted.',
  'invite.back': 'Back',

  // View only until verified
  'access.banner.title': 'Your account is awaiting verification — view only',
  'access.banner.body':
    'You can see your whole dashboard, but you cannot add or change anything until TradeVistar verifies your KYC. You can still update My Profile.',
  'access.status.PENDING': 'Upload your KYC documents to get verified.',
  'access.status.SUBMITTED':
    'Your documents are submitted and under review by TradeVistar.',
  'access.status.REJECTED':
    'Your KYC was not approved. Please re-upload the requested documents.',
  'access.complete': 'Complete verification',
  'access.sheet.title': 'Verification required',
  'access.sheet.body':
    'This action unlocks once TradeVistar verifies your KYC documents. You can still update My Profile and upload documents.',
  'access.sheet.close': 'Not now',

  // Platform notices
  'notice.label.announcement': 'Announcement',
  'notice.label.maintenance': 'Maintenance',
  'notice.label.upcomingMaintenance': 'Upcoming maintenance',
  'notice.startsIn': 'Starts in {time}',
  'notice.backBy': 'Back by {when}',
  'notice.inProgress': 'In progress',
  'notice.eventIn': '{when} · in {time}',
  'notice.dur.daysHours': '{days}d {hours}h',
  'notice.dur.hoursMinutes': '{hours}h {minutes}m',
  'notice.dur.minutes': '{minutes}m',
  'notice.dur.underMinute': 'under a minute',
  'notice.starts': 'Starts',
  'notice.ends': 'Ends',
  'notice.endsOpen': 'When the work is done',
  'notice.date': 'Date',
  'notice.pausedAll':
    'You can keep browsing, but actions such as saving and sending are paused during this window.',
  'notice.pausedSome':
    'Paused during this window: {features}. Everything else works as usual.',
  'notice.dismiss': 'Dismiss notice',
  'notice.position': '{index} of {count}',
  'notice.openA11y': '{label}: {title}. Double tap for details.',
  'notice.sheetClose': 'Close',
  'maintenance.paused.title': 'Paused for maintenance',
  'maintenance.paused.body':
    'This action is paused for maintenance. You can keep browsing in the meantime.',
  'maintenance.availableAt': 'Available again at {when}.',

  // Celebrations
  'cel.LAUNCH': "We're live!",
  'cel.NEW_FEATURE': 'Something new just landed',
  'cel.EVENT': "It's happening now!",
  'cel.FESTIVAL': 'Happy celebrations!',
  'cel.SALE': 'The sale is live!',
  'cel.close': 'Close celebration',
  'auth.reason.expired': 'Your session has ended. Please sign in again.',
  'auth.reason.roleRejected':
    'That account is not a seller account, so it was signed out.',
  'auth.reason.signedOut': 'You have been signed out.',
  'auth.offline.title': 'No connection',
  'auth.offline.body':
    'You are still signed in. We will reconnect as soon as the network is back.',

  // Errors
  'error.generic': 'Something went wrong. Please try again.',
  'error.network':
    'We could not reach TradeVistar. Check your connection and try again.',
  'error.server': 'TradeVistar is having a problem. Please try again shortly.',
  'error.invalidCredentials': 'Invalid credentials.',
  'error.locked':
    'This account is temporarily locked after too many attempts. Try again later.',
  'error.suspended':
    'This account has been suspended. Please contact TradeVistar support.',
  'error.notSeller':
    'This account is not a seller account. Sign in with a seller account.',
  'error.tooManyAttempts': 'Too many attempts. Wait a minute and try again.',
  'error.sellerApprovalPending':
    'Your seller registration is waiting for approval. We will let you know once it is approved.',
  'error.sellerRejected':
    'Your seller registration was not approved. Please contact TradeVistar support.',
  'error.verificationRequired':
    'Complete your KYC verification to use this feature.',
  'error.maintenance':
    'This action is paused for scheduled maintenance. Please try again later.',
  'error.maintenanceUntil':
    'This action is paused for scheduled maintenance until {when}.',
  'error.featureNotAvailable':
    'This feature is not included in your subscription plan.',
  'error.uploadTooLarge':
    'That file is too large to upload. Choose a smaller file.',

  // Feature-locked banner
  'locked.viewOnly.title': 'View-only until you are verified',
  'locked.viewOnly.body':
    'You can browse your account, but changes unlock once KYC verification is complete.',
  'locked.viewOnly.action': 'Complete KYC',
  'locked.feature.title': 'Not in your plan',
  'locked.feature.body': 'Upgrade your subscription plan to use this feature.',
  'locked.feature.action': 'View plans',

  // Status badge
  'status.unknown': 'Unknown',

  // Diagnostics
  'diag.title': 'Diagnostics',
  'diag.env': 'Environment',
  'diag.health': 'Server health',
  'diag.health.check': 'Check now',
  'diag.session': 'Session',
  'diag.session.user': 'Signed-in user',
  'diag.session.roles': 'Roles',
  'diag.session.accessExpires': 'Access token expires',
  'diag.session.refreshFingerprint': 'Refresh token fingerprint',
  'diag.session.none': 'None',
  'diag.actions': 'Token tests',
  'diag.discardAccess': 'Discard access token',
  'diag.refreshNow': 'Refresh now',
  'diag.callApi': 'Call /auth/me',
  'diag.callApiFive': 'Call /auth/me ×5 at once',
  'diag.sentryTest': 'Send Sentry test event',
  'diag.build': 'App version and build',
  'diag.realtime': 'Realtime and notifications',
  'diag.localAlert': 'Show a local test alert',
  'diag.result': 'Last result',
} as const;

export type AppMessageKey = keyof typeof en;
export type Language = 'en';

export const appMessages: Record<Language, Record<AppMessageKey, string>> = {
  en,
};
