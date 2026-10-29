/**
 * The helper every later phase uses for a write action (save, send, submit, delete…).
 *
 * - `useVerifiedWrite(path?)` says whether the seller can write, and `guard(fn)` runs the action or,
 *   for a view-only seller, opens the "verification required" sheet instead.
 * - `VerifiedButton` is a Button that looks disabled while the seller is view-only, but still
 *   answers a tap with the sheet, so the seller learns why instead of facing a dead button.
 *
 * Pass the API `path` the action calls when it is one of the areas the backend lets an unverified
 * seller write to (profile, KYC, support…): `isWriteAllowedWhileUnverified` is the one list that
 * decides, so such a button stays enabled.
 */
import { isWriteAllowedWhileUnverified } from '@tradevistar/seller-api';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, type ButtonVariant } from '@/design/components/Button';
import { useT } from '@/i18n';
import { useAccess } from './useAccess';
import { openVerificationSheet } from './verificationSheetStore';

export function useVerifiedWrite(path?: string): {
  canWrite: boolean;
  guard: <A extends unknown[]>(
    action: (...args: A) => void,
  ) => (...args: A) => void;
} {
  const access = useAccess();
  const canWrite =
    access.canWrite ||
    (path !== undefined && isWriteAllowedWhileUnverified(path));
  const guard = useCallback(
    <A extends unknown[]>(action: (...args: A) => void) =>
      (...args: A) => {
        if (canWrite) action(...args);
        else openVerificationSheet('tap', access.kycStatus);
      },
    [canWrite, access.kycStatus],
  );
  return { canWrite, guard };
}

export interface VerifiedButtonProps {
  label: string;
  onPress: () => void;
  /** The API path this button writes to; see `useVerifiedWrite`. */
  path?: string;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
  testID?: string;
}

export function VerifiedButton({
  path,
  onPress,
  ...rest
}: VerifiedButtonProps) {
  const t = useT();
  const { canWrite } = useVerifiedWrite(path);
  const { kycStatus } = useAccess();
  if (canWrite) return <Button {...rest} onPress={onPress} />;
  return (
    <View style={rest.fullWidth ? styles.full : undefined}>
      <Button {...rest} disabled onPress={onPress} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => openVerificationSheet('tap', kycStatus)}
        accessibilityRole="button"
        accessibilityLabel={`${rest.label}. ${t('access.sheet.title')}`}
        accessibilityHint={t('access.sheet.body')}
        testID={rest.testID ? `${rest.testID}-locked` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({ full: { alignSelf: 'stretch' } });
