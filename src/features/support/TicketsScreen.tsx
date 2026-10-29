/**
 * The ticket list: 20 per page with infinite scroll, status chips (Open, In progress, Resolved,
 * Closed), a search box over ticket number and subject (120 characters), and the total shown by
 * the active filter. Pull to refresh; the first page is kept for offline reading.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  isTicketStatus,
  ticketSearchTerm,
  TICKET_LIMITS,
  TICKET_STATUSES,
  type SupportTicket,
  type TicketStatus,
} from '@tradevistar/seller-api';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import {
  Button,
  colors,
  EmptyState,
  Field,
  SegmentedTabs,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';
import { TicketCard, STATUS_LABEL } from './components/TicketCard';
import { useTicketCounts, useTicketList } from './data';

type Nav = NativeStackNavigationProp<SharedScreens>;
type FilterKey = 'ALL' | TicketStatus;

export function TicketsScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<SharedScreens, 'SupportTickets'>>();
  const initial = route.params?.status;
  const [status, setStatus] = useState<FilterKey>(
    isTicketStatus(initial) ? initial : 'ALL',
  );
  const [text, setText] = useState('');
  const [term, setTerm] = useState<string | undefined>(undefined);
  const [pulling, setPulling] = useState(false);

  // A search waits for a short pause in typing before it asks the server.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(ticketSearchTerm(text)), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const counts = useTicketCounts();
  const list = useTicketList(status === 'ALL' ? undefined : status, term ?? '');
  const total = list.data?.pages[0]?.meta.total;

  const open = useCallback(
    (ticket: SupportTicket) =>
      navigation.navigate('TicketThread', { ticketId: ticket.id }),
    [navigation],
  );

  const countOf = (key: FilterKey): number | undefined => {
    if (!counts.data) return undefined;
    switch (key) {
      case 'ALL':
        return undefined;
      case 'OPEN':
        return counts.data.open;
      case 'IN_PROGRESS':
        return counts.data.inProgress;
      case 'RESOLVED':
        return counts.data.resolved;
      case 'CLOSED':
        return counts.data.closed;
    }
  };

  const header = (
    <View style={styles.header}>
      <Field
        label={t('support.tickets.search')}
        value={text}
        onChangeText={value => setText(value.slice(0, TICKET_LIMITS.searchMax))}
        placeholder={t('support.tickets.searchPlaceholder')}
        leadingIcon="search"
        maxLength={TICKET_LIMITS.searchMax}
        returnKeyType="search"
        autoCorrect={false}
        testID="tickets-search"
      />
      <SegmentedTabs
        testID="tickets-filter"
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'ALL' as FilterKey, label: t('support.filter.all') },
          ...TICKET_STATUSES.map(key => ({
            key: key as FilterKey,
            label: t(STATUS_LABEL[key]),
            count: countOf(key),
          })),
        ]}
      />
      {total !== undefined ? (
        <Text variant="small" color={colors.textMuted} testID="tickets-total">
          {t('support.tickets.total', { count: total })}
        </Text>
      ) : null}
    </View>
  );

  let empty: React.ReactElement;
  if (list.isPending) {
    empty = (
      <View style={styles.stack} testID="tickets-loading">
        <Skeleton height={92} />
        <Skeleton height={92} />
        <Skeleton height={92} />
      </View>
    );
  } else if (list.error && !list.items.length) {
    empty = (
      <EmptyState
        icon="cloud_off"
        title={t('support.tickets.loadFailed')}
        actionLabel={t('common.tryAgain')}
        onAction={() => {
          void list.refetch();
        }}
      />
    );
  } else if (status === 'ALL' && !term) {
    empty = (
      <View style={styles.stack}>
        <EmptyState
          icon="support_agent"
          title={t('support.tickets.empty')}
          message={t('support.tickets.emptyBody')}
        />
        <Button
          label={t('support.new.cta')}
          icon="add"
          onPress={() => navigation.navigate('NewTicket')}
        />
      </View>
    );
  } else {
    empty = (
      <EmptyState
        icon="search_off"
        title={t('support.tickets.noMatch')}
        actionLabel={t('support.filter.clear')}
        onAction={() => {
          setStatus('ALL');
          setText('');
        }}
      />
    );
  }

  return (
    <FlatList
      testID="tickets-list"
      style={styles.root}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <TicketCard ticket={item} onPress={open} />}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      keyboardShouldPersistTaps="handled"
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) {
          void list.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        list.isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} color={colors.primary} />
        ) : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => {
            setPulling(true);
            void Promise.all([list.refetch(), counts.refetch()]).finally(() =>
              setPulling(false),
            );
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.huge },
  header: { gap: spacing.md, marginBottom: spacing.md },
  stack: { gap: spacing.md },
  gap: { height: spacing.md },
  footer: { paddingVertical: spacing.lg },
});
