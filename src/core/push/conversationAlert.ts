/**
 * Message alerts and the open chat. A chat message notification names its conversation; while
 * that conversation is on screen the alert is silenced (the thread refreshes itself). Phase 6
 * sets `visibleThreadStore` from the chat screen.
 */
import {
  conversationIdOf,
  type SellerNotification,
} from '@tradevistar/seller-api';
import type { AlertData } from './alertPayload';
import { visibleThreadStore } from './visibleThread';

/** The conversation a stored alert (its data payload) is about, if any. */
export function conversationIdFor(data: AlertData | undefined): string | null {
  if (!data?.type?.startsWith('message.')) return null;
  const id = data.conversationId;
  return id ? id : null;
}

/** True when the notification is a message for the conversation the seller is reading right now. */
export function isForOpenConversation(
  row: Pick<SellerNotification, 'type' | 'metadata'>,
  openConversationId: string | null = visibleThreadStore.get(),
): boolean {
  if (!openConversationId) return false;
  return conversationIdOf(row) === openConversationId;
}
