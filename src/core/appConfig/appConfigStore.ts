/**
 * The remote app configuration as the app holds it: the latest `/app/config` result, persisted so
 * a slow or offline launch still knows the minimum version.
 *
 * - Launch reads the saved config first (instant), then refreshes from the network.
 * - A failed refresh keeps what was there; it never blocks the app.
 * - Returning to the foreground re-checks at most once every 15 minutes.
 *
 * A request the API refuses with 503 MAINTENANCE_MODE is not a launch block: maintenance pauses
 * writes only, so it surfaces as an inline message (maintenanceBlock.ts) and a refreshed notice
 * banner, and the app keeps working.
 */
import {
  onSellerEvent,
  updateVerdict,
  type AppConfig,
  type UpdateVerdict,
} from '@tradevistar/seller-api';
import { appVersion } from '@/core/device/deviceInfo';
import { logger } from '@/core/logger';
import { showMaintenanceBlock } from './maintenanceBlock';
import {
  deviceStorage,
  DeviceKeys,
  readJson,
  writeJson,
} from '@/core/storage/kv';
import { createStore, useStore } from '@/core/store';
import {
  bundledAppConfig,
  loadAppConfig,
  type ResolvedAppConfig,
} from './appConfigService';

export const FOREGROUND_RECHECK_MS = 15 * 60_000;
/** The splash never waits longer than this for config or session restore. */
export const SPLASH_CAP_MS = 4_000;

export interface AppConfigState {
  resolved: ResolvedAppConfig;
  /** When the network last answered (0 = never this launch). */
  checkedAt: number;
  checking: boolean;
  lastError: string | null;
}

export function resolveConfig(
  config: AppConfig,
  source: ResolvedAppConfig['source'],
  installed = appVersion,
): ResolvedAppConfig {
  return {
    config,
    source,
    verdict: updateVerdict(installed, config),
    installedVersion: installed,
  };
}

function initialState(): AppConfigState {
  const saved = readJson<AppConfig>(deviceStorage, DeviceKeys.lastAppConfig);
  const resolved =
    saved && typeof saved.minSupportedVersion === 'string'
      ? resolveConfig({ ...bundledAppConfig(), ...saved }, 'saved')
      : resolveConfig(bundledAppConfig(), 'bundled');
  return {
    resolved,
    checkedAt: 0,
    checking: false,
    lastError: null,
  };
}

export const appConfigStore = createStore<AppConfigState>(initialState());

let inFlight: Promise<AppConfigState> | null = null;

/** Fetches `/app/config`. Concurrent callers share one request. Never rejects. */
export function refreshAppConfig(): Promise<AppConfigState> {
  if (inFlight) return inFlight;
  appConfigStore.set(previous => ({ ...previous, checking: true }));
  inFlight = loadAppConfig()
    .then(resolved => {
      if (resolved.source === 'server') {
        writeJson(deviceStorage, DeviceKeys.lastAppConfig, resolved.config);
        deviceStorage.set(DeviceKeys.lastAppConfigAt, Date.now());
      }
      appConfigStore.set(previous => ({
        ...previous,
        resolved,
        checkedAt: Date.now(),
        checking: false,
        lastError: null,
      }));
      return appConfigStore.get();
    })
    .catch(error => {
      logger.info('[config] refresh failed; keeping the last config', error);
      appConfigStore.set(previous => ({
        ...previous,
        checking: false,
        lastError: error instanceof Error ? error.message : String(error),
      }));
      return appConfigStore.get();
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Re-checks on foreground, at most once per FOREGROUND_RECHECK_MS. */
export function refreshAppConfigIfStale(now = Date.now()): void {
  const { checkedAt } = appConfigStore.get();
  if (now - checkedAt >= FOREGROUND_RECHECK_MS) void refreshAppConfig();
}

let maintenanceWired = false;

/** Shows the paused-for-maintenance message when the API refuses a write with 503 MAINTENANCE_MODE. */
export function wireMaintenanceEvents(): void {
  if (maintenanceWired) return;
  maintenanceWired = true;
  onSellerEvent('notices:maintenance-paused', detail => {
    const details = detail?.details as { endsAt?: unknown } | undefined;
    showMaintenanceBlock(
      detail?.message ?? null,
      typeof details?.endsAt === 'string' ? details.endsAt : null,
    );
  });
}

export function useAppConfigState(): AppConfigState {
  return useStore(appConfigStore);
}

/** Remote feature switches; unknown keys are off. */
export function useFeatureFlags(): Record<string, boolean> {
  return useStore(appConfigStore).resolved.config.features ?? {};
}

// ── Launch decisions ─────────────────────────────────────────────────────────

export type LaunchScreen = 'forceUpdate' | 'maintenance' | 'main';

export interface LaunchDecision {
  screen: LaunchScreen;
  /** Show the dismissible "new version" card. */
  optionalUpdate: boolean;
}

/**
 * What the app shows once the splash ends. Force update beats maintenance (an old app might not
 * even understand the maintenance message of a newer API), and both beat everything else.
 */
export function decideLaunch(state: {
  resolved: Pick<ResolvedAppConfig, 'verdict' | 'config'>;
}): LaunchDecision {
  if (state.resolved.verdict === 'force') {
    return { screen: 'forceUpdate', optionalUpdate: false };
  }
  if (state.resolved.config.maintenance?.active) {
    return { screen: 'maintenance', optionalUpdate: false };
  }
  return {
    screen: 'main',
    optionalUpdate: state.resolved.verdict === 'optional',
  };
}

export type { UpdateVerdict };
