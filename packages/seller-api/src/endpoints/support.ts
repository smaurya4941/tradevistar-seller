/**
 * Support: tickets, categories, the knowledge base and announcements.
 *
 * Tickets are the signed-in seller's own (`/me/support-tickets`), allowed while unverified. The
 * API has no idempotency for creating a ticket or posting a reply, so callers re-read the list or
 * thread before retrying a write whose answer was lost (see `domain/ticketRules.ts`).
 */
import { api } from "../http/client";
import { getPage, qs, type Page } from "./paged";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  orderId: string | null;
  orderNumber: string | null;
  category: string | null;
  priority: string;
  status: TicketStatus;
  messageCount: number;
  /** 1–5 stars the seller gave once the ticket was resolved or closed; null until rated. */
  rating: number | null;
  ratingComment: string | null;
  /** Set when the ticket is a KYC document change request: what it asked for and how far it got. */
  changeRequest: { documentType: string; status: string } | null;
  lastActivityAt: string;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  body: string;
  authorUserId: string | null;
  /** True for a reply from the TradeVistar support desk. */
  fromSupport: boolean;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  eventType: string;
  createdAt: string;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: TicketMessage[];
  events: TicketEvent[];
}

export interface TicketCounts {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export interface SupportCategory {
  code: string;
  label: string;
}

export interface TicketListParams {
  status?: TicketStatus;
  category?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const listTickets = (params: TicketListParams = {}, signal?: AbortSignal): Promise<Page<SupportTicket>> =>
  getPage<SupportTicket>(`/me/support-tickets${qs({ ...params })}`, { requireAuth: true, signal });

export const getTicketCounts = (signal?: AbortSignal) =>
  api.get<TicketCounts>("/me/support-tickets-summary", { requireAuth: true, signal });

export const getTicket = (id: string, signal?: AbortSignal) =>
  api.get<SupportTicketDetail>(`/me/support-tickets/${encodeURIComponent(id)}`, { requireAuth: true, signal });

/** The canonical category list (public), so the form and the filters cannot drift apart. */
export const listSupportCategories = (signal?: AbortSignal) =>
  api.get<SupportCategory[]>("/support/categories", { signal });

export interface CreateTicketBody {
  subject: string;
  message: string;
  category?: string;
  orderId?: string;
}

export const createTicket = (body: CreateTicketBody) =>
  api.post<SupportTicket>("/support/tickets", body, { requireAuth: true });

export const replyToTicket = (id: string, body: string) =>
  api.post<SupportTicketDetail>(`/support/tickets/${encodeURIComponent(id)}/messages`, { body }, { requireAuth: true });

export const closeTicket = (id: string) =>
  api.post<SupportTicketDetail>(`/support/tickets/${encodeURIComponent(id)}/close`, undefined, { requireAuth: true });

/** Rates a resolved or closed ticket 1–5 with an optional comment; a new rating replaces the old. */
export const rateTicket = (id: string, rating: number, comment?: string) =>
  api.post<SupportTicketDetail>(
    `/support/tickets/${encodeURIComponent(id)}/rate`,
    comment ? { rating, comment } : { rating },
    { requireAuth: true },
  );

/* ------------------------------------------------------------------ knowledge base */

export interface Faq {
  id: string;
  slug: string;
  category: string;
  /** Question. */
  q: string;
  /** Answer, plain text. */
  a: string;
}

export const listFaqs = (signal?: AbortSignal) =>
  api.get<Faq[]>("/support/faqs?audience=seller", { skipAuth: true, signal });

/** Counts one open of an article. Best effort; the caller sends it once per article per session. */
export const trackFaqView = (id: string) =>
  api.post<{ ok: boolean }>(`/support/faqs/${encodeURIComponent(id)}/view`, undefined, { skipAuth: true });

/** One "Was this helpful? Yes" vote. */
export const trackFaqHelpful = (id: string) =>
  api.post<{ ok: boolean }>(`/support/faqs/${encodeURIComponent(id)}/helpful`, undefined, { skipAuth: true });

export interface Announcement {
  id: string;
  title: string;
  /** Plain text. */
  body: string;
  isPinned: boolean;
  publishAt: string;
  expiresAt: string | null;
}

export const listAnnouncements = (signal?: AbortSignal) =>
  api.get<Announcement[]>("/support/announcements?audience=seller", { skipAuth: true, signal });
