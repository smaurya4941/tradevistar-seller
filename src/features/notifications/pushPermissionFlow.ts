/**
 * Asking for the Android notification permission, in the order Android needs:
 *   1. our own explainer sheet first (the system prompt can be shown only once or twice before
 *      Android stops asking),
 *   2. the system prompt only if the seller agrees,
 *   3. if the permission is blocked, how to switch it on in system settings.
 *
 * Anything can start the flow (the Push switch in preferences, a card in the Inbox) with
 * `askForPushPermission()` and gets the outcome back; `PushPermissionHost` draws the sheets.
 */
import { track } from '@/core/analytics/analytics';
import {
  getPushPermission,
  markPushExplainerSeen,
  requestPushPermission,
  type PushPermission,
} from '@/core/push/permission';
import { createStore } from '@/core/store';

export type PushFlowResult = PushPermission | 'dismissed';

export type PushFlowState =
  | { kind: 'closed' }
  | { kind: 'explain' }
  | { kind: 'blocked' };

export const pushFlowStore = createStore<PushFlowState>({ kind: 'closed' });

let pending: ((result: PushFlowResult) => void) | null = null;

function settle(result: PushFlowResult): void {
  pushFlowStore.set({ kind: 'closed' });
  const resolve = pending;
  pending = null;
  resolve?.(result);
}

/** Starts the flow. Resolves with the permission, or 'dismissed' when the seller backs out. */
export async function askForPushPermission(): Promise<PushFlowResult> {
  const current = await getPushPermission();
  if (current === 'granted') return 'granted';
  // A second ask replaces the first, which is treated as backed out.
  pending?.('dismissed');
  return new Promise<PushFlowResult>(resolve => {
    pending = resolve;
    pushFlowStore.set({ kind: current === 'blocked' ? 'blocked' : 'explain' });
  });
}

/** The seller agreed on the explainer: show the system prompt. */
export async function confirmExplainer(): Promise<void> {
  markPushExplainerSeen();
  const result = await requestPushPermission();
  track('push_permission_result', { result });
  if (result === 'blocked') {
    // The system will not ask again: tell the seller where to switch it on.
    pushFlowStore.set({ kind: 'blocked' });
    return;
  }
  settle(result);
}

export function dismissPushFlow(result: PushFlowResult = 'dismissed'): void {
  settle(result);
}
