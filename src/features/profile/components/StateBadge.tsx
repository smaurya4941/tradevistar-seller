import { humanizeState, toneForState } from '@tradevistar/seller-api';
import React from 'react';
import { StatusBadge } from '@/design';

/** A verification or approval state as a coloured badge, with the web's tones. */
export function StateBadge({
  state,
  label,
  testID,
}: {
  state: string | null | undefined;
  /** Overrides the humanized state ("Not provided" reads better than "Not Provided"). */
  label?: string;
  testID?: string;
}) {
  const value = state ?? 'NOT_PROVIDED';
  return (
    <StatusBadge
      status={label ?? humanizeState(value)}
      tone={toneForState(value)}
      testID={testID}
    />
  );
}
