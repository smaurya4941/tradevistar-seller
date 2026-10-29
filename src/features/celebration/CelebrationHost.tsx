/**
 * Plays an announcement's celebration when its event time arrives, anywhere in the app.
 *
 * It watches the same notice feed as the banner. The next due celebration (soonest event time,
 * not yet played on this device) starts on the server clock — immediately when its time has passed
 * but its window has not, so opening the app mid-celebration plays what is left. One plays at a
 * time; it is marked played as it starts, so a restart never replays it. Nothing starts while the
 * app is in the background.
 */
import { celebrationPlans, MAX_TIMER_MS } from '@tradevistar/seller-api';
import type { CelebrationPlan } from '@tradevistar/seller-api';
import React, { useCallback, useEffect, useState } from 'react';
import { useAppActive } from '@/core/useAppActive';
import { useSiteNotices } from '@/features/notices/data';
import { markCelebrated, useCelebrated } from './celebrated';
import { CelebrationOverlay } from './CelebrationOverlay';

interface Playing {
  plan: CelebrationPlan;
  /** Device clock, ms since epoch. */
  until: number;
}

export function CelebrationHost() {
  const feed = useSiteNotices();
  const active = useAppActive();
  const celebrated = useCelebrated();
  const [playing, setPlaying] = useState<Playing | null>(null);
  const data = feed.data;

  useEffect(() => {
    if (!data || !active || playing) return;
    const serverNow = Date.now() + data.skew;
    const next = celebrationPlans(data.notices, serverNow, celebrated)[0];
    if (!next) return;
    const start = () => {
      markCelebrated(next.id);
      setPlaying({ plan: next, until: next.untilAt - data.skew });
    };
    const delay = next.startsAt - serverNow;
    if (delay <= 0) {
      start();
      return;
    }
    // Further off than a timer can wait: a later poll picks it up.
    if (delay > MAX_TIMER_MS) return;
    const timer = setTimeout(start, delay);
    return () => clearTimeout(timer);
  }, [data, active, playing, celebrated]);

  const done = useCallback(() => setPlaying(null), []);

  if (!playing) return null;
  return (
    <CelebrationOverlay
      key={playing.plan.id}
      kind={playing.plan.kind}
      title={playing.plan.title}
      message={playing.plan.message}
      until={playing.until}
      onDone={done}
    />
  );
}
