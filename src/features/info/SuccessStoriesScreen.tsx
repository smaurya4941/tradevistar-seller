/**
 * Seller success stories: how other sellers grow on TradeVistar, as published in Admin → Footer.
 * A round photo (or the first letter of the name), the seller's name and company, and their quote.
 */
import type { SuccessStory } from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Card,
  colors,
  EmptyState,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { useSuccessStories } from './data';

function Story({ story }: { story: SuccessStory }) {
  return (
    <Card style={styles.story} testID={`story-${story.id}`}>
      <View style={styles.person}>
        <Avatar uri={story.imageUrl} name={story.name} size={52} />
        <View style={styles.flex}>
          <Text variant="cardTitle">{story.name}</Text>
          <Text variant="meta" color={colors.textMuted}>
            {story.company}
          </Text>
        </View>
      </View>
      <Text variant="body" color={colors.onSurfaceVariant} selectable>
        “{story.quote}”
      </Text>
    </Card>
  );
}

export function SuccessStoriesScreen() {
  const t = useT();
  const stories = useSuccessStories();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void stories.refetch().finally(() => setRefreshing(false));
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      testID="screen-success-stories"
    >
      {stories.data === undefined ? (
        stories.isError ? (
          <EmptyState
            icon="cloud_off"
            title={t('info.stories.loadFailed')}
            actionLabel={t('common.tryAgain')}
            onAction={() => {
              void stories.refetch();
            }}
          />
        ) : (
          <View style={styles.content} testID="stories-loading">
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        )
      ) : stories.data.length === 0 ? (
        <EmptyState
          icon="auto_stories"
          title={t('info.stories.empty')}
          message={t('info.stories.emptyBody')}
        />
      ) : (
        stories.data.map(story => <Story key={story.id} story={story} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  story: { gap: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
