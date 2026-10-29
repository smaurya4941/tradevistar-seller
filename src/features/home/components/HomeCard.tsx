/**
 * The frame of every Home card: a title, optional action, and the three states of its own query —
 * a skeleton while the first answer loads, an inline error with a retry when it failed and there
 * is nothing to show, and the content otherwise. One card failing never blanks the screen.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  colors,
  Icon,
  InlineLink,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';

export function CardHeader({
  title,
  badge,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  /** A small tag at the end of the row ("2 urgent"). */
  badge?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.header}>
      <Text variant="section" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {badge}
      {actionLabel && onAction ? (
        <InlineLink label={actionLabel} onPress={onAction} testID={testID} />
      ) : null}
    </View>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeleton} testID="card-skeleton">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          height={18}
          width={index === 0 ? '60%' : '100%'}
        />
      ))}
    </View>
  );
}

export function CardError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <View style={styles.error} accessibilityRole="alert" testID="card-error">
      <Icon name="error" size={20} color={colors.error} />
      <Text variant="meta" color={colors.textMuted} style={styles.errorText}>
        {t('home.card.error')}
      </Text>
      <Button
        label={t('common.tryAgain')}
        variant="outline"
        size="sm"
        onPress={onRetry}
      />
    </View>
  );
}

export interface HomeCardProps<T> {
  title: string;
  query: UseQueryResult<T>;
  /** Hides the card while true, e.g. an analytics card on a plan that does not include it. */
  hidden?: boolean;
  skeletonRows?: number;
  badge?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
  /** Replaces the content when the data is empty. */
  empty?: (data: T) => boolean;
  emptyText?: string;
  testID?: string;
  children: (data: T) => React.ReactNode;
}

export function HomeCard<T>({
  title,
  query,
  hidden = false,
  skeletonRows,
  badge,
  actionLabel,
  onAction,
  actionTestID,
  empty,
  emptyText,
  testID,
  children,
}: HomeCardProps<T>) {
  if (hidden) return null;
  const { data } = query;
  return (
    <Card testID={testID} style={styles.card}>
      <CardHeader
        title={title}
        badge={badge}
        actionLabel={actionLabel}
        onAction={onAction}
        testID={actionTestID}
      />
      {data === undefined ? (
        query.isError ? (
          <CardError
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <CardSkeleton rows={skeletonRows} />
        )
      ) : empty?.(data) ? (
        <Text variant="meta" color={colors.textMuted}>
          {emptyText}
        </Text>
      ) : (
        children(data)
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  skeleton: { gap: spacing.md },
  error: { gap: spacing.sm, alignItems: 'flex-start' },
  errorText: { alignSelf: 'stretch' },
});
