/**
 * Typed access to the build's environment (react-native-config reads the flavor's .env file into
 * the native build). Everything else in the app imports from here, never from Config directly, so
 * a missing or malformed value fails loudly at startup instead of as a confusing network error.
 */
import Config from 'react-native-config';

export type AppEnv = 'development' | 'staging' | 'production';

const APP_ENVS: readonly AppEnv[] = ['development', 'staging', 'production'];

function read(name: string): string | undefined {
  const value = (Config as Record<string, string | undefined>)[name];
  return value && value.trim() ? value.trim() : undefined;
}

function url(name: string, fallback?: string): string {
  const value = read(name) ?? fallback;
  if (!value || !/^https?:\/\/[^\s/]+/i.test(value)) {
    throw new Error(
      `${name} must be an absolute http(s) URL; check the flavor's .env file.`,
    );
  }
  return value.replace(/\/+$/, '');
}

function optionalUrl(name: string): string | null {
  return read(name) ? url(name) : null;
}

function appEnv(): AppEnv {
  const value = read('APP_ENV') as AppEnv | undefined;
  return value && APP_ENVS.includes(value) ? value : 'development';
}

const APP_ENV = appEnv();
const API_BASE_URL = url('API_BASE_URL', 'http://10.0.2.2:4000');
const WEB_URL = url('WEB_URL', 'https://seller.tradevistar.com');

export const env = Object.freeze({
  appEnv: APP_ENV,
  isProduction: APP_ENV === 'production',
  /** Dev tools (the Diagnostics screen) ship in dev and staging builds only. */
  diagnosticsEnabled: APP_ENV !== 'production',
  apiBaseUrl: API_BASE_URL,
  socketUrl: url('SOCKET_URL', API_BASE_URL),
  /** The seller web portal's origin: App Links and "open on web" links. */
  webUrl: WEB_URL,
  sentryDsn: read('SENTRY_DSN') ?? null,
  /**
   * Whether usage events go to Google Analytics. On in staging and production unless
   * `ANALYTICS_ENABLED=false`; off in development unless `ANALYTICS_ENABLED=true`.
   */
  analyticsEnabled:
    (
      read('ANALYTICS_ENABLED') ??
      (APP_ENV === 'development' ? 'false' : 'true')
    ).toLowerCase() === 'true',
  /** Empty until the phase that adds maps. */
  mapsEnabled: Boolean(read('GOOGLE_MAPS_API_KEY')),
  supportEmail: read('SUPPORT_EMAIL') ?? 'support@tradevistar.com',
  supportPhone: read('SUPPORT_PHONE') ?? null,
  /** Shown beside the support contact buttons; edit per flavor in .env. */
  supportHours: read('SUPPORT_HOURS') ?? 'Mon-Sat, 9:00 am to 6:00 pm IST',
  termsUrl: optionalUrl('TERMS_URL') ?? `${WEB_URL}/info/terms-of-use`,
  privacyUrl: optionalUrl('PRIVACY_URL') ?? `${WEB_URL}/info/privacy-policy`,
  helpUrl: optionalUrl('HELP_URL') ?? `${WEB_URL}/info/help-support`,
  /** Used only until the API serves GET /app/config. */
  fallbackConfig: {
    minSupportedVersion: read('MIN_SUPPORTED_VERSION') ?? '1.0.0',
    latestVersion: read('LATEST_VERSION') ?? '1.0.0',
    updateUrl: optionalUrl('PLAY_STORE_URL'),
  },
});
