/**
 * Semantic-version comparison for the force-update check. Pre-release and build suffixes are
 * ignored (`1.2.0-beta.1` counts as `1.2.0`), which errs toward not blocking testers.
 */
function parts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(/[-+]/)[0]
    .split(".")
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length, 3);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type UpdateVerdict = "force" | "optional" | "current";

export function updateVerdict(
  installed: string,
  config: { minSupportedVersion: string; latestVersion: string; forceUpdate?: boolean },
): UpdateVerdict {
  if (config.forceUpdate || compareVersions(installed, config.minSupportedVersion) < 0) return "force";
  if (compareVersions(installed, config.latestVersion) < 0) return "optional";
  return "current";
}
