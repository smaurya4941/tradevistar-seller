/**
 * Shown under the notice banner while the seller is approved but not KYC-verified: the whole app
 * can be read, but the API refuses changes outside My Profile. The wording is the web's, so both
 * products say the same thing.
 */
import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { navigateToRoute } from '@/app/navigation/navigationRef';
import { track } from '@/core/analytics/analytics';
import { FeatureLockedBanner } from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { useAccess } from './useAccess';

const STATUS_KEY: Record<string, TranslationKey> = {
  PENDING: 'access.status.PENDING',
  SUBMITTED: 'access.status.SUBMITTED',
  REJECTED: 'access.status.REJECTED',
};

/** "Complete verification" opens the KYC and documents screen. */
export function openVerification(): void {
  navigateToRoute({ name: 'Shared', params: { screen: 'Documents' } });
}

export function ViewOnlyBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const { state, kycStatus } = useAccess();
  const status = kycStatus ?? 'PENDING';

  useEffect(() => {
    if (state) track('view_only_banner_seen', { kyc_status: status });
  }, [state, status]);

  if (!state) return null;

  return (
    <FeatureLockedBanner
      kind="viewOnly"
      title={t('access.banner.title')}
      message={`${t('access.banner.body')} ${t(
        STATUS_KEY[status] ?? STATUS_KEY.PENDING,
      )}`}
      actionLabel={t('access.complete')}
      onAction={openVerification}
      style={style}
      testID="view-only-banner"
    />
  );
}
