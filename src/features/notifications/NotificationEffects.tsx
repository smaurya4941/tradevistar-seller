/**
 * Everything that runs in the background of a signed-in session, mounted once under the
 * navigator:
 * - the notifications socket (connected only while signed in);
 * - the Android notification channels and tap handling for system alerts;
 * - the launcher-icon number, which follows the unread total;
 * - a changed `conversationRevision` (a message arrived, or a thread was read elsewhere)
 *   refreshing the conversation list and open threads;
 * - arrivals: an in-app banner and the platform sound in the foreground, a system notification
 *   in the background, never for old rows on a cold start;
 * - the device's push registration, dormant until the API has a route for it.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrivalTracker,
  FRESH_ARRIVAL_MS,
  getNotificationSound,
  type SellerNotification,
} from '@tradevistar/seller-api';
import { useEffect, useRef } from 'react';
import { useSession } from '@/core/auth/SessionProvider';
import { logger } from '@/core/logger';
import { ensureNotificationChannels } from '@/core/push/channels';
import { isForOpenConversation } from '@/core/push/conversationAlert';
import { syncLauncherBadge } from '@/core/push/launcherBadge';
import {
  displayLocalAlert,
  startAlertListeners,
} from '@/core/push/localAlerts';
import { registerForPush } from '@/core/push/pushRegistration';
import { invalidateChats } from '@/core/query/queryClient';
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
} from '@/core/realtime/notificationSocket';
import {
  useLiveSnapshot,
  useSnapshotScope,
} from '@/core/realtime/liveSnapshot';
import {
  playNotificationSound,
  prepareNotificationSound,
} from '@/core/sound/notificationSound';
import { useNotificationSoundEnabled } from '@/core/sound/soundPreference';
import { readJson, userStorage, UserKeys, writeJson } from '@/core/storage/kv';
import { useAppActive } from '@/core/useAppActive';
import { showArrivalBanner } from './arrivalBannerStore';
import { handleArrivals } from './handleArrivals';

type SeenEntry = [string, string];

function restoreSeen(): SeenEntry[] {
  const stored = readJson<SeenEntry[]>(userStorage, UserKeys.seenNotifications);
  return Array.isArray(stored) ? stored : [];
}

function persistSeen(tracker: ArrivalTracker): void {
  try {
    writeJson(userStorage, UserKeys.seenNotifications, tracker.entries());
  } catch (error) {
    logger.info('[alerts] could not store the seen list', error);
  }
}

export function NotificationEffects(): null {
  const session = useSession();
  const scope = useSnapshotScope();
  const queryClient = useQueryClient();
  const snapshot = useLiveSnapshot();
  const soundEnabled = useNotificationSoundEnabled();
  const active = useAppActive();

  // The socket lives exactly as long as the signed-in session.
  useEffect(() => {
    if (!scope) return;
    connectNotificationSocket();
    return () => disconnectNotificationSocket();
  }, [scope]);

  // Channels and tap handling for system alerts.
  useEffect(() => {
    if (!scope) return;
    ensureNotificationChannels().catch(error =>
      logger.warn('[push] could not create channels', error),
    );
    return startAlertListeners();
  }, [scope]);

  // The launcher-icon number follows the unread total.
  const unread = snapshot?.unreadNotifications ?? 0;
  useEffect(() => {
    void syncLauncherBadge(scope ? unread : 0);
  }, [scope, unread]);

  // A message arrived or a thread was read elsewhere: chats refresh.
  const revision = snapshot?.conversationRevision;
  const lastRevision = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (revision === undefined) return;
    if (
      lastRevision.current !== undefined &&
      lastRevision.current !== revision
    ) {
      invalidateChats(queryClient);
    }
    lastRevision.current = revision;
  }, [revision, queryClient]);

  // Server push registration; a 404 is remembered for a day.
  const user = session.status === 'signedIn' ? session.user : null;
  useEffect(() => {
    if (!user) return;
    registerForPush(user).catch(error =>
      logger.info('[push] registration failed', error),
    );
  }, [user]);

  // The platform sound, downloaded once per version.
  const soundVersion = snapshot?.soundVersion;
  const sound = useQuery({
    queryKey: ['notification-sound', scope ?? 'anon', soundVersion],
    queryFn: async ({ signal }) =>
      prepareNotificationSound(await getNotificationSound(signal)),
    enabled:
      scope !== null &&
      soundVersion !== undefined &&
      soundVersion >= 0 &&
      soundEnabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  const soundPath = sound.data ?? null;

  // Arrivals. The tracker starts from the stored list, and its first snapshot is a baseline.
  const tracker = useRef<ArrivalTracker<SellerNotification> | null>(null);
  const trackerScope = useRef<string | null>(null);
  useEffect(() => {
    // Signing out forgets what was seen, so the next sign-in starts from a fresh baseline.
    if (!scope) {
      tracker.current = null;
      trackerScope.current = null;
    }
  }, [scope]);

  useEffect(() => {
    if (!snapshot || !scope) return;
    if (trackerScope.current !== scope || !tracker.current) {
      trackerScope.current = scope;
      tracker.current = new ArrivalTracker<SellerNotification>(restoreSeen());
    }
    const arrived = tracker.current.update(snapshot.notifications, {
      maxAgeMs: FRESH_ARRIVAL_MS,
    });
    persistSeen(tracker.current);
    if (!arrived.length) return;
    handleArrivals(arrived, {
      appActive: active,
      soundEnabled,
      soundPath,
      unreadTotal: snapshot.unreadNotifications,
      isOpenConversation: row => isForOpenConversation(row),
      showBanner: showArrivalBanner,
      playSound: path => {
        void playNotificationSound(path);
      },
      showSystemAlert: (row, total) => {
        void displayLocalAlert(row, total);
      },
    });
    // Only a new snapshot can be an arrival; the other inputs just decide how to announce it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  return null;
}
