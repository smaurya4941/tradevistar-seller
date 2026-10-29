/**
 * The notice rules: what shows, for how long, and what the time line says. Judged on the server
 * clock, so a phone with a wrong clock still counts down correctly.
 */
import {
  clockSkew,
  durationText,
  effectiveNotices,
  isDismissible,
  nextTransitionMs,
  noticeAt,
  noticeLabel,
  noticeTiming,
  noticeTone,
  pausedSummary,
  visibleNotices,
  type SiteNotice,
} from "../index";

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.UTC(2026, 9, 9, 10, 0, 0);
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function notice(extra: Partial<SiteNotice> = {}): SiteNotice {
  return {
    id: "n1",
    kind: "ANNOUNCEMENT",
    state: "LIVE",
    title: "Diwali sale",
    message: "Starts soon",
    lockMode: null,
    pausedFeatures: [],
    startsAt: at(-HOUR),
    endsAt: null,
    eventAt: null,
    ...extra,
  };
}

const maintenance = (extra: Partial<SiteNotice> = {}) =>
  notice({ id: "m1", kind: "MAINTENANCE", lockMode: "PARTIAL", pausedFeatures: ["Checkout & payments"], ...extra });

describe("clockSkew", () => {
  it("is the server's clock minus the device's", () => {
    expect(clockSkew(at(5 * MIN), NOW)).toBe(5 * MIN);
    expect(clockSkew(at(-2 * MIN), NOW)).toBe(-2 * MIN);
  });

  it("is zero when the server time is missing or unreadable", () => {
    expect(clockSkew(undefined, NOW)).toBe(0);
    expect(clockSkew("not a date", NOW)).toBe(0);
  });
});

describe("dismissal", () => {
  it("never lets a live maintenance be put away", () => {
    expect(isDismissible(maintenance({ state: "LIVE" }))).toBe(false);
    expect(isDismissible(maintenance({ state: "UPCOMING" }))).toBe(true);
    expect(isDismissible(notice())).toBe(true);
  });

  it("hides dismissed notices except a live maintenance", () => {
    const announcement = notice({ id: "a" });
    const upcoming = maintenance({ id: "u", state: "UPCOMING" });
    const live = maintenance({ id: "l", state: "LIVE" });
    const shown = visibleNotices([announcement, upcoming, live], ["a", "u", "l"]);
    expect(shown.map((n) => n.id)).toEqual(["l"]);
  });

  it("keeps everything when nothing was dismissed", () => {
    expect(visibleNotices([notice({ id: "a" }), notice({ id: "b" })], [])).toHaveLength(2);
  });
});

describe("noticeAt", () => {
  const list = [notice({ id: "a" }), notice({ id: "b" }), notice({ id: "c" })];

  it("wraps around in both directions", () => {
    expect(noticeAt(list, 0)?.id).toBe("a");
    expect(noticeAt(list, 4)?.id).toBe("b");
    expect(noticeAt(list, -1)?.id).toBe("c");
  });

  it("is null for an empty list", () => {
    expect(noticeAt([], 3)).toBeNull();
  });
});

describe("labels and tone", () => {
  it("names each kind of notice", () => {
    expect(noticeLabel(notice())).toBe("announcement");
    expect(noticeLabel(maintenance({ state: "LIVE" }))).toBe("maintenance");
    expect(noticeLabel(maintenance({ state: "UPCOMING" }))).toBe("upcomingMaintenance");
  });

  it("makes live maintenance read as a warning", () => {
    expect(noticeTone(notice())).toBe("info");
    expect(noticeTone(maintenance({ state: "LIVE" }))).toBe("warning");
    expect(noticeTone(maintenance({ state: "UPCOMING" }))).toBe("upcoming");
  });
});

describe("noticeTiming", () => {
  it("counts down to an upcoming maintenance", () => {
    const upcoming = maintenance({ state: "UPCOMING", startsAt: at(3 * HOUR) });
    expect(noticeTiming(upcoming, NOW)).toEqual({ type: "startsIn", ms: 3 * HOUR });
  });

  it("never counts below zero", () => {
    const upcoming = maintenance({ state: "UPCOMING", startsAt: at(-MIN) });
    expect(noticeTiming(upcoming, NOW)).toEqual({ type: "startsIn", ms: 0 });
  });

  it("says when a live maintenance is expected to end, or that it is in progress", () => {
    expect(noticeTiming(maintenance({ endsAt: at(HOUR) }), NOW)).toEqual({ type: "backBy", at: at(HOUR) });
    expect(noticeTiming(maintenance({ endsAt: null }), NOW)).toEqual({ type: "inProgress" });
  });

  it("counts down an announcement only while its event is still ahead", () => {
    expect(noticeTiming(notice({ eventAt: at(2 * HOUR) }), NOW)).toEqual({
      type: "eventIn",
      at: at(2 * HOUR),
      ms: 2 * HOUR,
    });
    expect(noticeTiming(notice({ eventAt: at(-MIN) }), NOW)).toBeNull();
    expect(noticeTiming(notice(), NOW)).toBeNull();
  });
});

describe("durationText", () => {
  it("picks the unit the way the web does", () => {
    expect(durationText(2 * 24 * HOUR + 4 * HOUR)).toMatchObject({ unit: "daysHours", days: 2, hours: 4 });
    expect(durationText(3 * HOUR + 20 * MIN)).toMatchObject({ unit: "hoursMinutes", hours: 3, minutes: 20 });
    expect(durationText(12 * MIN)).toMatchObject({ unit: "minutes", minutes: 12 });
    expect(durationText(40_000).unit).toBe("underMinute");
    expect(durationText(-5).unit).toBe("underMinute");
  });
});

describe("effectiveNotices", () => {
  it("drops a notice whose end has passed", () => {
    const ended = maintenance({ id: "old", endsAt: at(-MIN) });
    const running = maintenance({ id: "now", endsAt: at(MIN) });
    expect(effectiveNotices([ended, running], NOW).map((n) => n.id)).toEqual(["now"]);
  });

  it("treats an upcoming notice whose start has passed as live", () => {
    const started = maintenance({ state: "UPCOMING", startsAt: at(-MIN) });
    const waiting = maintenance({ id: "later", state: "UPCOMING", startsAt: at(MIN) });
    const [first, second] = effectiveNotices([started, waiting], NOW);
    expect(first?.state).toBe("LIVE");
    expect(second?.state).toBe("UPCOMING");
  });

  it("does not change the input", () => {
    const upcoming = maintenance({ state: "UPCOMING", startsAt: at(-MIN) });
    effectiveNotices([upcoming], NOW);
    expect(upcoming.state).toBe("UPCOMING");
  });
});

describe("nextTransitionMs", () => {
  it("returns the soonest start or end inside the window", () => {
    const list = [
      maintenance({ id: "a", state: "UPCOMING", startsAt: at(40_000), endsAt: at(2 * HOUR) }),
      maintenance({ id: "b", endsAt: at(10_000) }),
    ];
    expect(nextTransitionMs(list, NOW)).toBe(10_000);
  });

  it("ignores moments past the window and moments already gone", () => {
    const list = [
      maintenance({ id: "a", state: "UPCOMING", startsAt: at(2 * HOUR) }),
      maintenance({ id: "b", endsAt: at(-MIN) }),
    ];
    expect(nextTransitionMs(list, NOW)).toBeNull();
  });
});

describe("pausedSummary", () => {
  it("says everything is paused for a full lock", () => {
    expect(pausedSummary(maintenance({ lockMode: "FULL" }))).toEqual({ type: "all" });
  });

  it("lists the paused parts for a partial lock", () => {
    expect(pausedSummary(maintenance())).toEqual({ type: "some", features: ["Checkout & payments"] });
  });

  it("has nothing to say for an announcement", () => {
    expect(pausedSummary(notice())).toBeNull();
  });
});

