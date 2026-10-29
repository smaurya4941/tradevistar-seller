/**
 * The unsent new-ticket form, kept on the device so leaving the screen (or the app) does not lose
 * what the seller typed. Cleared once the ticket is created, and on sign-out with the rest of the
 * user's storage. It is never logged.
 */
import { readJson, userStorage, UserKeys, writeJson } from '@/core/storage/kv';

export interface StoredTicketDraft {
  subject: string;
  category: string;
  message: string;
}

export const EMPTY_TICKET_DRAFT: StoredTicketDraft = {
  subject: '',
  category: '',
  message: '',
};

export function loadTicketDraft(): StoredTicketDraft {
  const stored = readJson<Partial<StoredTicketDraft>>(
    userStorage,
    UserKeys.ticketDraft,
  );
  return {
    subject: typeof stored?.subject === 'string' ? stored.subject : '',
    category: typeof stored?.category === 'string' ? stored.category : '',
    message: typeof stored?.message === 'string' ? stored.message : '',
  };
}

export function isBlankDraft(draft: StoredTicketDraft): boolean {
  return !draft.subject.trim() && !draft.message.trim() && !draft.category;
}

export function saveTicketDraft(draft: StoredTicketDraft): void {
  if (isBlankDraft(draft)) {
    userStorage.remove(UserKeys.ticketDraft);
    return;
  }
  writeJson(userStorage, UserKeys.ticketDraft, draft);
}

export function clearTicketDraft(): void {
  userStorage.remove(UserKeys.ticketDraft);
}
