/**
 * Everything the notice banner needs, in one hook: which notice is showing, where it sits in the
 * rotation, the server-clock "now" its countdown is measured against, and the actions on it.
 *
 * - The list is judged on the server clock (`effectiveNotices`), so a window that started or ended
 *   since the last poll is already right on screen.
 * - With more than one visible notice the banner rotates every 7 s, and stops while the details
 *   sheet is open so the text under the seller's thumb does not change.
 * - A scheduled start or end inside the next poll interval triggers a re-read at that moment.
 */
import {
  effectiveNotices,
  isDismissible,
  nextTransitionMs,
  noticeAt,
  NOTICE_ROTATE_MS,
  NOTICE_TICK_MS,
  visibleNotices,
  type SiteNotice,
} from '@tradevistar/seller-api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppActive } from '@/core/useAppActive';
import { useNow } from '@/core/useNow';
import { useSiteNotices } from './data';
import { dismissNotice, useDismissedNotices } from './dismissedNotices';

/** Re-read a moment after the scheduled instant, so the server has flipped it too. */
const TRANSITION_GRACE_MS = 1_500;

export interface NoticeBoard {
  /** The notice on screen; null when there is nothing to show. */
  notice: SiteNotice | null;
  /** 1-based position in the rotation, and how many are in it. */
  position: number;
  count: number;
  /** Server time, ms since epoch. */
  serverNow: number;
  canDismiss: boolean;
  dismiss: () => void;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}

export function useNoticeBoard(): NoticeBoard {
  const feed = useSiteNotices();
  const { data, refetch } = feed;
  const dismissed = useDismissedNotices();
  const active = useAppActive();
  const now = useNow(NOTICE_TICK_MS, active);
  const [index, setIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const skew = data?.skew ?? 0;
  const serverNow = now + skew;

  const visible = useMemo(
    () =>
      visibleNotices(
        effectiveNotices(data?.notices ?? [], serverNow),
        dismissed,
      ),
    [data?.notices, serverNow, dismissed],
  );

  useEffect(() => {
    if (visible.length < 2 || sheetOpen || !active) return;
    const timer = setInterval(() => setIndex(i => i + 1), NOTICE_ROTATE_MS);
    return () => clearInterval(timer);
  }, [visible.length, sheetOpen, active]);

  useEffect(() => {
    if (!data || !active) return;
    const wait = nextTransitionMs(data.notices, Date.now() + data.skew);
    if (wait === null) return;
    const timer = setTimeout(() => {
      void refetch();
    }, wait + TRANSITION_GRACE_MS);
    return () => clearTimeout(timer);
  }, [data, active, refetch]);

  const notice = noticeAt(visible, index);
  const position = visible.length
    ? (((index % visible.length) + visible.length) % visible.length) + 1
    : 0;

  const dismiss = useCallback(() => {
    if (!notice || !isDismissible(notice)) return;
    dismissNotice(notice.id);
    setSheetOpen(false);
  }, [notice]);

  return {
    notice,
    position,
    count: visible.length,
    serverNow,
    canDismiss: notice ? isDismissible(notice) : false,
    dismiss,
    sheetOpen,
    openSheet: useCallback(() => setSheetOpen(true), []),
    closeSheet: useCallback(() => setSheetOpen(false), []),
  };
}
