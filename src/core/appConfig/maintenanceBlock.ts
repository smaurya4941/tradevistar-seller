/**
 * The last write the API refused because a maintenance window pauses it (503 MAINTENANCE_MODE).
 *
 * Maintenance only pauses writes; reads always work. So a refusal is shown as a message over
 * whatever screen the seller is on, never as a screen that replaces the app, and nobody is signed
 * out. The message is the server's own; `endsAt` (when present) adds "Available again at …".
 */
import { createStore, useStore } from '@/core/store';

export interface MaintenanceBlock {
  message: string | null;
  /** ISO time the window is due to end, or null when it is open-ended. */
  endsAt: string | null;
  /** Bumps on every refusal so the message re-opens even when the text is the same. */
  seq: number;
}

export const maintenanceBlockStore = createStore<MaintenanceBlock | null>(null);

let seq = 0;

export function showMaintenanceBlock(
  message: string | null,
  endsAt: string | null,
): void {
  seq += 1;
  maintenanceBlockStore.set({ message, endsAt, seq });
}

export function dismissMaintenanceBlock(): void {
  maintenanceBlockStore.set(null);
}

export function useMaintenanceBlock(): MaintenanceBlock | null {
  return useStore(maintenanceBlockStore);
}
