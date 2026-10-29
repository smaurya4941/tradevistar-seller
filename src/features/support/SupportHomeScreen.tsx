/**
 * Support home: three segments like the web — Tickets, Knowledge base, Announcements — and the
 * ways to reach TradeVistar directly (email, call, hours from the app's environment).
 *
 * The Tickets segment shows the counts by state (each opens the list filtered), the most recent
 * tickets, and a button to raise a new one. Support works for unverified sellers too.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SupportTicket, TicketStatus } from '@tradevistar/seller-api';
import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { env } from '@/config/env';
import { refreshSupport, useTicketCounts, useTicketList } from './data';
import {
  Button,
  Card,
  colors,
  EmptyState,
  Icon,
  radii,
  SegmentedTabs,
  Skeleton,
  spacing,
  Text,
} from '@/design';
import type { SharedScreens, SupportSegment } from '@/app/navigation/types';
import { useT } from '@/i18n';
import { Announcements } from './components/Announcements';
import { KnowledgeBase } from './components/KnowledgeBase';
import { TicketCard } from './components/TicketCard';

type Nav = NativeStackNavigationProp<SharedScreens>;

const COUNT_TILES: {
  key: 'open' | 'inProgress' | 'resolved' | 'closed';
  status: TicketStatus;
  label:
    | 'support.status.OPEN'
    | 'support.status.IN_PROGRESS'
    | 'support.status.RESOLVED'
    | 'support.status.CLOSED';
}[] = [
  { key: 'open', status: 'OPEN', label: 'support.status.OPEN' },
  {
    key: 'inProgress',
    status: 'IN_PROGRESS',
    label: 'support.status.IN_PROGRESS',
  },
  { key: 'resolved', status: 'RESOLVED', label: 'support.status.RESOLVED' },
  { key: 'closed', status: 'CLOSED', label: 'support.status.CLOSED' },
];

function ContactCard() {
  const t = useT();
  return (
    <Card style={styles.card} testID="support-contact">
      <Text variant="section" accessibilityRole="header">
        {t('support.contact.title')}
      </Text>
      <View style={styles.buttons}>
        <Button
          label={t('support.contact.email')}
          icon="mail"
          variant="outline"
          onPress={() => {
            void Linking.openURL(`mailto:${env.supportEmail}`);
          }}
          testID="support-email"
        />
        {env.supportPhone ? (
          <Button
            label={t('support.contact.call')}
            icon="call"
            variant="outline"
            onPress={() => {
              void Linking.openURL(`tel:${env.supportPhone}`);
            }}
            testID="support-call"
          />
        ) : null}
      </View>
      <View style={styles.hours}>
        <Icon name="schedule" size={18} color={colors.textMuted} />
        <Text variant="meta" color={colors.textMuted} style={styles.flex}>
          {t('support.contact.hours', { hours: env.supportHours })}
        </Text>
      </View>
    </Card>
  );
}

function TicketsSegment() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const counts = useTicketCounts();
  const list = useTicketList(undefined, '');
  const recent = list.items.slice(0, 3);
  const open = (ticket: SupportTicket) =>
    navigation.navigate('TicketThread', { ticketId: ticket.id });

  return (
    <View style={styles.stack} testID="support-tickets-segment">
      <Button
        label={t('support.new.cta')}
        icon="add"
        onPress={() => navigation.navigate('NewTicket')}
        testID="support-new-ticket"
      />
      <View style={styles.tiles}>
        {COUNT_TILES.map(tile => (
          <Pressable
            key={tile.key}
            onPress={() =>
              navigation.navigate('SupportTickets', { status: tile.status })
            }
            accessibilityRole="button"
            accessibilityLabel={`${t(tile.label)}, ${
              counts.data?.[tile.key] ?? 0
            }`}
            style={styles.tile}
            testID={`support-count-${tile.status}`}
          >
            <Text variant="stat">
              {counts.data ? counts.data[tile.key] : '–'}
            </Text>
            <Text variant="small" color={colors.textMuted}>
              {t(tile.label)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.stack}>
        <View style={styles.row}>
          <Text variant="section" style={styles.flex}>
            {t('support.recent')}
          </Text>
          <Button
            label={t('support.viewAll')}
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate('SupportTickets')}
            testID="support-view-all"
          />
        </View>
        {list.data === undefined ? (
          list.isError ? (
            <EmptyState
              icon="cloud_off"
              title={t('support.tickets.loadFailed')}
              actionLabel={t('common.tryAgain')}
              onAction={() => {
                void list.refetch();
              }}
            />
          ) : (
            <View style={styles.stack}>
              <Skeleton height={92} radius={radii.lg} />
              <Skeleton height={92} radius={radii.lg} />
            </View>
          )
        ) : recent.length === 0 ? (
          <EmptyState
            icon="support_agent"
            title={t('support.tickets.empty')}
            message={t('support.tickets.emptyBody')}
          />
        ) : (
          recent.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} onPress={open} />
          ))
        )}
      </View>
    </View>
  );
}

export function SupportHomeScreen() {
  const t = useT();
  const route = useRoute<RouteProp<SharedScreens, 'SupportHome'>>();
  const [segment, setSegment] = useState<SupportSegment>(
    route.params?.segment ?? 'tickets',
  );
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
            refreshSupport();
            setTimeout(() => setRefreshing(false), 600);
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      keyboardShouldPersistTaps="handled"
      testID="screen-support"
    >
      <ContactCard />
      <SegmentedTabs
        testID="support-segments"
        value={segment}
        onChange={setSegment}
        tabs={[
          { key: 'tickets', label: t('support.segment.tickets') },
          { key: 'knowledge', label: t('support.segment.knowledge') },
          { key: 'announcements', label: t('support.segment.announcements') },
        ]}
      />
      {segment === 'tickets' ? <TicketsSegment /> : null}
      {segment === 'knowledge' ? <KnowledgeBase /> : null}
      {segment === 'announcements' ? <Announcements /> : null}
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
  stack: { gap: spacing.md },
  flex: { flex: 1 },
  card: { gap: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  hours: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '22%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
