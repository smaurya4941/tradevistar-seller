/**
 * Android notification channels, one per notification category, created at startup. A seller can
 * then mute, say, quotes without muting orders from the system settings. Creating an existing
 * channel is a no-op, so this runs on every launch.
 *
 * The sound of a system notification comes from its channel and cannot be changed remotely; the
 * admin-uploaded sound plays only for alerts raised while the app is open.
 */
import notifee, { AndroidImportance } from '@notifee/react-native';
import { PUSH_CHANNELS } from '@tradevistar/seller-api';
import { Platform } from 'react-native';

const IMPORTANCE = {
  high: AndroidImportance.HIGH,
  default: AndroidImportance.DEFAULT,
  low: AndroidImportance.LOW,
} as const;

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannels(
    PUSH_CHANNELS.map(channel => ({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      importance: IMPORTANCE[channel.importance],
    })),
  );
}
