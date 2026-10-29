/**
 * The three activity lists on Home: recent orders, the inquiry centre and shipment tracking. Each
 * is its own query and its own card; rows open the owning area (placeholders until Phases 6 and 7).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  formatDayMonth,
  formatRupees,
  orderStatusOf,
  ORDER_STATUS_TONE,
  type InquirySummary,
  type Page,
  type RecentOrder,
  type ShipmentSummary,
  type StatusTone,
} from '@tradevistar/seller-api';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { openRoute } from '@/app/navigation/openHref';
import {
  Badge,
  colors,
  Divider,
  HIT_TARGET,
  Icon,
  palette,
  spacing,
  StatusBadge,
  Text,
} from '@/design';
import { relativeLabel } from '@/core/format/relativeTime';
import { useT } from '@/i18n';
import { orderStatusLabel } from '../statusLabels';
import { HomeCard } from './HomeCard';

const SHIPMENT_TONE: Record<string, StatusTone> = {
  DELIVERED: 'green',
  OUT_FOR_DELIVERY: 'green',
  IN_TRANSIT: 'blue',
  PICKED_UP: 'blue',
  LABEL_CREATED: 'gray',
  CUSTOMS_CLEARANCE: 'orange',
  FAILED: 'red',
  CANCELLED: 'red',
  RETURNED: 'orange',
};

function Row({
  onPress,
  testID,
  label,
  children,
}: {
  onPress: () => void;
  testID?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceContainerLow },
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ recent orders */

export function RecentOrdersCard({
  query,
}: {
  query: UseQueryResult<Page<RecentOrder>>;
}) {
  const t = useT();
  const open = (extra?: Record<string, string>) =>
    openRoute({
      name: 'Main',
      params: { screen: 'Orders', ...(extra ? { query: extra } : {}) },
    });
  return (
    <HomeCard
      title={t('home.orders.title')}
      query={query}
      actionLabel={t('home.viewAll')}
      actionTestID="orders-view-all"
      onAction={() => open()}
      empty={page => page.items.length === 0}
      emptyText={t('home.orders.empty')}
      testID="recent-orders"
    >
      {page => (
        <View>
          {page.items.map((order, index) => {
            const status = orderStatusOf(order.deliveryStatus);
            return (
              <React.Fragment key={order.id ?? order.orderNumber}>
                {index > 0 ? <Divider /> : null}
                <Row
                  testID={`order-row-${order.orderNumber}`}
                  label={`${order.orderNumber}, ${order.buyer}, ${formatRupees(
                    order.amount,
                  )}`}
                  onPress={() => open({ order: order.id })}
                >
                  <View style={styles.main}>
                    <Text variant="cardTitle">{order.orderNumber}</Text>
                    <Text
                      variant="meta"
                      color={colors.textMuted}
                      numberOfLines={1}
                    >
                      {order.buyer}
                    </Text>
                  </View>
                  <View style={styles.end}>
                    <Text variant="cardTitle">
                      {formatRupees(order.amount)}
                    </Text>
                    <StatusBadge
                      status={
                        status
                          ? orderStatusLabel(t, status)
                          : order.deliveryStatus
                      }
                      isEnum={!status}
                      tone={status ? ORDER_STATUS_TONE[status] : 'gray'}
                    />
                  </View>
                </Row>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </HomeCard>
  );
}

/* ------------------------------------------------------------------ inquiries */

export function InquiryCenterCard({
  query,
}: {
  query: UseQueryResult<Page<InquirySummary>>;
}) {
  const t = useT();
  const urgent = query.data?.items.filter(item => item.urgent).length ?? 0;
  return (
    <HomeCard
      title={t('home.inquiries.title')}
      query={query}
      badge={
        query.data ? (
          <Badge
            label={t('home.inquiries.urgent', { count: urgent })}
            tone={urgent ? 'orange' : 'slate'}
          />
        ) : undefined
      }
      actionLabel={t('home.viewAll')}
      actionTestID="inquiries-view-all"
      onAction={() =>
        openRoute({ name: 'Section', params: { sectionId: 'inquiries' } })
      }
      empty={page => page.items.length === 0}
      emptyText={t('home.inquiries.empty')}
      testID="inquiry-center"
    >
      {page => (
        <View>
          {page.items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                testID={`inquiry-row-${item.id}`}
                label={`${
                  item.urgent ? t('home.inquiries.urgentMark') + ', ' : ''
                }${item.title}, ${item.productName}`}
                onPress={() =>
                  openRoute({
                    name: 'Section',
                    params: {
                      sectionId: 'inquiries',
                      query: { rfq: item.id },
                    },
                  })
                }
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: item.urgent
                        ? palette.orange50
                        : palette.blue50,
                    },
                  ]}
                >
                  <Icon
                    name={item.urgent ? 'priority_high' : 'chat'}
                    size={18}
                    color={item.urgent ? palette.orange600 : palette.blue700}
                  />
                </View>
                <View style={styles.main}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text
                    variant="meta"
                    color={colors.textMuted}
                    numberOfLines={1}
                  >
                    {item.productName} · {item.quantity} {item.unit}
                  </Text>
                </View>
                <Text variant="small" color={colors.textMuted}>
                  {relativeLabel(t, item.createdAt)}
                </Text>
              </Row>
            </React.Fragment>
          ))}
        </View>
      )}
    </HomeCard>
  );
}

/* ------------------------------------------------------------------ shipments */

export function ShipmentsCard({
  query,
}: {
  query: UseQueryResult<Page<ShipmentSummary>>;
}) {
  const t = useT();
  return (
    <HomeCard
      title={t('home.shipments.title')}
      query={query}
      empty={page => page.items.length === 0}
      emptyText={t('home.shipments.empty')}
      testID="shipment-tracking"
    >
      {page => (
        <View>
          {page.items.map((shipment, index) => {
            const eta = formatDayMonth(shipment.eta);
            return (
              <React.Fragment key={shipment.id}>
                {index > 0 ? <Divider /> : null}
                <Row
                  testID={`shipment-row-${shipment.orderNumber}`}
                  label={`${shipment.orderNumber}, ${shipment.buyer}, ${shipment.route}`}
                  onPress={() =>
                    openRoute({
                      name: 'Main',
                      params: {
                        screen: 'Orders',
                        query: { q: shipment.orderNumber },
                      },
                    })
                  }
                >
                  <Icon
                    name="local_shipping"
                    size={20}
                    color={palette.blue700}
                  />
                  <View style={styles.main}>
                    <Text variant="cardTitle" numberOfLines={1}>
                      {shipment.orderNumber} · {shipment.buyer}
                    </Text>
                    <Text
                      variant="meta"
                      color={colors.textMuted}
                      numberOfLines={1}
                    >
                      {shipment.route}
                    </Text>
                  </View>
                  <View style={styles.end}>
                    <StatusBadge
                      status={shipment.status}
                      isEnum
                      tone={SHIPMENT_TONE[shipment.status] ?? 'gray'}
                    />
                    <Text variant="small" color={colors.textMuted}>
                      {eta
                        ? t('home.shipments.eta', { date: eta })
                        : t('home.shipments.etaTbd')}
                    </Text>
                  </View>
                </Row>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: HIT_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  main: { flex: 1, gap: spacing.xxs },
  end: { alignItems: 'flex-end', gap: spacing.xxs },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
