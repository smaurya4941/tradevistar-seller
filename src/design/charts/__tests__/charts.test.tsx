import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  barGeometry,
  donutArcs,
  niceScale,
  pointY,
  ringSegmentPath,
  slotCentres,
  visibleLabelIndexes,
} from '../chartMath';
import { ColumnChart, DonutChart, RankedBars, SalesChart } from '..';

describe('niceScale', () => {
  it('rounds the top of the axis up to a round number', () => {
    expect(niceScale(420_000)).toMatchObject({ max: 500_000, step: 100_000 });
    expect(niceScale(37)).toMatchObject({ max: 40, step: 10 });
    expect(niceScale(7)).toMatchObject({ max: 8, step: 2 });
    expect(niceScale(1)).toMatchObject({ max: 1, step: 0.2 });
  });

  it('starts at zero and ends at the top', () => {
    const scale = niceScale(420_000);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.ticks.at(-1)).toBe(scale.max);
  });

  it('copes with an empty or invalid series', () => {
    expect(niceScale(0)).toEqual({ max: 1, step: 1, ticks: [0, 1] });
    expect(niceScale(Number.NaN).max).toBe(1);
    expect(niceScale(-5).max).toBe(1);
  });
});

describe('bar geometry', () => {
  const scale = niceScale(100);

  it('scales each bar to its value and keeps a hairline for zero', () => {
    const bars = barGeometry([100, 50, 0], scale, 300, 100);
    expect(bars).toHaveLength(3);
    expect(bars[0].height).toBeCloseTo(100 * (100 / scale.max), 5);
    expect(bars[1].height).toBeCloseTo(bars[0].height / 2, 5);
    expect(bars[2].height).toBe(1);
    expect(bars[0].y + bars[0].height).toBe(100);
  });

  it('spreads bars across the width without overlapping, no wider than the cap', () => {
    const bars = barGeometry([1, 1, 1], niceScale(1), 300, 100, { maxBar: 20 });
    expect(bars.every(bar => bar.width <= 20)).toBe(true);
    expect(bars[1].x).toBeGreaterThan(bars[0].x + bars[0].width);
  });

  it('is empty without data or width', () => {
    expect(barGeometry([], scale, 300, 100)).toEqual([]);
    expect(barGeometry([1], scale, 0, 100)).toEqual([]);
    expect(slotCentres(0, 100)).toEqual([]);
  });

  it('centres points in their slots', () => {
    expect(slotCentres(4, 400)).toEqual([50, 150, 250, 350]);
    expect(pointY(0, scale, 100)).toBe(100);
    expect(pointY(scale.max, scale, 100)).toBe(0);
  });

  it('shows every label when they fit and every nth when they do not', () => {
    expect(visibleLabelIndexes(6, 300)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(visibleLabelIndexes(12, 168)).toEqual([0, 3, 6, 9]);
    expect(visibleLabelIndexes(0, 300)).toEqual([]);
  });
});

describe('donut geometry', () => {
  it('gives each value its share of the circle in order', () => {
    const arcs = donutArcs([1, 1, 2]);
    expect(arcs.map(arc => arc.fraction)).toEqual([0.25, 0.25, 0.5]);
    expect(arcs[0].start).toBe(0);
    expect(arcs[2].end).toBeCloseTo(Math.PI * 2, 5);
  });

  it('is flat when every value is zero', () => {
    expect(donutArcs([0, 0]).every(arc => arc.fraction === 0)).toBe(true);
  });

  it('draws a ring segment, and a full circle as two half turns', () => {
    const quarter = ringSegmentPath(50, 50, 30, 48, 0, Math.PI / 2);
    expect(quarter.startsWith('M ')).toBe(true);
    expect(quarter.endsWith('Z')).toBe(true);
    expect(ringSegmentPath(50, 50, 30, 48, 0, 0)).toBe('');
    const full = ringSegmentPath(50, 50, 30, 48, 0, Math.PI * 2);
    expect(full.match(/Z/g)).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ components */

function collect(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(child => collect(child, out));
  else collect((node as { children?: unknown }).children, out);
}
const words = (renderer: ReactTestRenderer) => {
  const out: string[] = [];
  collect(renderer.toJSON(), out);
  return out.join(' ');
};

const layout = (width: number) => ({
  nativeEvent: { layout: { width, height: 200 } },
});

function mount(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function measure(renderer: ReactTestRenderer, width = 320): void {
  act(() => {
    renderer.root
      .find(node => typeof node.props.onLayout === 'function')
      .props.onLayout(layout(width));
  });
}

describe('charts speak their summary', () => {
  it('a column chart is one image labelled with the finding', () => {
    const renderer = mount(
      <ColumnChart
        data={[
          { label: 'Aug 26', value: 100_000 },
          { label: 'Sep 26', value: 320_000 },
        ]}
        color="#2a78d6"
        format={value => `₹${value}`}
        tick={value => String(value)}
        summary="Revenue ₹4.2L over 2 months, highest in September"
        hint="Tap a bar for its value"
      />,
    );
    const image = renderer.root.find(
      node => node.props.accessibilityRole === 'image',
    );
    expect(image.props.accessibilityLabel).toBe(
      'Revenue ₹4.2L over 2 months, highest in September',
    );
    expect(image.props.accessible).toBe(true);
  });

  it('shows the hint, then the exact value of the bar that was tapped', () => {
    const renderer = mount(
      <ColumnChart
        data={[
          { label: 'Aug 26', value: 100_000 },
          { label: 'Sep 26', value: 320_000 },
        ]}
        color="#2a78d6"
        format={value => `₹${value}`}
        tick={value => String(value)}
        summary="s"
        hint="Tap a bar for its value"
      />,
    );
    expect(words(renderer)).toContain('Tap a bar for its value');
    measure(renderer);
    act(() => {
      renderer.root
        .find(node => node.props.testID === 'chart-hit-1')
        .props.onPress();
    });
    expect(words(renderer)).toContain('Sep 26 · ₹320000');
    act(() => {
      renderer.root
        .find(node => node.props.testID === 'chart-hit-1')
        .props.onPress();
    });
    expect(words(renderer)).toContain('Tap a bar for its value');
  });

  it('a sales chart shows both series for the tapped month', () => {
    const renderer = mount(
      <SalesChart
        data={[
          { label: 'Aug 26', revenue: 100, orders: 3 },
          { label: 'Sep 26', revenue: 200, orders: 7 },
        ]}
        revenueColor="#2a78d6"
        ordersColor="#eb6834"
        formatRevenue={value => `₹${value}`}
        tickRevenue={value => String(value)}
        revenueLabel="Revenue"
        ordersLabel="Orders"
        summary="Sales summary"
        hint="Tap"
      />,
    );
    measure(renderer);
    act(() => {
      renderer.root
        .find(node => node.props.testID === 'chart-hit-0')
        .props.onPress();
    });
    expect(words(renderer)).toContain('Aug 26 · ₹100 · 3 orders');
    expect(
      renderer.root.find(node => node.props.accessibilityRole === 'image').props
        .accessibilityLabel,
    ).toBe('Sales summary');
  });

  it('a donut is one image, with a readable legend and a centre value', () => {
    const renderer = mount(
      <DonutChart
        segments={[
          { key: 'a', label: 'Delivered', value: 6, color: '#008300' },
          { key: 'b', label: 'Pending', value: 2, color: '#eda100' },
          { key: 'c', label: 'Returned', value: 0, color: '#e34948' },
        ]}
        centerValue="8"
        centerLabel="Orders"
        summary="8 orders: Delivered 6, Pending 2"
        hideEmptyInLegend
      />,
    );
    const out = words(renderer);
    expect(out).toContain('Delivered');
    expect(out).toMatch(/75\s*%/);
    expect(out).not.toContain('Returned');
    expect(
      renderer.root.find(node => node.props.accessibilityRole === 'image').props
        .accessibilityLabel,
    ).toBe('8 orders: Delivered 6, Pending 2');
  });

  it('a donut with no data still draws and says zero', () => {
    const renderer = mount(
      <DonutChart
        segments={[
          { key: 'a', label: 'Delivered', value: 0, color: '#008300' },
        ]}
        centerValue="0"
        centerLabel="Orders"
        summary="No orders yet"
      />,
    );
    expect(words(renderer)).toMatch(/0\s*%/);
  });

  it('ranked bars carry one summary and show each value', () => {
    const renderer = mount(
      <RankedBars
        rows={[
          {
            key: 'a',
            label: 'Steel pipe',
            value: 300,
            valueLabel: '₹3.0K',
            detail: '3 orders',
          },
          { key: 'b', label: 'Rice', value: 100, valueLabel: '₹1.0K' },
        ]}
        color="#2a78d6"
        summary="Top 2 products"
      />,
    );
    const out = words(renderer);
    expect(out).toMatch(/1\s*\.\s*Steel pipe/);
    expect(out).toContain('₹3.0K');
    expect(out).toContain('3 orders');
    expect(
      renderer.root.find(node => node.props.accessibilityRole === 'image').props
        .accessibilityLabel,
    ).toBe('Top 2 products');
  });
});
