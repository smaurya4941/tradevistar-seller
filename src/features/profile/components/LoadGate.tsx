/**
 * Loading, error and "last updated" handling for a profile read, so every screen treats a slow or
 * failed read the same way: a skeleton, then the content; or the stored copy with an offline
 * label; or a retry card when there is nothing to show.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  colors,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { profileErrorMessage } from '../errors';

export function LoadGate<T>({
  query,
  updatedLabel,
  children,
}: {
  query: Pick<
    UseQueryResult<T>,
    'data' | 'isPending' | 'isError' | 'error' | 'refetch'
  >;
  updatedLabel?: string;
  children: (data: T) => React.ReactNode;
}) {
  const t = useT();
  if (query.data !== undefined) {
    return (
      <>
        {query.isError ? (
          <Banner tone="amber" message={profileErrorMessage(query.error, t)} />
        ) : null}
        {updatedLabel ? (
          <Text variant="small" color={colors.textMuted}>
            {updatedLabel}
          </Text>
        ) : null}
        {children(query.data)}
      </>
    );
  }
  if (query.isPending) {
    return (
      <View style={styles.skeleton} accessibilityLabel={t('common.loading')}>
        <Skeleton height={20} width="60%" />
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </View>
    );
  }
  return (
    <Card style={styles.error}>
      <Text variant="body" color={colors.onSurfaceVariant}>
        {profileErrorMessage(query.error, t)}
      </Text>
      <Button
        label={t('common.tryAgain')}
        variant="outline"
        onPress={() => {
          void query.refetch();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: spacing.md },
  error: { gap: spacing.md },
});
