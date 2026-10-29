/**
 * Remote app configuration and the force-update verdict.
 *
 * Reads `GET /app/config`. The API does not serve it yet (it answers 404), so the flavor's env
 * values are used instead, labelled as such on Diagnostics. The call is isolated here: when the
 * endpoint ships, nothing else in the app changes.
 */
import {
  ApiError,
  getAppConfig,
  updateVerdict,
  type AppConfig,
  type UpdateVerdict,
} from '@tradevistar/seller-api';
import { env } from '@/config/env';
import { appVersion, platformKey } from '@/core/device/deviceInfo';

export interface ResolvedAppConfig {
  config: AppConfig;
  /** server: fetched now; saved: the last server answer, from this device; bundled: env fallback. */
  source: 'server' | 'saved' | 'bundled';
  verdict: UpdateVerdict;
  installedVersion: string;
}

export function bundledAppConfig(): AppConfig {
  return {
    minSupportedVersion: env.fallbackConfig.minSupportedVersion,
    latestVersion: env.fallbackConfig.latestVersion,
    updateUrl: env.fallbackConfig.updateUrl,
    maintenance: { active: false, message: null },
    supportEmail: env.supportEmail,
    supportPhone: env.supportPhone,
    features: {},
  };
}

export async function loadAppConfig(): Promise<ResolvedAppConfig> {
  let config: AppConfig;
  let source: ResolvedAppConfig['source'];
  try {
    config = await getAppConfig(platformKey, appVersion);
    source = 'server';
  } catch (error) {
    // Anything but "not deployed yet" is a real failure the caller should see and retry.
    if (!(error instanceof ApiError && error.statusCode === 404)) throw error;
    config = bundledAppConfig();
    source = 'bundled';
  }
  return {
    config,
    source,
    verdict: updateVerdict(appVersion, config),
    installedVersion: appVersion,
  };
}
