/**
 * The knowledge base: articles grouped by category (collapsible), a search box over question and
 * answer text, and per-article "Was this helpful? Yes". Plain text throughout.
 */
import {
  trackFaqHelpful,
  trackFaqView,
  type Faq,
} from '@tradevistar/seller-api';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { track } from '@/core/analytics/analytics';
import {
  Button,
  Card,
  colors,
  EmptyState,
  Field,
  Icon,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { useFaqs } from '../data';
import {
  filterFaqs,
  forgetVote,
  groupFaqs,
  hasVoted,
  rememberVote,
  shouldCountView,
} from '../knowledge';

function Article({ faq }: { faq: Faq }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState(() => hasVoted(faq.id));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      track('faq_opened', {});
      // One view per article per session; counting is best effort.
      if (shouldCountView(faq.id)) {
        trackFaqView(faq.id).catch(() => undefined);
      }
    }
  };

  const helpful = () => {
    if (!rememberVote(faq.id)) {
      setVoted(true);
      return;
    }
    setVoted(true);
    track('faq_helpful', {});
    trackFaqHelpful(faq.id).catch(() => {
      forgetVote(faq.id);
      setVoted(false);
    });
  };

  return (
    <View style={styles.article} testID={`faq-${faq.id}`}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={faq.q}
        style={styles.question}
        testID={`faq-question-${faq.id}`}
      >
        <Text variant="cardTitle" style={styles.flex}>
          {faq.q}
        </Text>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          size={22}
          color={colors.outline}
        />
      </Pressable>
      {open ? (
        <View style={styles.answer}>
          <Text variant="body" color={colors.onSurfaceVariant} selectable>
            {faq.a}
          </Text>
          {voted ? (
            <Text
              variant="small"
              color={colors.textMuted}
              testID={`faq-thanks-${faq.id}`}
            >
              {t('support.kb.thanks')}
            </Text>
          ) : (
            <View style={styles.vote}>
              <Text variant="small" color={colors.textMuted}>
                {t('support.kb.helpful')}
              </Text>
              <Button
                label={t('support.kb.yes')}
                size="sm"
                variant="outline"
                icon="thumb_up"
                onPress={helpful}
                testID={`faq-helpful-${faq.id}`}
              />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function KnowledgeBase() {
  const t = useT();
  const faqs = useFaqs();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const groups = useMemo(
    () => groupFaqs(filterFaqs(faqs.data ?? [], query)),
    [faqs.data, query],
  );
  const searching = query.trim().length > 0;

  if (faqs.data === undefined) {
    return faqs.isError ? (
      <EmptyState
        icon="cloud_off"
        title={t('support.kb.loadFailed')}
        actionLabel={t('common.tryAgain')}
        onAction={() => {
          void faqs.refetch();
        }}
      />
    ) : (
      <View style={styles.stack} testID="kb-loading">
        <Skeleton height={48} />
        <Skeleton height={120} />
      </View>
    );
  }

  return (
    <View style={styles.stack} testID="knowledge-base">
      <Field
        label={t('support.kb.search')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('support.kb.searchPlaceholder')}
        leadingIcon="search"
        returnKeyType="search"
        autoCorrect={false}
        testID="kb-search"
      />
      {groups.length === 0 ? (
        <EmptyState
          icon="search_off"
          title={searching ? t('support.kb.noMatch') : t('support.kb.empty')}
        />
      ) : (
        groups.map(group => {
          // A search opens every group that has a match.
          const isCollapsed = !searching && collapsed.has(group.category);
          return (
            <Card key={group.category} style={styles.group}>
              <Pressable
                onPress={() =>
                  setCollapsed(current => {
                    const next = new Set(current);
                    if (next.has(group.category)) next.delete(group.category);
                    else next.add(group.category);
                    return next;
                  })
                }
                accessibilityRole="button"
                accessibilityState={{ expanded: !isCollapsed }}
                accessibilityLabel={`${group.title}, ${group.faqs.length}`}
                style={styles.groupHeader}
                testID={`kb-group-${group.category}`}
              >
                <Text variant="section" style={styles.flex}>
                  {group.title}
                </Text>
                <Text variant="small" color={colors.textMuted}>
                  {group.faqs.length}
                </Text>
                <Icon
                  name={isCollapsed ? 'expand_more' : 'expand_less'}
                  size={22}
                  color={colors.outline}
                />
              </Pressable>
              {isCollapsed
                ? null
                : group.faqs.map(faq => <Article key={faq.id} faq={faq} />)}
            </Card>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  flex: { flex: 1 },
  group: { gap: spacing.xs },
  groupHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  article: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  question: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  answer: { gap: spacing.md, paddingBottom: spacing.md },
  vote: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
