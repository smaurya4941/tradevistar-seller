import {
  compareVersions,
  formatStatusLabel,
  normalizeStatusText,
  updateVerdict,
} from "../index";

describe("formatStatusLabel", () => {
  it.each([
    ["READY_TO_SHIP", "Ready To Ship"],
    ["pending_kyc", "Pending KYC"],
    ["GST-VERIFIED", "GST Verified"],
    ["cod", "COD"],
    ["  rfq   open ", "RFQ Open"],
    ["", ""],
  ])("%s -> %s", (input, expected) => {
    expect(formatStatusLabel(input)).toBe(expected);
  });
});

describe("normalizeStatusText", () => {
  it("rewrites machine-like labels", () => {
    expect(normalizeStatusText("OUT_FOR_DELIVERY")).toBe("Out For Delivery");
    expect(normalizeStatusText("KYC")).toBe("KYC");
  });

  it("keeps authored copy as written", () => {
    expect(normalizeStatusText("In stock (12)")).toBe("In stock (12)");
    expect(normalizeStatusText("Low stock")).toBe("Low stock");
  });
});

describe("versions", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("v2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-dev", "1.0.0")).toBe(0);
  });

  it("decides force, optional and current", () => {
    const config = { minSupportedVersion: "1.2.0", latestVersion: "1.4.0" };
    expect(updateVerdict("1.1.9", config)).toBe("force");
    expect(updateVerdict("1.3.0", config)).toBe("optional");
    expect(updateVerdict("1.4.0", config)).toBe("current");
    expect(updateVerdict("1.4.0", { ...config, forceUpdate: true })).toBe("force");
  });
});
