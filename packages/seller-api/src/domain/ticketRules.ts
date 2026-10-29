/**
 * Support ticket rules: limits mirror the API's DTOs (supportController.ts) — a subject is 3–200
 * characters, a first message 5–5,000, a reply 2–5,000, a rating comment up to 1,000 — and the
 * category must be one of `/support/categories`. The API takes no attachments. A closed ticket
 * answers 409 ("This ticket is closed — please raise a new one").
 */
import type { SupportTicket, SupportTicketDetail, TicketStatus } from "../endpoints/support";

export const TICKET_LIMITS = {
  subjectMin: 3,
  subjectMax: 200,
  messageMin: 5,
  messageMax: 5000,
  replyMin: 2,
  replyMax: 5000,
  commentMax: 1000,
  searchMax: 120,
  /** The character counter appears from here. */
  counterFrom: 4500,
} as const;

export const TICKET_PAGE_SIZE = 20;

export const TICKET_STATUSES: readonly TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Badge tone per status, as the web colours them. */
export const TICKET_STATUS_TONE: Record<TicketStatus, "green" | "blue" | "gray" | "orange"> = {
  OPEN: "orange",
  IN_PROGRESS: "blue",
  RESOLVED: "green",
  CLOSED: "gray",
};

/** The stages of a KYC document change ticket, as the profile screens word them. */
export const KYC_CHANGE_STAGE_LABEL: Record<string, string> = {
  PENDING: "Waiting for review",
  APPROVED: "Approved - upload the new document",
  REJECTED: "Request declined",
  COMPLETED: "New document uploaded - being verified",
  VERIFIED: "Document replaced",
  REPLACEMENT_REJECTED: "New document was rejected",
};

export function kycChangeStageLabel(status: string | null | undefined): string {
  const key = (status ?? "").toUpperCase();
  if (KYC_CHANGE_STAGE_LABEL[key]) return KYC_CHANGE_STAGE_LABEL[key];
  return key
    ? key
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^./, (c) => c.toUpperCase())
    : "";
}

export interface TicketActions {
  reply: boolean;
  close: boolean;
  rate: boolean;
  /** A closed ticket cannot be reopened; the seller raises a new one. */
  raiseNew: boolean;
}

/** Reply and close unless CLOSED; rate when RESOLVED or CLOSED and not yet rated. */
export function allowedActions(ticket: Pick<SupportTicket, "status" | "rating">): TicketActions {
  const closed = ticket.status === "CLOSED";
  const settled = ticket.status === "RESOLVED" || closed;
  return { reply: !closed, close: !closed, rate: settled && !hasRating(ticket), raiseNew: closed };
}

export function hasRating(ticket: Pick<SupportTicket, "rating">): boolean {
  return typeof ticket.rating === "number" && ticket.rating >= 1 && ticket.rating <= 5;
}

/** A resolved or closed ticket can be rated (the API answers 409 before that), once or again. */
export function canRateTicket(ticket: Pick<SupportTicket, "status">): boolean {
  return ticket.status === "RESOLVED" || ticket.status === "CLOSED";
}

/* ------------------------------------------------------------------ drafts and validation */

export type TicketField = "subject" | "category" | "message";
export type TicketFieldError = "required" | "short" | "long";

export interface TicketDraft {
  subject: string;
  category: string;
  message: string;
  orderId?: string | null;
}

export function validateTicket(
  draft: TicketDraft,
  categories?: readonly string[],
): Partial<Record<TicketField, TicketFieldError>> {
  const errors: Partial<Record<TicketField, TicketFieldError>> = {};
  const subject = draft.subject.trim();
  if (!subject) errors.subject = "required";
  else if (subject.length < TICKET_LIMITS.subjectMin) errors.subject = "short";
  else if (subject.length > TICKET_LIMITS.subjectMax) errors.subject = "long";

  if (!draft.category || (categories && !categories.includes(draft.category))) errors.category = "required";

  const message = draft.message.trim();
  if (!message) errors.message = "required";
  else if (message.length < TICKET_LIMITS.messageMin) errors.message = "short";
  else if (message.length > TICKET_LIMITS.messageMax) errors.message = "long";
  return errors;
}

/** The request body for creating a ticket, trimmed; null while the draft is invalid. */
export function ticketBody(
  draft: TicketDraft,
  categories?: readonly string[],
): { subject: string; message: string; category: string; orderId?: string } | null {
  if (Object.keys(validateTicket(draft, categories)).length > 0) return null;
  return {
    subject: draft.subject.trim(),
    message: draft.message.trim(),
    category: draft.category,
    ...(draft.orderId ? { orderId: draft.orderId } : {}),
  };
}

export function checkReply(text: string): { ok: true; value: string } | { ok: false; reason: TicketFieldError } {
  const value = text.trim();
  if (!value) return { ok: false, reason: "required" };
  if (value.length < TICKET_LIMITS.replyMin) return { ok: false, reason: "short" };
  if (value.length > TICKET_LIMITS.replyMax) return { ok: false, reason: "long" };
  return { ok: true, value };
}

export type RatingError = "stars" | "long";

/** The request for rating a ticket, or why it cannot be sent yet. */
export function checkRating(
  stars: number,
  comment: string,
): { ok: true; value: { rating: number; comment?: string } } | { ok: false; reason: RatingError } {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, reason: "stars" };
  const note = comment.trim();
  if (note.length > TICKET_LIMITS.commentMax) return { ok: false, reason: "long" };
  return { ok: true, value: note ? { rating: stars, comment: note } : { rating: stars } };
}

/** The search text the list sends: trimmed and cut to the server's limit; undefined when empty. */
export function ticketSearchTerm(raw: string): string | undefined {
  const term = raw.trim().slice(0, TICKET_LIMITS.searchMax).trim();
  return term || undefined;
}

/* ------------------------------------------------------------------ duplicate protection */

/**
 * Whether a reply the seller sent is already in the thread (a retry after a lost response). The
 * API has no idempotency for replies, so the app looks before sending again.
 */
export function replyAlreadyPosted(
  ticket: Pick<SupportTicketDetail, "messages">,
  body: string,
  sentAfterIso: string,
): boolean {
  const value = body.trim();
  return ticket.messages.some(
    (message) => !message.fromSupport && message.body.trim() === value && message.createdAt >= sentAfterIso,
  );
}

/** The ticket a lost create-request probably made: same subject and message, created since `sentAfterIso`. */
export function findCreatedTicket(
  tickets: readonly SupportTicket[],
  draft: { subject: string; message: string },
  sentAfterIso: string,
): SupportTicket | null {
  const subject = draft.subject.trim();
  const message = draft.message.trim();
  return (
    tickets.find(
      (ticket) =>
        ticket.createdAt >= sentAfterIso && ticket.subject.trim() === subject && ticket.message.trim() === message,
    ) ?? null
  );
}

/* ------------------------------------------------------------------ timeline */

export type TicketEventKind = "created" | "open" | "inProgress" | "resolved" | "closed" | "closedByYou";

export function ticketEventKind(eventType: string): TicketEventKind | null {
  switch (eventType) {
    case "CREATED":
      return "created";
    case "OPEN":
      return "open";
    case "IN_PROGRESS":
      return "inProgress";
    case "RESOLVED":
      return "resolved";
    case "CLOSED":
      return "closed";
    case "CLOSED_BY_CUSTOMER":
      return "closedByYou";
    default:
      return null;
  }
}

export type TicketTimelineItem =
  | { kind: "message"; key: string; message: SupportTicketDetail["messages"][number] }
  | { kind: "event"; key: string; event: TicketEventKind; createdAt: string };

/** Messages and the visible history entries, in time order. Replies are already messages; internal events are hidden. */
export function ticketTimeline(ticket: Pick<SupportTicketDetail, "messages" | "events">): TicketTimelineItem[] {
  const items: TicketTimelineItem[] = ticket.messages.map((message) => ({
    kind: "message" as const,
    key: `m-${message.id}`,
    message,
  }));
  for (const event of ticket.events) {
    const kind = ticketEventKind(event.eventType);
    if (kind && kind !== "created") items.push({ kind: "event", key: `e-${event.id}`, event: kind, createdAt: event.createdAt });
  }
  const at = (item: TicketTimelineItem) => (item.kind === "message" ? item.message.createdAt : item.createdAt);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byTime = String(at(a.item)).localeCompare(String(at(b.item)));
      if (byTime !== 0) return byTime;
      if (a.item.kind !== b.item.kind) return a.item.kind === "event" ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}
