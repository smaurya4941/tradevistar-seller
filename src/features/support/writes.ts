/**
 * Support writes with duplicate protection. The API has no idempotency for creating a ticket or
 * posting a reply, so a write whose answer was lost (a timeout, a dropped connection) may or may
 * not have gone through. Before sending the same thing again, the app looks: the ticket list for
 * a ticket made, or the thread for a reply posted since the first attempt. Only when it is not
 * there is it sent again.
 *
 * The dependencies are passed in, so the rules are tested without a network.
 */
import {
  ApiError,
  findCreatedTicket,
  replyAlreadyPosted,
  type CreateTicketBody,
  type SupportTicket,
  type SupportTicketDetail,
} from '@tradevistar/seller-api';

/** A failure that leaves it unknown whether the server acted. */
export function isAmbiguousFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return (
    error.isNetworkError ||
    error.statusCode === 0 ||
    error.statusCode === 408 ||
    error.statusCode === 429 ||
    error.statusCode >= 500
  );
}

export interface TicketWriteDeps {
  create(body: CreateTicketBody): Promise<SupportTicket>;
  /** The newest page of the seller's tickets. */
  recent(): Promise<SupportTicket[]>;
  now?(): number;
}

interface Attempt {
  subject: string;
  message: string;
  sentAt: string;
}

/** Creates tickets; remembers an attempt that failed ambiguously so the retry looks first. */
export class TicketCreator {
  private attempt: Attempt | null = null;

  constructor(private readonly deps: TicketWriteDeps) {}

  async submit(body: CreateTicketBody): Promise<SupportTicket> {
    const same =
      this.attempt &&
      this.attempt.subject === body.subject &&
      this.attempt.message === body.message;
    if (same && this.attempt) {
      const made = await this.lookup(this.attempt);
      if (made) {
        this.attempt = null;
        return made;
      }
    }
    const sentAt = new Date(
      (this.deps.now ?? Date.now)() - 1_000,
    ).toISOString();
    try {
      const ticket = await this.deps.create(body);
      this.attempt = null;
      return ticket;
    } catch (error) {
      this.attempt = isAmbiguousFailure(error)
        ? { subject: body.subject, message: body.message, sentAt }
        : null;
      throw error;
    }
  }

  private async lookup(attempt: Attempt): Promise<SupportTicket | null> {
    try {
      return findCreatedTicket(
        await this.deps.recent(),
        attempt,
        attempt.sentAt,
      );
    } catch {
      // Could not look; sending again is the only way forward.
      return null;
    }
  }

  reset(): void {
    this.attempt = null;
  }
}

export interface ReplyWriteDeps {
  reply(ticketId: string, body: string): Promise<SupportTicketDetail>;
  thread(ticketId: string): Promise<SupportTicketDetail>;
  now?(): number;
}

/** Posts replies; a retry after an ambiguous failure first checks the thread for the reply. */
export class ReplySender {
  private attempt: { ticketId: string; body: string; sentAt: string } | null =
    null;

  constructor(private readonly deps: ReplyWriteDeps) {}

  async send(ticketId: string, body: string): Promise<SupportTicketDetail> {
    const text = body.trim();
    const attempt = this.attempt;
    if (attempt && attempt.ticketId === ticketId && attempt.body === text) {
      try {
        const thread = await this.deps.thread(ticketId);
        if (replyAlreadyPosted(thread, text, attempt.sentAt)) {
          this.attempt = null;
          return thread;
        }
      } catch {
        // Could not look; sending again is the only way forward.
      }
    }
    const sentAt = new Date(
      (this.deps.now ?? Date.now)() - 1_000,
    ).toISOString();
    try {
      const detail = await this.deps.reply(ticketId, text);
      this.attempt = null;
      return detail;
    } catch (error) {
      this.attempt = isAmbiguousFailure(error)
        ? { ticketId, body: text, sentAt }
        : null;
      throw error;
    }
  }

  reset(): void {
    this.attempt = null;
  }
}
