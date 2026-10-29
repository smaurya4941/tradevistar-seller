import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Banner } from './Controls';

/**
 * Why something cannot be used right now, shown above the screen it affects.
 * - `viewOnly`: the account is not KYC-verified yet, so changes are refused until it is.
 * - `featureLocked`: the feature is not part of the seller's subscription plan.
 *
 * Phase 0 only defines the component and its props; Phase 1 decides when each one appears.
 */
export type FeatureLockKind = 'viewOnly' | 'featureLocked';

export interface FeatureLockedBannerProps {
  kind: FeatureLockKind;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FeatureLockedBanner({
  kind,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel,
  style,
  testID,
}: FeatureLockedBannerProps) {
  return (
    <Banner
      testID={testID}
      tone={kind === 'viewOnly' ? 'amber' : 'orange'}
      icon={kind === 'viewOnly' ? 'visibility' : 'lock'}
      title={title}
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
      onDismiss={onDismiss}
      dismissLabel={dismissLabel}
      style={style}
    />
  );
}
