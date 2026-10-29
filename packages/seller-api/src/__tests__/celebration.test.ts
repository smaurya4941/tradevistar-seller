import {
  CELEBRATED_MEMORY,
  celebrationPlans,
  parseCelebrationKind,
  rememberCelebrated,
} from "../domain/celebration";

const NOW = Date.parse("2026-10-11T10:00:00Z");
const MIN = 60_000;

const notice = (patch: Record<string, unknown> = {}) => ({
  id: "n1",
  title: "Launch day",
  message: "We are live",
  eventAt: new Date(NOW + 10 * MIN).toISOString(),
  celebration: "LAUNCH",
  celebrationMinutes: 2,
  ...patch,
});

describe("celebration plans", () => {
  it("plans an announcement with a known kind and an event time", () => {
    const [plan] = celebrationPlans([notice()], NOW, []);
    expect(plan).toMatchObject({
      id: "n1",
      kind: "LAUNCH",
      title: "Launch day",
      message: "We are live",
      startsAt: NOW + 10 * MIN,
      untilAt: NOW + 12 * MIN,
    });
  });

  it("plays what is left when the app opens part-way through", () => {
    const plans = celebrationPlans([notice({ eventAt: new Date(NOW - MIN).toISOString() })], NOW, []);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.untilAt).toBe(NOW + MIN);
  });

  it("plays nothing once the window is over", () => {
    expect(celebrationPlans([notice({ eventAt: new Date(NOW - 5 * MIN).toISOString() })], NOW, [])).toEqual([]);
  });

  it("plays nothing that this device has already celebrated", () => {
    expect(celebrationPlans([notice()], NOW, ["n1"])).toEqual([]);
  });

  it("ignores notices without a celebration, an event time or a known kind", () => {
    expect(
      celebrationPlans(
        [
          notice({ celebration: null }),
          notice({ id: "n2", eventAt: null }),
          notice({ id: "n3", celebration: "PARADE" }),
          notice({ id: "n4", eventAt: "not a date" }),
        ],
        NOW,
        [],
      ),
    ).toEqual([]);
  });

  it("plays for one minute when the admin gave no length", () => {
    const [plan] = celebrationPlans([notice({ celebrationMinutes: undefined })], NOW, []);
    expect(plan?.untilAt).toBe(NOW + 11 * MIN);
    const [zero] = celebrationPlans([notice({ celebrationMinutes: 0 })], NOW, []);
    expect(zero?.untilAt).toBe(NOW + 11 * MIN);
  });

  it("orders plans soonest first", () => {
    const plans = celebrationPlans(
      [
        notice({ id: "late", eventAt: new Date(NOW + 30 * MIN).toISOString() }),
        notice({ id: "soon", eventAt: new Date(NOW + MIN).toISOString() }),
      ],
      NOW,
      [],
    );
    expect(plans.map((plan) => plan.id)).toEqual(["soon", "late"]);
  });
});

describe("celebration helpers", () => {
  it("knows the five kinds", () => {
    for (const kind of ["LAUNCH", "NEW_FEATURE", "EVENT", "FESTIVAL", "SALE"]) {
      expect(parseCelebrationKind(kind)).toBe(kind);
    }
    expect(parseCelebrationKind("launch")).toBeNull();
    expect(parseCelebrationKind(undefined)).toBeNull();
  });

  it("remembers the last few ids, newest last, without duplicates", () => {
    expect(rememberCelebrated(["a"], "b")).toEqual(["a", "b"]);
    expect(rememberCelebrated(["a", "b"], "a")).toEqual(["a", "b"]);
    const many = Array.from({ length: CELEBRATED_MEMORY }, (_, i) => `id${i}`);
    const next = rememberCelebrated(many, "fresh");
    expect(next).toHaveLength(CELEBRATED_MEMORY);
    expect(next.at(-1)).toBe("fresh");
    expect(next).not.toContain("id0");
  });
});
