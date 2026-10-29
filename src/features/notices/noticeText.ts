/**
 * The words on the notice banner and its details sheet. Pure functions of a translator, so the
 * rules (which time line, which paused sentence) are tested without rendering anything.
 */
import {
  durationText,
  formatIstDateTime,
  noticeLabel,
  pausedSummary,
  type NoticeTiming,
  type SiteNotice,
} from '@tradevistar/seller-api';
import type { Translate } from '@/i18n';

/** "2d 4h", "3h 20m", "12m" or "under a minute", in the seller's language. */
export function durationLabel(t: Translate, ms: number): string {
  const parts = durationText(ms);
  return t(`notice.dur.${parts.unit}`, {
    days: parts.days,
    hours: parts.hours,
    minutes: parts.minutes,
  });
}

/** Promotions, maintenance and the API's own messages all run on IST, so notices read the same everywhere. */
export const whenLabel = (iso: string): string => {
  const text = formatIstDateTime(iso);
  return text ? `${text} IST` : '';
};

/** The short time line beside the title; null when there is nothing to say. */
export function timingLabel(
  t: Translate,
  timing: NoticeTiming | null,
): string | null {
  if (!timing) return null;
  switch (timing.type) {
    case 'startsIn':
      return t('notice.startsIn', { time: durationLabel(t, timing.ms) });
    case 'backBy':
      return t('notice.backBy', { when: whenLabel(timing.at) });
    case 'inProgress':
      return t('notice.inProgress');
    case 'eventIn':
      return t('notice.eventIn', {
        when: whenLabel(timing.at),
        time: durationLabel(t, timing.ms),
      });
  }
}

export const labelText = (
  t: Translate,
  notice: Pick<SiteNotice, 'kind' | 'state'>,
): string => t(`notice.label.${noticeLabel(notice)}`);

/** What a maintenance pauses, in a sentence; null for announcements. */
export function pausedText(t: Translate, notice: SiteNotice): string | null {
  const summary = pausedSummary(notice);
  if (!summary) return null;
  if (summary.type === 'all') return t('notice.pausedAll');
  return summary.features.length
    ? t('notice.pausedSome', { features: summary.features.join(', ') })
    : null;
}
