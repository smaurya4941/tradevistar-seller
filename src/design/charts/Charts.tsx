/**
 * Small charts drawn with react-native-svg: monthly columns, a sales chart (revenue columns with an
 * orders line), a donut, and ranked horizontal bars. No charting library, so the bundle stays small
 * and every chart stays under our control for accessibility:
 * - each chart is one accessible image whose label is a spoken summary (passed in by the screen);
 * - tapping a column or point shows its exact value in a caption under the title;
 * - colours come from the theme, and series colours are the web's validated palette.
 */
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useThemeColors } from '../theme';
import { fonts, radii, spacing } from '../tokens';
import { Text } from '../components/Text';
import {
  barGeometry,
  donutArcs,
  niceScale,
  pointY,
  ringSegmentPath,
  slotCentres,
  visibleLabelIndexes,
} from './chartMath';

const Y_AXIS_WIDTH = 46;
const TOP_PAD = 10;
const LABEL_BAND = 24;

function useWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [
    width,
    (event: LayoutChangeEvent) => {
      const next = Math.round(event.nativeEvent.layout.width);
      setWidth(current => (current === next ? current : next));
    },
  ];
}

/** The value under the title: what was tapped, or a hint to tap. */
function Caption({ text }: { text: string }) {
  const colors = useThemeColors();
  return (
    <Text variant="meta" color={colors.textMuted} style={styles.caption}>
      {text}
    </Text>
  );
}

/* ------------------------------------------------------------------ columns */

export interface ColumnDatum {
  label: string;
  value: number;
}

export interface ColumnChartProps {
  data: readonly ColumnDatum[];
  color: string;
  /** The exact value, for the tapped caption: "₹4,20,000". */
  format: (value: number) => string;
  /** The compact axis tick: "₹4.2L". */
  tick: (value: number) => string;
  /** Read out by screen readers in place of the picture. */
  summary: string;
  /** Shown while nothing is tapped. */
  hint: string;
  height?: number;
  testID?: string;
}

export function ColumnChart({
  data,
  color,
  format,
  tick,
  summary,
  hint,
  height = 190,
  testID,
}: ColumnChartProps) {
  const colors = useThemeColors();
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH);
  const plotHeight = height - TOP_PAD - LABEL_BAND;
  const scale = useMemo(
    () => niceScale(Math.max(0, ...data.map(item => item.value))),
    [data],
  );
  const bars = useMemo(
    () =>
      barGeometry(
        data.map(item => item.value),
        scale,
        plotWidth,
        plotHeight,
      ),
    [data, scale, plotWidth, plotHeight],
  );
  const labels = useMemo(
    () => new Set(visibleLabelIndexes(data.length, plotWidth)),
    [data.length, plotWidth],
  );
  const picked = selected !== null ? data[selected] : null;

  return (
    <View testID={testID}>
      <Caption
        text={picked ? `${picked.label} · ${format(picked.value)}` : hint}
      />
      <View
        onLayout={onLayout}
        style={{ height }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      >
        {width > 0 ? (
          <>
            <Svg width={width} height={height}>
              {scale.ticks.map(value => {
                const y = TOP_PAD + pointY(value, scale, plotHeight);
                return (
                  <React.Fragment key={value}>
                    <Line
                      x1={Y_AXIS_WIDTH}
                      x2={width}
                      y1={y}
                      y2={y}
                      stroke={colors.divider}
                      strokeWidth={1}
                      strokeDasharray={value === 0 ? undefined : '3 3'}
                    />
                    <SvgText
                      x={Y_AXIS_WIDTH - 6}
                      y={y + 4}
                      fontSize={10}
                      fontFamily={fonts.regular}
                      fill={colors.textMuted}
                      textAnchor="end"
                    >
                      {tick(value)}
                    </SvgText>
                  </React.Fragment>
                );
              })}
              {bars.map((bar, index) => (
                <Path
                  key={data[index].label + index}
                  d={roundedTop(
                    Y_AXIS_WIDTH + bar.x,
                    TOP_PAD + bar.y,
                    bar.width,
                    bar.height,
                    4,
                  )}
                  fill={color}
                  opacity={selected === null || selected === index ? 1 : 0.45}
                />
              ))}
              {bars.map((bar, index) =>
                labels.has(index) ? (
                  <SvgText
                    key={`l${index}`}
                    x={Y_AXIS_WIDTH + bar.x + bar.width / 2}
                    y={height - 7}
                    fontSize={10}
                    fontFamily={fonts.regular}
                    fill={colors.textMuted}
                    textAnchor="middle"
                  >
                    {data[index].label}
                  </SvgText>
                ) : null,
              )}
            </Svg>
            <HitAreas
              count={data.length}
              left={Y_AXIS_WIDTH}
              width={plotWidth}
              selected={selected}
              onSelect={setSelected}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

/** A rectangle with only its top corners rounded. */
function roundedTop(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const radius = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

/** Invisible full-height tap targets, one per column, so a thin bar is still easy to hit. */
function HitAreas({
  count,
  left,
  width,
  selected,
  onSelect,
}: {
  count: number;
  left: number;
  width: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  if (!count || width <= 0) return null;
  const slot = width / count;
  return (
    <View
      style={[StyleSheet.absoluteFill, { left }]}
      pointerEvents="box-none"
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, index) => (
        <Pressable
          key={index}
          onPress={() => onSelect(selected === index ? null : index)}
          style={[styles.hit, { left: slot * index, width: slot }]}
          testID={`chart-hit-${index}`}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ sales chart */

export interface SalesDatum {
  label: string;
  revenue: number;
  orders: number;
}

export interface SalesChartProps {
  data: readonly SalesDatum[];
  revenueColor: string;
  ordersColor: string;
  formatRevenue: (value: number) => string;
  tickRevenue: (value: number) => string;
  revenueLabel: string;
  ordersLabel: string;
  summary: string;
  hint: string;
  height?: number;
  testID?: string;
}

/** Revenue as columns (left axis) with orders as a line (right axis). */
export function SalesChart({
  data,
  revenueColor,
  ordersColor,
  formatRevenue,
  tickRevenue,
  revenueLabel,
  ordersLabel,
  summary,
  hint,
  height = 220,
  testID,
}: SalesChartProps) {
  const colors = useThemeColors();
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const rightAxis = 30;
  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH - rightAxis);
  const plotHeight = height - TOP_PAD - LABEL_BAND;
  const revenueScale = useMemo(
    () => niceScale(Math.max(0, ...data.map(item => item.revenue))),
    [data],
  );
  const orderScale = useMemo(
    () => niceScale(Math.max(0, ...data.map(item => item.orders))),
    [data],
  );
  const bars = useMemo(
    () =>
      barGeometry(
        data.map(item => item.revenue),
        revenueScale,
        plotWidth,
        plotHeight,
      ),
    [data, revenueScale, plotWidth, plotHeight],
  );
  const centres = useMemo(
    () => slotCentres(data.length, plotWidth),
    [data.length, plotWidth],
  );
  const labels = useMemo(
    () => new Set(visibleLabelIndexes(data.length, plotWidth)),
    [data.length, plotWidth],
  );
  const points = centres.map((x, index) => ({
    x: Y_AXIS_WIDTH + x,
    y: TOP_PAD + pointY(data[index].orders, orderScale, plotHeight),
  }));
  const line = points
    .map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  const picked = selected !== null ? data[selected] : null;

  return (
    <View testID={testID}>
      <View style={styles.legend}>
        <LegendItem color={revenueColor} label={revenueLabel} square />
        <LegendItem color={ordersColor} label={ordersLabel} />
      </View>
      <Caption
        text={
          picked
            ? `${picked.label} · ${formatRevenue(picked.revenue)} · ${
                picked.orders
              } ${ordersLabel.toLowerCase()}`
            : hint
        }
      />
      <View
        onLayout={onLayout}
        style={{ height }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      >
        {width > 0 ? (
          <>
            <Svg width={width} height={height}>
              {revenueScale.ticks.map(value => {
                const y = TOP_PAD + pointY(value, revenueScale, plotHeight);
                return (
                  <React.Fragment key={value}>
                    <Line
                      x1={Y_AXIS_WIDTH}
                      x2={Y_AXIS_WIDTH + plotWidth}
                      y1={y}
                      y2={y}
                      stroke={colors.divider}
                      strokeWidth={1}
                      strokeDasharray={value === 0 ? undefined : '3 3'}
                    />
                    <SvgText
                      x={Y_AXIS_WIDTH - 6}
                      y={y + 4}
                      fontSize={10}
                      fontFamily={fonts.regular}
                      fill={colors.textMuted}
                      textAnchor="end"
                    >
                      {tickRevenue(value)}
                    </SvgText>
                  </React.Fragment>
                );
              })}
              {orderScale.ticks.map(value => (
                <SvgText
                  key={`o${value}`}
                  x={Y_AXIS_WIDTH + plotWidth + 6}
                  y={TOP_PAD + pointY(value, orderScale, plotHeight) + 4}
                  fontSize={10}
                  fontFamily={fonts.regular}
                  fill={ordersColor}
                  textAnchor="start"
                >
                  {value}
                </SvgText>
              ))}
              {bars.map((bar, index) => (
                <Path
                  key={data[index].label + index}
                  d={roundedTop(
                    Y_AXIS_WIDTH + bar.x,
                    TOP_PAD + bar.y,
                    bar.width,
                    bar.height,
                    4,
                  )}
                  fill={revenueColor}
                  opacity={selected === null || selected === index ? 1 : 0.45}
                />
              ))}
              <Path
                d={line}
                stroke={ordersColor}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
              />
              {points.map((p, index) => (
                <Circle
                  key={`p${index}`}
                  cx={p.x}
                  cy={p.y}
                  r={selected === index ? 5 : 3.5}
                  fill={colors.surface}
                  stroke={ordersColor}
                  strokeWidth={2}
                />
              ))}
              {bars.map((bar, index) =>
                labels.has(index) ? (
                  <SvgText
                    key={`l${index}`}
                    x={Y_AXIS_WIDTH + bar.x + bar.width / 2}
                    y={height - 7}
                    fontSize={10}
                    fontFamily={fonts.regular}
                    fill={colors.textMuted}
                    textAnchor="middle"
                  >
                    {data[index].label}
                  </SvgText>
                ) : null,
              )}
            </Svg>
            <HitAreas
              count={data.length}
              left={Y_AXIS_WIDTH}
              width={plotWidth}
              selected={selected}
              onSelect={setSelected}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

function LegendItem({
  color,
  label,
  square = false,
}: {
  color: string;
  label: string;
  square?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.swatch,
          square ? styles.square : null,
          { backgroundColor: color },
        ]}
      />
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ donut */

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: readonly DonutSegment[];
  centerValue: string;
  centerLabel: string;
  summary: string;
  size?: number;
  /** Segments with a zero value are left out of the legend when true. */
  hideEmptyInLegend?: boolean;
  testID?: string;
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  summary,
  size = 168,
  hideEmptyInLegend = false,
  testID,
}: DonutChartProps) {
  const colors = useThemeColors();
  const [selected, setSelected] = useState<string | null>(null);
  const total = segments.reduce(
    (sum, item) => sum + Math.max(0, item.value),
    0,
  );
  const arcs = donutArcs(segments.map(item => item.value));
  const outer = size / 2 - 2;
  const inner = outer * 0.62;
  const centre = size / 2;
  const legend = hideEmptyInLegend
    ? segments.filter(item => item.value > 0)
    : segments;
  const picked = segments.find(item => item.key === selected);

  return (
    <View style={styles.donutWrap} testID={testID}>
      <View
        style={{ width: size, height: size }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      >
        <Svg width={size} height={size}>
          {total > 0 ? (
            segments.map((segment, index) =>
              arcs[index].fraction > 0 ? (
                <Path
                  key={segment.key}
                  d={ringSegmentPath(
                    centre,
                    centre,
                    inner,
                    outer,
                    arcs[index].start,
                    arcs[index].end,
                  )}
                  fill={segment.color}
                  stroke={colors.surface}
                  strokeWidth={2}
                  opacity={
                    selected === null || selected === segment.key ? 1 : 0.4
                  }
                />
              ) : null,
            )
          ) : (
            <Path
              d={ringSegmentPath(centre, centre, inner, outer, 0, Math.PI * 2)}
              fill={colors.surfaceContainerHigh}
            />
          )}
        </Svg>
        <View style={styles.donutCentre} pointerEvents="none">
          <Text variant="stat" color={colors.onSurface}>
            {picked ? String(picked.value) : centerValue}
          </Text>
          <Text variant="small" color={colors.textMuted} align="center">
            {picked ? picked.label : centerLabel}
          </Text>
        </View>
      </View>
      <View style={styles.donutLegend}>
        {legend.map(segment => {
          const percent = total ? Math.round((segment.value / total) * 100) : 0;
          return (
            <Pressable
              key={segment.key}
              onPress={() =>
                setSelected(current =>
                  current === segment.key ? null : segment.key,
                )
              }
              style={styles.legendRow}
              accessibilityRole="button"
              accessibilityLabel={`${segment.label}, ${segment.value}, ${percent}%`}
            >
              <View
                style={[styles.swatch, { backgroundColor: segment.color }]}
              />
              <Text variant="meta" style={styles.legendLabel} numberOfLines={1}>
                {segment.label}
              </Text>
              <Text variant="label">{segment.value}</Text>
              <Text
                variant="small"
                color={colors.textMuted}
                style={styles.percent}
              >
                {percent}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ ranked bars */

export interface RankedRow {
  key: string;
  label: string;
  /** The bar's length, relative to the largest row. */
  value: number;
  valueLabel: string;
  detail?: string;
}

export function RankedBars({
  rows,
  color,
  summary,
  testID,
}: {
  rows: readonly RankedRow[];
  color: string;
  summary: string;
  testID?: string;
}) {
  const colors = useThemeColors();
  const max = Math.max(1, ...rows.map(row => row.value));
  return (
    <View
      style={styles.ranked}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      testID={testID}
    >
      {rows.map((row, index) => (
        <View key={row.key} style={styles.rankedRow}>
          <View style={styles.rankedHead}>
            <Text
              variant="cardTitle"
              style={styles.legendLabel}
              numberOfLines={1}
            >
              {index + 1}. {row.label}
            </Text>
            <Text variant="cardTitle" color={colors.secondary}>
              {row.valueLabel}
            </Text>
          </View>
          <View
            style={[styles.track, { backgroundColor: colors.surfaceContainer }]}
          >
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: color,
                  width: `${Math.max(3, (row.value / max) * 100)}%`,
                },
              ]}
            />
          </View>
          {row.detail ? (
            <Text variant="small" color={colors.textMuted}>
              {row.detail}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { minHeight: 20, marginBottom: spacing.xs },
  legend: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  square: { borderRadius: 2 },
  hit: { position: 'absolute', top: 0, bottom: 0 },
  donutWrap: { alignItems: 'center', gap: spacing.lg },
  donutCentre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  donutLegend: { alignSelf: 'stretch', gap: spacing.xs },
  legendRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendLabel: { flex: 1 },
  percent: { minWidth: 36, textAlign: 'right' },
  ranked: { gap: spacing.lg },
  rankedRow: { gap: spacing.xs },
  rankedHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
});
