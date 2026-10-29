/* eslint-disable no-script-url -- the tests feed deliberately unsafe links to the parsers */
import {
  ArrivalTracker,
  ENQUIRY_LIMITS,
  FOOTER_SLUGS,
  KYC_CHANGE_STAGE_LABEL,
  MAX_REMEMBERED_NOTIFICATIONS,
  ORDER_STATUSES,
  ZERO_BADGES,
  allowedActions,
  applyChanges,
  averageOrderValue,
  badgeCounts,
  badgeLabel,
  catalogMix,
  changesFor,
  checkRating,
  checkReply,
  clampSearchInput,
  contactRows,
  conversationIdOf,
  csvCell,
  enquiryBody,
  enquiryPrefill,
  findCreatedTicket,
  formatCompactRupees,
  formatCompactTick,
  formatDateTime,
  formatDayMonth,
  formatFullDate,
  formatRupees,
  groupIndian,
  groupSearchResults,
  halfChange,
  halfSplit,
  calendarBucket,
  hasNewArrival,
  isPushFlagged,
  kycChangeStageLabel,
  lastMonths,
  launcherCount,
  monthLabel,
  monthName,
  notificationRoute,
  parseFooterBody,
  parseInline,
  parseQuery,
  parseSoundSource,
  percentChange,
  performanceCsv,
  performanceSeries,
  planIncludesInsights,
  quoteOutcome,
  quotesInPeriod,
  relativeTimeOf,
  rememberSearch,
  replyAlreadyPosted,
  safeLink,
  safePortalPath,
  searchRoute,
  searchableTerm,
  sellerDisplayName,
  socialLinks,
  statusCountList,
  telUrl,
  ticketBody,
  ticketTimeline,
  toggleBlock,
  validateEnquiry,
  validateTicket,
  type NotificationPreferenceRow,
  type NotificationSnapshot,
  type SupportTicket,
  type SupportTicketDetail,
} from "../index";

const snapshot = (over: Partial<NotificationSnapshot> & { areas?: Record<string, number> } = {}): NotificationSnapshot =>
  ({
    notifications: [],
    unreadNotifications: 0,
    unreadMessages: 0,
    unreadByArea: {
      orders: 0,
      cancellations: 0,
      returns: 0,
      refunds: 0,
      rfs: 0,
      samples: 0,
      messages: 0,
      payments: 0,
      wallet: 0,
      products: 0,
      support: 0,
      disputes: 0,
      approvals: 0,
      updates: 0,
      ...over.areas,
    },
    conversationRevision: "",
    soundVersion: -1,
    ...over,
  }) as NotificationSnapshot;

describe("badgeCounts", () => {
  it("is all zero without a snapshot", () => {
    expect(badgeCounts(null)).toBe(ZERO_BADGES);
    expect(badgeCounts(undefined)).toBe(ZERO_BADGES);
  });

  it("uses the unread total for notifications", () => {
    expect(badgeCounts(snapshot({ unreadNotifications: 7 })).notifications).toBe(7);
  });

  it("takes the larger of unread messages and the messages area", () => {
    expect(badgeCounts(snapshot({ unreadMessages: 5, areas: { messages: 2 } })).messages).toBe(5);
    expect(badgeCounts(snapshot({ unreadMessages: 1, areas: { messages: 4 } })).messages).toBe(4);
  });

  it("adds samples to rfs for the RFS item, and reads rfs alone for inquiries and quotations", () => {
    const counts = badgeCounts(snapshot({ areas: { rfs: 3, samples: 2 } }));
    expect(counts.rfs).toBe(5);
    expect(counts.inquiries).toBe(3);
    expect(counts.quotations).toBe(3);
    expect(counts.samples).toBe(2);
  });

  it("adds cancellations, returns and refunds to orders", () => {
    const counts = badgeCounts(snapshot({ areas: { orders: 1, cancellations: 2, returns: 3, refunds: 4 } }));
    expect(counts.orders).toBe(10);
  });

  it("adds refunds to payments", () => {
    const counts = badgeCounts(snapshot({ areas: { payments: 2, refunds: 3 } }));
    expect(counts.payments).toBe(5);
  });

  it("reads wallet, products and support from their own areas", () => {
    const counts = badgeCounts(snapshot({ areas: { wallet: 6, products: 7, support: 8 } }));
    expect(counts.wallet).toBe(6);
    expect(counts.products).toBe(7);
    expect(counts.inventory).toBe(7);
    expect(counts.support).toBe(8);
  });

  it("copes with missing areas and junk values", () => {
    const partial = { ...snapshot(), unreadByArea: { orders: 2 } } as unknown as NotificationSnapshot;
    expect(badgeCounts(partial).orders).toBe(2);
    const junk = snapshot({ unreadNotifications: Number.NaN, areas: { orders: -3 } });
    expect(badgeCounts(junk).notifications).toBe(0);
    expect(badgeCounts(junk).orders).toBe(0);
  });

  it("labels badges like the web and caps the launcher at 99", () => {
    expect(badgeLabel(0)).toBeUndefined();
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(100)).toBe("99+");
    expect(launcherCount(250)).toBe(99);
    expect(launcherCount(-1)).toBe(0);
  });
});

describe("notificationRoute", () => {
  const route = (type: string, metadata?: Record<string, unknown>) => notificationRoute({ type, metadata });

  it.each([
    ["order.placed", "/seller/dashboard/orders"],
    ["shipment.delivered", "/seller/dashboard/orders"],
    ["return.requested", "/seller/dashboard/orders"],
    ["sample.requested", "/seller/dashboard/orders"],
    ["rfq.invitation", "/seller/dashboard/inquiries"],
    ["rfq.updated", "/seller/dashboard/rfqs"],
    ["quote.accepted", "/seller/dashboard/quotations"],
    ["product.approved", "/seller/dashboard/products"],
    ["inventory.low", "/seller/dashboard/inventory"],
    ["escrow.released", "/seller/dashboard/payments"],
    ["payment.captured", "/seller/dashboard/payments"],
    ["wallet.credited", "/seller/dashboard/wallet"],
    ["withdrawal.paid", "/seller/dashboard/wallet"],
    ["subscription.renewed", "/seller/dashboard/subscription"],
    ["kyc.verified", "/seller/dashboard/profile"],
    ["verification.done", "/seller/dashboard/profile/business"],
    ["gst_manual_verification.approved", "/seller/dashboard/profile/tax"],
    ["bank.verified", "/seller/dashboard/profile/bank"],
    ["security.password_changed", "/seller/dashboard/profile/security"],
    ["support.replied", "/seller/dashboard/support"],
  ])("sends %s to %s", (type, href) => {
    expect(route(type)?.href).toBe(href);
  });

  it("opens a message in its conversation", () => {
    expect(route("message.received", { conversationId: "c 1" })).toEqual({
      action: "viewMessage",
      href: "/seller/dashboard/messages?conversation=c%201",
    });
    expect(route("message.received")).toBeNull();
  });

  it("names the order, inquiry or ticket when the metadata does", () => {
    expect(route("order.placed", { orderId: "o1" })?.href).toBe("/seller/dashboard/orders?order=o1");
    expect(route("rfq.invitation", { rfqId: "r1" })?.href).toBe("/seller/dashboard/inquiries?rfq=r1");
    expect(route("support.replied", { ticketId: "t1" })?.href).toBe("/seller/dashboard/support?ticket=t1");
  });

  it("prefers a safe actionUrl", () => {
    expect(route("order.placed", { actionUrl: "/seller/dashboard/wallet?txn=1", orderId: "o1" })?.href).toBe(
      "/seller/dashboard/wallet?txn=1",
    );
  });

  it.each([
    "https://evil.example/seller/x",
    "//evil.example/seller/x",
    "/admin/users",
    "/seller/../admin",
    "/seller/dashboard//x",
    "javascript:alert(1)",
    "/seller/a b",
    "/seller/dashboard\\x",
    "",
    42,
  ])("ignores an unsafe actionUrl %p", (actionUrl) => {
    expect(safePortalPath(actionUrl)).toBeNull();
    expect(route("order.placed", { actionUrl })?.href).toBe("/seller/dashboard/orders");
  });

  it("returns null for unknown types", () => {
    expect(route("promotion.started")).toBeNull();
    expect(route("")).toBeNull();
  });

  it("reads the conversation id and the push flag", () => {
    expect(conversationIdOf({ type: "message.new", metadata: { conversationId: "c" } })).toBe("c");
    expect(conversationIdOf({ type: "order.new", metadata: { conversationId: "c" } })).toBeNull();
    expect(isPushFlagged({ type: "x", metadata: { _push: true } })).toBe(true);
    expect(isPushFlagged({ type: "x", metadata: { _push: "yes" } })).toBe(false);
  });
});

describe("searchRoute", () => {
  it.each([
    ["/seller/dashboard/orders?order=abc", "/seller/dashboard/orders", { order: "abc" }],
    ["/seller/dashboard/orders?buyer=b1", "/seller/dashboard/orders", { buyer: "b1" }],
    ["/seller/dashboard/products?q=Steel+Pipe", "/seller/dashboard/products", { q: "Steel Pipe" }],
    ["/seller/dashboard/inquiries?rfq=r1", "/seller/dashboard/inquiries", { rfq: "r1" }],
    ["/seller/dashboard/quotations?q=Bulk%20rice", "/seller/dashboard/quotations", { q: "Bulk rice" }],
    ["/seller/dashboard/rfqs?q=RFQ-1", "/seller/dashboard/rfqs", { q: "RFQ-1" }],
    ["/seller/dashboard/wallet?txn=t9", "/seller/dashboard/wallet", { txn: "t9" }],
    ["/seller/dashboard/payments", "/seller/dashboard/payments", {}],
    ["/seller/dashboard/payments/?x=#top", "/seller/dashboard/payments", {}],
  ])("reads %s", (href, path, query) => {
    expect(searchRoute(href)).toEqual({ path, query });
  });

  it("refuses links that are not portal paths", () => {
    expect(searchRoute("https://evil.example")).toBeNull();
    expect(searchRoute("/buyerportal/orders")).toBeNull();
    expect(searchRoute(null)).toBeNull();
    expect(searchRoute(undefined)).toBeNull();
  });

  it("decodes broken escapes without throwing", () => {
    expect(parseQuery("q=%E0%A4%A&x=1")).toEqual({ q: "%E0%A4%A", x: "1" });
    expect(parseQuery("a=&b")).toEqual({});
  });
});

describe("formatMoney", () => {
  it.each([
    [0, "₹0"],
    [999, "₹999"],
    [1_000, "₹1.0K"],
    [1_250, "₹1.3K"],
    [12_345, "₹12.3K"],
    [99_949, "₹99.9K"],
    [99_950, "₹1.0L"],
    [99_999, "₹1.0L"],
    [100_000, "₹1.0L"],
    [420_000, "₹4.2L"],
    [9_994_999, "₹99.9L"],
    [9_999_999, "₹1.0Cr"],
    [10_000_000, "₹1.0Cr"],
    [123_456_789, "₹12.3Cr"],
    [-1_500, "-₹1.5K"],
    [Number.NaN, "₹0"],
  ])("compacts %p as %s", (amount, expected) => {
    expect(formatCompactRupees(amount)).toBe(expected);
  });

  it("rounds a sub-thousand value up into the K unit", () => {
    expect(formatCompactRupees(999.6)).toBe("₹1.0K");
  });

  it("groups rupees the Indian way", () => {
    expect(groupIndian(1234567)).toBe("12,34,567");
    expect(groupIndian(999)).toBe("999");
    expect(groupIndian(100000)).toBe("1,00,000");
    expect(formatRupees(123456.5)).toBe("₹1,23,456.50");
    expect(formatRupees(5000)).toBe("₹5,000");
    expect(formatRupees(-250)).toBe("-₹250");
  });

  it("drops the trailing .0 on axis ticks", () => {
    expect(formatCompactTick(1_000)).toBe("₹1K");
    expect(formatCompactTick(250_000)).toBe("₹2.5L");
    expect(formatCompactTick(500)).toBe("₹500");
  });
});

describe("analyticsMath", () => {
  it("labels months", () => {
    expect(monthLabel("2026-09")).toBe("Sep 26");
    expect(monthLabel("2027-01")).toBe("Jan 27");
    expect(monthLabel("garbage")).toBe("garbage");
    expect(monthLabel("2026-13")).toBe("2026-13");
  });

  it("names months in full for spoken summaries", () => {
    expect(monthName("2026-09")).toBe("September");
    expect(monthName("x")).toBe("x");
  });

  it("slices the last N months, even from an empty series", () => {
    expect(lastMonths([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(lastMonths([1, 2], 6)).toEqual([1, 2]);
    expect(lastMonths([], 3)).toEqual([]);
    expect(lastMonths(null, 3)).toEqual([]);
  });

  it("computes percent change with a zero baseline", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(5, 0)).toBe(100);
    expect(percentChange(0, 0)).toBe(0);
  });

  it("splits a window into earlier and later halves", () => {
    expect(halfSplit([1, 2, 3, 4])).toEqual({ earlier: 3, later: 7 });
    expect(halfSplit([1, 2, 3])).toEqual({ earlier: 1, later: 5 });
    expect(halfSplit([])).toEqual({ earlier: 0, later: 0 });
    expect(halfChange([10, 10, 20, 20])).toBe(100);
    expect(halfChange([0, 0, 0, 0])).toBe(0);
  });

  it("averages order value without dividing by zero", () => {
    expect(averageOrderValue(1000, 3)).toBe(333);
    expect(averageOrderValue(1000, 0)).toBe(0);
  });

  it("counts quote outcomes and the win rate", () => {
    const quotes = [
      { status: "SUBMITTED", createdAt: "2026-10-01" },
      { status: "ACCEPTED", createdAt: "2026-10-01" },
      { status: "ACCEPTED", createdAt: "2026-10-01" },
      { status: "REJECTED", createdAt: "2026-10-01" },
      { status: "EXPIRED", createdAt: "2026-10-01" },
      { status: "WITHDRAWN", createdAt: "2026-10-01" },
    ];
    expect(quoteOutcome(quotes)).toEqual({
      total: 6,
      open: 1,
      won: 2,
      lost: 1,
      expiredOrWithdrawn: 2,
      winRate: 33,
    });
    expect(quoteOutcome([]).winRate).toBe(0);
  });

  it("keeps only quotes inside the period", () => {
    const now = new Date("2026-10-22T00:00:00Z");
    const quotes = [
      { status: "SUBMITTED", createdAt: "2026-10-01T00:00:00Z" },
      { status: "SUBMITTED", createdAt: "2026-05-01T00:00:00Z" },
    ];
    expect(quotesInPeriod(quotes, 3, now)).toHaveLength(1);
    expect(quotesInPeriod(quotes, 12, now)).toHaveLength(2);
    expect(quotesInPeriod(null, 6, now)).toEqual([]);
  });

  it("builds the catalog mix, biggest first, with an Uncategorized bucket", () => {
    expect(
      catalogMix([{ category: "Steel" }, { category: "Rice" }, { category: "Steel" }, { category: null }, { category: " " }]),
    ).toEqual([
      { name: "Steel", count: 2 },
      { name: "Uncategorized", count: 2 },
      { name: "Rice", count: 1 },
    ]);
    expect(catalogMix(null)).toEqual([]);
  });

  it("checks the plan for the analytics feature", () => {
    expect(planIncludesInsights([{ featureKey: "INSIGHTS_ANALYTICS", included: true }])).toBe(true);
    expect(planIncludesInsights([{ featureKey: "INSIGHTS_ANALYTICS", included: false }])).toBe(false);
    expect(planIncludesInsights([{ featureKey: "OTHER", included: true }])).toBe(false);
    expect(planIncludesInsights([])).toBe(false);
    expect(planIncludesInsights(undefined)).toBe(false);
  });

  it("joins revenue and orders by month, then by position", () => {
    const points = performanceSeries(
      [
        { month: "2026-08", amount: 100 },
        { month: "2026-09", amount: 200 },
      ],
      [
        { month: "2026-09", count: 4 },
        { month: "2026-08", count: 3 },
      ],
    );
    expect(points.map((p) => [p.label, p.revenue, p.orders])).toEqual([
      ["Aug 26", 100, 3],
      ["Sep 26", 200, 4],
    ]);
    expect(performanceSeries([{ month: "x", amount: 1 }], [{ month: "y", count: 9 }])[0].orders).toBe(9);
  });

  it("writes CSV that spreadsheets read safely", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe("-5");
    expect(
      performanceCsv([{ month: "2026-09", label: "Sep 26", revenue: 1200, orders: 3 }]),
    ).toBe("Month,Revenue (INR),Orders\r\nSep 26,1200,3");
  });
});

describe("order statuses", () => {
  it("lists the eight states and fills missing counts with zero", () => {
    expect(ORDER_STATUSES).toHaveLength(8);
    const list = statusCountList({ PENDING: 3, DELIVERED: 2, total: 5 });
    expect(list.map((entry) => entry.count)).toEqual([3, 0, 0, 0, 2, 0, 0, 0]);
    expect(new Set(list.map((entry) => entry.color)).size).toBe(8);
    expect(statusCountList(null).every((entry) => entry.count === 0)).toBe(true);
  });
});

describe("ArrivalTracker", () => {
  const row = (id: string, createdAt: string, read = false) => ({ id, createdAt, read });

  it("treats the first snapshot as a baseline", () => {
    const tracker = new ArrivalTracker();
    expect(tracker.update([row("a", "2026-10-22T10:00:00Z")])).toEqual([]);
    expect(tracker.update([row("a", "2026-10-22T10:00:00Z")])).toEqual([]);
  });

  it("reports new unread rows only once", () => {
    const tracker = new ArrivalTracker();
    tracker.update([row("a", "2026-10-22T10:00:00Z")]);
    const next = [row("b", "2026-10-22T10:01:00Z"), row("a", "2026-10-22T10:00:00Z")];
    expect(tracker.update(next).map((r) => r.id)).toEqual(["b"]);
    expect(tracker.update(next)).toEqual([]);
  });

  it("counts a reused id with a new timestamp as an arrival", () => {
    const tracker = new ArrivalTracker();
    tracker.update([row("a", "2026-10-22T10:00:00Z")]);
    expect(tracker.update([row("a", "2026-10-22T10:05:00Z")])).toHaveLength(1);
  });

  it("never reports a read row", () => {
    const tracker = new ArrivalTracker();
    tracker.update([]);
    expect(tracker.update([row("a", "2026-10-22T10:00:00Z", true)])).toEqual([]);
  });

  it("remembers but does not report arrivals older than the cut-off", () => {
    const tracker = new ArrivalTracker();
    tracker.update([]);
    const now = Date.parse("2026-10-22T10:10:00Z");
    const old = row("old", "2026-10-22T09:00:00Z");
    const fresh = row("fresh", "2026-10-22T10:09:30Z");
    expect(tracker.update([old, fresh], { maxAgeMs: 120_000, now }).map((r) => r.id)).toEqual(["fresh"]);
    expect(tracker.update([old, fresh], { maxAgeMs: 120_000, now })).toEqual([]);
  });

  it("stays quiet on a cold start even with a restored map", () => {
    const tracker = new ArrivalTracker([["a", "2026-10-22T10:00:00Z"]]);
    expect(tracker.update([row("a", "2026-10-22T10:00:00Z"), row("new", "2026-10-22T10:01:00Z")])).toEqual([]);
    expect(tracker.update([row("newer", "2026-10-22T10:02:00Z")]).map((r) => r.id)).toEqual(["newer"]);
  });

  it("persists its map and caps it", () => {
    const tracker = new ArrivalTracker();
    tracker.update([row("a", "t1")]);
    expect(tracker.entries()).toEqual([["a", "t1"]]);
    const many = Array.from({ length: MAX_REMEMBERED_NOTIFICATIONS + 5 }, (_, i) => row(`id${i}`, "t"));
    tracker.update(many);
    expect(tracker.size).toBe(many.length);
    tracker.update(many.slice(0, 3));
    expect(tracker.size).toBeLessThanOrEqual(MAX_REMEMBERED_NOTIFICATIONS);
  });

  it("forgets everything on reset", () => {
    const tracker = new ArrivalTracker();
    tracker.update([row("a", "t")]);
    tracker.reset();
    expect(tracker.size).toBe(0);
    expect(tracker.update([row("b", "t")])).toEqual([]);
  });

  it("hasNewArrival is false before the first snapshot", () => {
    expect(hasNewArrival([row("a", "t")], null)).toBe(false);
    expect(hasNewArrival([row("a", "t")], new Map())).toBe(true);
    expect(hasNewArrival([row("a", "t")], new Map([["a", "t"]]))).toBe(false);
  });
});

describe("parseSoundSource", () => {
  it("reads data URIs and links, and refuses the rest", () => {
    expect(parseSoundSource("data:audio/mpeg;base64,QUJD")).toEqual({
      kind: "data",
      mime: "audio/mpeg",
      extension: "mp3",
      base64: "QUJD",
    });
    expect(parseSoundSource("https://cdn.example/s.mp3")).toEqual({ kind: "url", url: "https://cdn.example/s.mp3" });
    expect(parseSoundSource("data:text/html;base64,QUJD")).toBeNull();
    expect(parseSoundSource("javascript:alert(1)")).toBeNull();
    expect(parseSoundSource("")).toBeNull();
    expect(parseSoundSource(null)).toBeNull();
  });
});

describe("ticket rules", () => {
  const ticket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
    id: "t1",
    ticketNumber: "TKT-1",
    subject: "Need help",
    message: "Please help me",
    orderId: null,
    orderNumber: null,
    category: "ORDER",
    priority: "NORMAL",
    status: "OPEN",
    messageCount: 1,
    rating: null,
    ratingComment: null,
    changeRequest: null,
    lastActivityAt: "2026-10-22T10:00:00Z",
    createdAt: "2026-10-22T10:00:00Z",
    ...over,
  });

  it("allows reply and close until closed, and rating once settled and unrated", () => {
    expect(allowedActions(ticket({ status: "OPEN" }))).toEqual({ reply: true, close: true, rate: false, raiseNew: false });
    expect(allowedActions(ticket({ status: "IN_PROGRESS" })).rate).toBe(false);
    expect(allowedActions(ticket({ status: "RESOLVED" }))).toEqual({ reply: true, close: true, rate: true, raiseNew: false });
    expect(allowedActions(ticket({ status: "CLOSED" }))).toEqual({ reply: false, close: false, rate: true, raiseNew: true });
    expect(allowedActions(ticket({ status: "CLOSED", rating: 4 })).rate).toBe(false);
  });

  it("validates a draft against the API limits", () => {
    const base = { subject: "Hello", category: "ORDER", message: "Hello there" };
    expect(validateTicket(base, ["ORDER"])).toEqual({});
    expect(validateTicket({ ...base, subject: "" })).toEqual({ subject: "required" });
    expect(validateTicket({ ...base, subject: "ab" }).subject).toBe("short");
    expect(validateTicket({ ...base, subject: "x".repeat(201) }).subject).toBe("long");
    expect(validateTicket({ ...base, category: "" }).category).toBe("required");
    expect(validateTicket({ ...base, category: "NOPE" }, ["ORDER"]).category).toBe("required");
    expect(validateTicket({ ...base, message: "hey" }).message).toBe("short");
    expect(validateTicket({ ...base, message: "x".repeat(5001) }).message).toBe("long");
  });

  it("builds a trimmed body, with an order when given", () => {
    expect(ticketBody({ subject: "  Hello ", category: "ORDER", message: " Hello there ", orderId: "o1" })).toEqual({
      subject: "Hello",
      category: "ORDER",
      message: "Hello there",
      orderId: "o1",
    });
    expect(ticketBody({ subject: "", category: "ORDER", message: "x" })).toBeNull();
  });

  it("checks replies (2–5,000) and ratings (1–5, comment up to 1,000)", () => {
    expect(checkReply(" ok ")).toEqual({ ok: true, value: "ok" });
    expect(checkReply("a")).toEqual({ ok: false, reason: "short" });
    expect(checkReply("  ")).toEqual({ ok: false, reason: "required" });
    expect(checkReply("x".repeat(5001))).toEqual({ ok: false, reason: "long" });
    expect(checkRating(5, "")).toEqual({ ok: true, value: { rating: 5 } });
    expect(checkRating(3, " fine ")).toEqual({ ok: true, value: { rating: 3, comment: "fine" } });
    expect(checkRating(0, "")).toEqual({ ok: false, reason: "stars" });
    expect(checkRating(6, "")).toEqual({ ok: false, reason: "stars" });
    expect(checkRating(2.5, "")).toEqual({ ok: false, reason: "stars" });
    expect(checkRating(4, "x".repeat(1001))).toEqual({ ok: false, reason: "long" });
  });

  it("detects a reply or ticket that already went through", () => {
    const detail = {
      messages: [
        { id: "m1", body: "Hi there", authorUserId: "u", fromSupport: false, createdAt: "2026-10-22T10:01:00Z" },
        { id: "m2", body: "Hi there", authorUserId: "s", fromSupport: true, createdAt: "2026-10-22T10:02:00Z" },
      ],
    } as SupportTicketDetail;
    expect(replyAlreadyPosted(detail, " Hi there ", "2026-10-22T10:00:30Z")).toBe(true);
    expect(replyAlreadyPosted(detail, "Hi there", "2026-10-22T10:01:30Z")).toBe(false);
    expect(replyAlreadyPosted(detail, "Other", "2026-10-22T10:00:00Z")).toBe(false);
    const list = [ticket({ createdAt: "2026-10-22T10:00:10Z" })];
    expect(findCreatedTicket(list, { subject: "Need help", message: "Please help me" }, "2026-10-22T10:00:00Z")?.id).toBe("t1");
    expect(findCreatedTicket(list, { subject: "Need help", message: "Please help me" }, "2026-10-22T10:01:00Z")).toBeNull();
    expect(findCreatedTicket(list, { subject: "Different", message: "Please help me" }, "2026-10-22T10:00:00Z")).toBeNull();
  });

  it("labels KYC change stages", () => {
    for (const status of Object.keys(KYC_CHANGE_STAGE_LABEL)) {
      expect(kycChangeStageLabel(status)).toBe(KYC_CHANGE_STAGE_LABEL[status]);
    }
    expect(kycChangeStageLabel("something_new")).toBe("Something new");
    expect(kycChangeStageLabel(null)).toBe("");
  });

  it("orders the thread and hides internal events", () => {
    const items = ticketTimeline({
      messages: [
        { id: "m1", body: "a", authorUserId: "u", fromSupport: false, createdAt: "2026-10-22T10:00:00Z" },
        { id: "m2", body: "b", authorUserId: "s", fromSupport: true, createdAt: "2026-10-22T10:02:00Z" },
      ],
      events: [
        { id: "e1", eventType: "CREATED", createdAt: "2026-10-22T10:00:00Z" },
        { id: "e2", eventType: "PRIORITY_CHANGED", createdAt: "2026-10-22T10:01:00Z" },
        { id: "e3", eventType: "RESOLVED", createdAt: "2026-10-22T10:03:00Z" },
      ],
    });
    expect(items.map((i) => i.key)).toEqual(["m-m1", "m-m2", "e-e3"]);
  });
});

describe("footer body", () => {
  it("parses headings, paragraphs and lists", () => {
    const blocks = parseFooterBody("## Title\n\nFirst line\nsecond line\n\n- one\n- two\n\n1. a\n2) b\n\n### Sub");
    expect(blocks).toEqual([
      { kind: "h2", text: "Title" },
      { kind: "p", text: "First line\nsecond line" },
      { kind: "ul", items: ["one", "two"] },
      { kind: "ol", items: ["a", "b"] },
      { kind: "h3", text: "Sub" },
    ]);
    expect(parseFooterBody(null)).toEqual([]);
    expect(parseFooterBody("a\r\nb")).toEqual([{ kind: "p", text: "a\nb" }]);
  });

  it("separates adjacent lists of different kinds", () => {
    expect(parseFooterBody("- a\n1. b")).toEqual([
      { kind: "ul", items: ["a"] },
      { kind: "ol", items: ["b"] },
    ]);
  });

  it("splits bold and safe links, and keeps unsafe links as plain text", () => {
    expect(parseInline("See **this** and [terms](/info/terms-of-use) or [site](https://x.com/a)")).toEqual([
      { kind: "text", text: "See " },
      { kind: "bold", text: "this" },
      { kind: "text", text: " and " },
      { kind: "link", text: "terms", link: { kind: "site", href: "/info/terms-of-use" } },
      { kind: "text", text: " or " },
      { kind: "link", text: "site", link: { kind: "external", url: "https://x.com/a" } },
    ]);
    // The unsafe target is dropped; only the visible words survive, never a tappable link.
    expect(parseInline("[bad](javascript:void)")).toEqual([{ kind: "text", text: "bad" }]);
    expect(parseInline("[bad](javascript:alert(1))").some((piece) => piece.kind === "link")).toBe(false);
    expect(parseInline("[x](intent://evil)")).toEqual([{ kind: "text", text: "x" }]);
    expect(parseInline("[x](//evil.com)")).toEqual([{ kind: "text", text: "x" }]);
  });

  it("only allows site, http(s), mailto and tel links", () => {
    expect(safeLink("/seller/dashboard")).toEqual({ kind: "site", href: "/seller/dashboard" });
    expect(safeLink("mailto:a@b.com")).toEqual({ kind: "external", url: "mailto:a@b.com" });
    expect(safeLink("tel:+911234567890")).toEqual({ kind: "external", url: "tel:+911234567890" });
    expect(safeLink("ftp://x")).toBeNull();
    expect(safeLink("file:///etc/passwd")).toBeNull();
    expect(safeLink("//x.com")).toBeNull();
    expect(safeLink("/\\x.com")).toBeNull();
  });

  it("builds contact rows and tel links", () => {
    expect(telUrl("+91 98765-43210")).toBe("tel:+919876543210");
    expect(telUrl("ab")).toBeNull();
    expect(contactRows({ contactEmail: " a@b.com ", contactPhone: "+91 99999 99999", contactAddress: "1 Road" })).toEqual([
      { kind: "email", value: "a@b.com", url: "mailto:a@b.com" },
      { kind: "phone", value: "+91 99999 99999", url: "tel:+919999999999" },
      { kind: "address", value: "1 Road", url: null },
    ]);
    expect(contactRows({ contactEmail: null, contactPhone: " ", contactAddress: null })).toEqual([]);
  });

  it("keeps only http(s) social links", () => {
    expect(
      socialLinks({
        facebookUrl: "https://facebook.com/x",
        instagramUrl: "javascript:1",
        xUrl: null,
      } as never),
    ).toEqual([{ network: "facebook", url: "https://facebook.com/x" }]);
    expect(socialLinks(null)).toEqual([]);
  });

  it("knows the seller footer slugs", () => {
    expect(FOOTER_SLUGS.terms).toBe("terms-of-use");
    expect(FOOTER_SLUGS.privacy).toBe("privacy-policy");
  });

  it("validates the contact form", () => {
    const ok = { name: "Asha", email: "a@b.co", phone: "", companyName: "", message: "Hello, I need help" };
    expect(validateEnquiry(ok)).toEqual({});
    expect(validateEnquiry({ ...ok, name: "A" }).name).toBe("nameInvalid");
    expect(validateEnquiry({ ...ok, email: "nope" }).email).toBe("emailInvalid");
    expect(validateEnquiry({ ...ok, phone: "123" }).phone).toBe("phoneInvalid");
    expect(validateEnquiry({ ...ok, phone: "+91 98765 43210" })).toEqual({});
    expect(validateEnquiry({ ...ok, companyName: "x".repeat(161) }).companyName).toBe("companyLong");
    expect(validateEnquiry({ ...ok, message: "short" }).message).toBe("messageShort");
    expect(validateEnquiry({ ...ok, message: "x".repeat(ENQUIRY_LIMITS.messageMax + 1) }).message).toBe("messageLong");
    expect(enquiryBody("help-support", ok)).toEqual({
      pageSlug: "help-support",
      name: "Asha",
      email: "a@b.co",
      message: "Hello, I need help",
    });
    expect(enquiryBody("x", { ...ok, name: "" })).toBeNull();
    expect(enquiryPrefill({ firstName: "Asha", lastName: "K", email: "a@b.co", phone: "9" }, "Acme").name).toBe("Asha K");
    expect(enquiryPrefill(null).email).toBe("");
  });
});

describe("search input", () => {
  it("needs two characters and trims to 80", () => {
    expect(searchableTerm("a")).toBeNull();
    expect(searchableTerm("  a  ")).toBeNull();
    expect(searchableTerm("ab")).toBe("ab");
    expect(searchableTerm("  steel   pipe ")).toBe("steel pipe");
    expect(searchableTerm("x".repeat(200))).toHaveLength(80);
  });

  it("cuts typed text at 80 characters and strips control characters", () => {
    expect(clampSearchInput("x".repeat(100))).toHaveLength(80);
    expect(clampSearchInput("a\nb")).toBe("a b");
  });

  it("groups results in a fixed order and drops duplicates", () => {
    const groups = groupSearchResults([
      { type: "PRODUCT", id: "p1", title: "P", subtitle: null, href: "" },
      { type: "ORDER", id: "o1", title: "O", subtitle: null, href: "" },
      { type: "ORDER", id: "o1", title: "O again", subtitle: null, href: "" },
      { type: "ORDER", id: "o2", title: "O2", subtitle: null, href: "" },
    ]);
    expect(groups.map((g) => [g.type, g.results.length])).toEqual([
      ["ORDER", 2],
      ["PRODUCT", 1],
    ]);
  });

  it("remembers the last ten searches without case duplicates", () => {
    let recent: string[] = [];
    for (let i = 0; i < 12; i += 1) recent = rememberSearch(recent, `term ${i}`);
    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe("term 11");
    expect(rememberSearch(["Steel", "rice"], "steel")).toEqual(["steel", "rice"]);
    expect(rememberSearch(["a"], "  ")).toEqual(["a"]);
  });
});

describe("notification preferences", () => {
  const row = (category: string, on: Record<string, boolean>, locked: string[] = []): NotificationPreferenceRow =>
    ({
      category,
      channels: ["EMAIL", "SMS", "PUSH", "IN_APP"].map((channel) => ({
        channel,
        enabled: Boolean(on[channel]),
        locked: locked.includes(channel),
      })),
    }) as NotificationPreferenceRow;

  const rows = [
    row("ORDERS", { EMAIL: true, IN_APP: true, PUSH: true }),
    row("SECURITY", { EMAIL: true, IN_APP: true }, ["EMAIL", "IN_APP"]),
    row("MARKETING", {}),
  ];

  it("refuses to switch off a locked channel", () => {
    expect(toggleBlock(rows, "SECURITY", "EMAIL", false)).toBe("locked");
    expect(toggleBlock(rows, "SECURITY", "SMS", true)).toBeNull();
    expect(changesFor(rows, "SECURITY", "IN_APP", false)).toEqual([]);
  });

  it("does not allow Push on while In-app is off", () => {
    expect(toggleBlock(rows, "MARKETING", "PUSH", true)).toBe("needsInApp");
    expect(changesFor(rows, "MARKETING", "PUSH", true)).toEqual([]);
  });

  it("turns Push off with In-app", () => {
    expect(changesFor(rows, "ORDERS", "IN_APP", false)).toEqual([
      { category: "ORDERS", channel: "IN_APP", enabled: false },
      { category: "ORDERS", channel: "PUSH", enabled: false },
    ]);
  });

  it("sends nothing when the value does not change", () => {
    expect(changesFor(rows, "ORDERS", "EMAIL", true)).toEqual([]);
  });

  it("applies changes without mutating and skips locked channels", () => {
    const changed = applyChanges(rows, [{ category: "ORDERS", channel: "EMAIL", enabled: false }]);
    expect(changed[0].channels.find((c) => c.channel === "EMAIL")?.enabled).toBe(false);
    expect(rows[0].channels.find((c) => c.channel === "EMAIL")?.enabled).toBe(true);
    const locked = applyChanges(rows, [{ category: "SECURITY", channel: "EMAIL", enabled: false }]);
    expect(locked[1].channels.find((c) => c.channel === "EMAIL")?.enabled).toBe(true);
  });
});

describe("display rules", () => {
  it("names the seller by business, then person, then the product name", () => {
    expect(sellerDisplayName({ companyName: " Acme Ltd " }, { firstName: "A", lastName: "B" })).toBe("Acme Ltd");
    expect(sellerDisplayName({ companyName: " " }, { firstName: "Asha", lastName: "K" })).toBe("Asha K");
    expect(sellerDisplayName(null, { firstName: "Asha", lastName: null })).toBe("Asha");
    expect(sellerDisplayName(undefined, undefined)).toBe("TradeVistar Seller");
  });

  it("measures how long ago something happened", () => {
    const now = Date.parse("2026-10-22T12:00:00Z");
    expect(relativeTimeOf("2026-10-22T11:59:30Z", now)).toEqual({ unit: "now" });
    expect(relativeTimeOf("2026-10-22T11:45:00Z", now)).toEqual({ unit: "minutes", count: 15 });
    expect(relativeTimeOf("2026-10-22T09:00:00Z", now)).toEqual({ unit: "hours", count: 3 });
    expect(relativeTimeOf("2026-10-19T12:00:00Z", now)).toEqual({ unit: "days", count: 3 });
    expect(relativeTimeOf("2026-10-23T12:00:00Z", now)).toEqual({ unit: "now" });
    expect(relativeTimeOf("nope", now)).toEqual({ unit: "now" });
  });

  it("formats short dates", () => {
    expect(formatDayMonth("2026-10-05T10:00:00")).toBe("05 Oct");
    expect(formatFullDate("2026-10-05T10:00:00")).toBe("05 Oct 2026");
    expect(formatDayMonth(null)).toBe("");
    expect(formatDayMonth("junk")).toBe("");
  });
});

describe("calendarBucket", () => {
  const now = new Date(2026, 9, 22, 15, 0, 0);
  it("groups by the calendar day", () => {
    expect(calendarBucket(new Date(2026, 9, 22, 0, 5).toISOString(), now)).toBe("today");
    expect(calendarBucket(new Date(2026, 9, 21, 23, 59).toISOString(), now)).toBe("yesterday");
    expect(calendarBucket(new Date(2026, 9, 20, 12, 0).toISOString(), now)).toBe("earlier");
    expect(calendarBucket(new Date(2026, 9, 23, 1, 0).toISOString(), now)).toBe("today");
    expect(calendarBucket("junk", now)).toBe("earlier");
  });
});

describe("formatDateTime", () => {
  it("writes a short date and a 12-hour time", () => {
    expect(formatDateTime(new Date(2026, 9, 5, 15, 7).toISOString())).toBe("05 Oct, 3:07 pm");
    expect(formatDateTime(new Date(2026, 9, 5, 0, 30).toISOString())).toBe("05 Oct, 12:30 am");
    expect(formatDateTime(new Date(2026, 9, 5, 12, 0).toISOString())).toBe("05 Oct, 12:00 pm");
    expect(formatDateTime("junk")).toBe("");
    expect(formatDateTime(null)).toBe("");
  });
});
