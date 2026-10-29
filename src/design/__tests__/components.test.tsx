import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  ConfirmDialog,
  FeatureLockedBanner,
  SegmentedTabs,
  StatusBadge,
  SwitchRow,
  darkColors,
  lightColors,
  darkTones,
  tones,
} from '@/design';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function json(element: React.ReactElement): string {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(element);
  });
  return JSON.stringify(renderer.toJSON());
}

describe('StatusBadge', () => {
  it('formats an enum like the web portal does', () => {
    expect(
      json(<StatusBadge status="READY_TO_SHIP" tone="blue" isEnum />),
    ).toContain('Ready To Ship');
    expect(json(<StatusBadge status="PENDING_KYC" isEnum />)).toContain(
      'Pending KYC',
    );
  });

  it('prettifies machine-like text but keeps authored copy', () => {
    expect(json(<StatusBadge status="OUT_OF_STOCK" tone="red" />)).toContain(
      'Out Of Stock',
    );
    expect(
      json(<StatusBadge status="Low stock (3)" tone="orange" />),
    ).toContain('Low stock (3)');
  });

  it('speaks its label to screen readers', () => {
    expect(
      json(<StatusBadge status="DELIVERED" tone="green" isEnum />),
    ).toContain('"accessibilityLabel":"Delivered"');
  });
});

describe('SegmentedTabs', () => {
  it('marks the selected tab and reports a press', () => {
    const onChange = jest.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SegmentedTabs
          tabs={[
            { key: 'all', label: 'All' },
            { key: 'toShip', label: 'To ship', count: 4 },
          ]}
          value="all"
          onChange={onChange}
          testID="tabs"
        />,
      );
    });
    const tab = (key: string) =>
      renderer.root.find(
        node =>
          node.props.testID === `tabs-${key}` &&
          typeof node.props.onPress === 'function',
      );

    expect(tab('all').props.accessibilityState).toEqual({ selected: true });
    expect(tab('toShip').props.accessibilityState).toEqual({ selected: false });
    expect(tab('toShip').props.accessibilityLabel).toBe('To ship, 4');
    act(() => tab('toShip').props.onPress());
    expect(onChange).toHaveBeenCalledWith('toShip');
  });
});

describe('ConfirmDialog', () => {
  it('confirms and cancels', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <ConfirmDialog
          visible
          title="Sign out?"
          confirmLabel="Sign out"
          cancelLabel="Cancel"
          destructive
          onConfirm={onConfirm}
          onCancel={onCancel}
          testID="dialog"
        />,
      );
    });
    const press = (id: string) =>
      renderer.root
        .find(
          node =>
            node.props.testID === id &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();

    act(() => press('dialog-confirm'));
    act(() => press('dialog-cancel'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('FeatureLockedBanner', () => {
  it('shows the reason and its action', () => {
    const text = json(
      <FeatureLockedBanner
        kind="viewOnly"
        title="View-only"
        message="Complete KYC"
        actionLabel="Complete KYC now"
        onAction={() => undefined}
      />,
    );
    expect(text).toContain('View-only');
    expect(text).toContain('Complete KYC now');
  });
});

describe('SwitchRow', () => {
  it('reports its state to screen readers', () => {
    expect(
      json(
        <SwitchRow label="Notify me" value onValueChange={() => undefined} />,
      ),
    ).toContain('"checked":true');
  });
});

describe('themes', () => {
  it('dark has every key light has, and different values for surfaces and text', () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
    expect(darkColors.background).not.toBe(lightColors.background);
    expect(darkColors.onSurface).not.toBe(lightColors.onSurface);
  });

  it('every tone has a dark counterpart', () => {
    expect(Object.keys(darkTones).sort()).toEqual(Object.keys(tones).sort());
  });
});
