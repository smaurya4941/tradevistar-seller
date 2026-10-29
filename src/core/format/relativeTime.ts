/** "5m ago", "3h ago", "2d ago": the words for `relativeTimeOf`, through the message files. */
import { relativeTimeOf } from '@tradevistar/seller-api';
import type { Translate } from '@/i18n';

export function relativeLabel(
  t: Translate,
  iso: string,
  now: number = Date.now(),
): string {
  const rel = relativeTimeOf(iso, now);
  switch (rel.unit) {
    case 'now':
      return t('time.now');
    case 'minutes':
      return t('time.minutes', { count: rel.count });
    case 'hours':
      return t('time.hours', { count: rel.count });
    case 'days':
      return t('time.days', { count: rel.count });
  }
}
