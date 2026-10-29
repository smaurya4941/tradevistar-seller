import type { SellerNotification } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { translate } from '@/i18n';
import { groupByDay } from '../NotificationCenterScreen';
import { NotificationRow } from '../components/NotificationRow';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
  };
});

const t = (key: Parameters<typeof translate>[1]) => translate('en', key);

const row = (over: Partial<SellerNotification> = {}): SellerNotification => ({
  id: 'n1',
  type: 'order.placed',
  title: 'New order from Acme',
  body: 'Order TV-100 for 10 units',
  read: false,
  createdAt: '2026-10-22T10:00:00Z',
  metadata: { orderId: 'o1' },
  ...over,
});

function render(
  notification: SellerNotification,
  handlers: Partial<{
    onOpen: jest.Mock;
    onMenu: jest.Mock;
    onToggleRead: jest.Mock;
  }> = {},
): {
  renderer: ReactTestRenderer;
  onOpen: jest.Mock;
  onMenu: jest.Mock;
  onToggleRead: jest.Mock;
} {
  const onOpen = handlers.onOpen ?? jest.fn();
  const onMenu = handlers.onMenu ?? jest.fn();
  const onToggleRead = handlers.onToggleRead ?? jest.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <NotificationRow
        notification={notification}
        timeAgo="5m ago"
        onOpen={onOpen}
        onMenu={onMenu}
        onToggleRead={onToggleRead}
      />,
    );
  });
  return { renderer, onOpen, onMenu, onToggleRead };
}

const press = (renderer: ReactTestRenderer, id: string, prop = 'onPress') =>
  act(() => {
    renderer.root
      .find(
        node =>
          node.props.testID === id && typeof node.props[prop] === 'function',
      )
      .props[prop]();
  });

const hasTestId = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;

const json = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON());

describe('NotificationRow', () => {
  it('shows the title, body, time and an unread dot', () => {
    const { renderer } = render(row());
    const text = json(renderer);
    expect(text).toContain('New order from Acme');
    expect(text).toContain('Order TV-100');
    expect(text).toContain('5m ago');
    expect(hasTestId(renderer, 'unread-dot')).toBe(true);
  });

  it('has no dot once read', () => {
    const { renderer } = render(row({ read: true }));
    expect(hasTestId(renderer, 'unread-dot')).toBe(false);
  });

  it('opens a row that leads somewhere, and names the action', () => {
    const { renderer, onOpen } = render(row());
    expect(json(renderer)).toContain(t('ntf.action.viewOrder'));
    press(renderer, 'notification-n1');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('expands a row with no destination instead of opening, and reads it', () => {
    const long = 'x'.repeat(200);
    const { renderer, onOpen, onToggleRead } = render(
      row({ type: 'promotion.started', metadata: null, body: long }),
    );
    expect(json(renderer)).toContain(t('ntf.showMore'));
    press(renderer, 'notification-n1');
    expect(onOpen).not.toHaveBeenCalled();
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(json(renderer)).toContain(t('ntf.showLess'));
  });

  it('offers the menu on long press and from the more button', () => {
    const { renderer, onMenu } = render(row());
    press(renderer, 'notification-n1', 'onLongPress');
    press(renderer, 'notification-menu-n1');
    expect(onMenu).toHaveBeenCalledTimes(2);
  });

  it('offers "mark as read" to screen readers on an unread row, "unread" on a read one', () => {
    const unread = render(row());
    const actions = unread.renderer.root.find(
      node =>
        node.props.testID === 'notification-n1' &&
        node.props.accessibilityActions,
    ).props.accessibilityActions as { name: string; label?: string }[];
    expect(actions.find(action => action.name === 'toggleRead')?.label).toBe(
      t('ntf.markRead'),
    );
    const read = render(row({ read: true }));
    const readActions = read.renderer.root.find(
      node =>
        node.props.testID === 'notification-n1' &&
        node.props.accessibilityActions,
    ).props.accessibilityActions as { name: string; label?: string }[];
    expect(
      readActions.find(action => action.name === 'toggleRead')?.label,
    ).toBe(t('ntf.markUnread'));
  });

  it('says "Unread" in the spoken label of an unread row', () => {
    const { renderer } = render(row());
    const label = renderer.root.find(
      node =>
        node.props.testID === 'notification-n1' &&
        node.props.accessibilityLabel,
    ).props.accessibilityLabel as string;
    expect(label.startsWith(t('ntf.unread'))).toBe(true);
    expect(label).toContain('5m ago');
  });
});

describe('groupByDay', () => {
  const now = new Date(2026, 9, 22, 15, 0, 0);
  const at = (day: number, hour = 9) =>
    row({
      id: `n${day}${hour}`,
      createdAt: new Date(2026, 9, day, hour).toISOString(),
    });

  it('puts a header before each day group', () => {
    const items = groupByDay([at(22, 12), at(22, 9), at(21), at(10)], now);
    expect(
      items.map(item => (item.kind === 'header' ? item.bucket : 'row')),
    ).toEqual(['today', 'row', 'row', 'yesterday', 'row', 'earlier', 'row']);
  });

  it('is empty for no notifications', () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
