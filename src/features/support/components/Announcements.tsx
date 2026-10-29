/** Announcements from TradeVistar: pinned first, then newest, with the publish date. Plain text. */
import { formatFullDate, type Announcement } from '@tradevistar/seller-api';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Card,
  colors,
  EmptyState,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { useAnnouncements } from '../data';

/** Pinned first; within each group the newest publication first. */
export function sortAnnouncements(
  items: readonly Announcement[],
): Announcement[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.publishAt.localeCompare(a.publishAt);
  });
}

export function Announcements() {
  const t = useT();
  const query = useAnnouncements();
  const items = useMemo(
    () => sortAnnouncements(query.data ?? []),
    [query.data],
  );

  if (query.data === undefined) {
    return query.isError ? (
      <EmptyState
        icon="cloud_off"
        title={t('support.announcements.loadFailed')}
        actionLabel={t('common.tryAgain')}
        onAction={() => {
          void query.refetch();
        }}
      />
    ) : (
      <View style={styles.stack} testID="announcements-loading">
        <Skeleton height={96} />
        <Skeleton height={96} />
      </View>
    );
  }
  if (!items.length) {
    return (
      <EmptyState
        icon="campaign"
        title={t('support.announcements.empty')}
        message={t('support.announcements.emptyBody')}
      />
    );
  }
  return (
    <View style={styles.stack} testID="announcements">
      {items.map(item => (
        <Card
          key={item.id}
          style={styles.card}
          testID={`announcement-${item.id}`}
        >
          <View style={styles.head}>
            <Text variant="cardTitle" style={styles.title}>
              {item.title}
            </Text>
            {item.isPinned ? (
              <Badge
                label={t('support.announcements.pinned')}
                tone="orange"
                icon="push_pin"
              />
            ) : null}
          </View>
          <Text variant="body" color={colors.onSurfaceVariant} selectable>
            {item.body}
          </Text>
          <Text variant="small" color={colors.textMuted}>
            {formatFullDate(item.publishAt)}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
});
