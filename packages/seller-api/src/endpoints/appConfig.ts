/**
 * Remote app configuration (`GET /app/config`). The API does not serve it yet (it answers 404), so
 * the app falls back to values bundled in its env files; this is the one place to change when the
 * endpoint ships.
 */
import { api } from "../http/client";

export type AppPlatform = "android" | "ios";

export interface AppConfig {
  minSupportedVersion: string;
  latestVersion: string;
  updateUrl: string | null;
  maintenance: { active: boolean; message: string | null };
  supportEmail: string | null;
  supportPhone: string | null;
  /** Remote on/off switches, so a feature can be turned off without a release. */
  features: Record<string, boolean>;
  /** Computed by the server when it knows the caller's version. */
  forceUpdate?: boolean;
}

export const getAppConfig = (platform: AppPlatform, version: string) =>
  api.get<AppConfig>(
    `/app/config?platform=${encodeURIComponent(platform)}&version=${encodeURIComponent(version)}`,
    { skipAuth: true },
  );
