/**
 * The geometry behind the charts, kept free of React so it is unit tested: a "nice" axis scale,
 * bar and point positions, and donut arcs.
 */

export interface Scale {
  /** The top of the axis, a round number at or above the data's maximum. */
  max: number;
  step: number;
  /** 0 up to `max` in `step`s. */
  ticks: number[];
}

/** A round axis for values from 0 to `maxValue`, with about `target` gridlines. */
export function niceScale(maxValue: number, target = 5): Scale {
  const max = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  if (max === 0) return { max: 1, step: 1, ticks: [0, 1] };
  const rough = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  const step = factor * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 1e6; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return { max: top, step, ticks };
}

export interface BarGeometry {
  x: number;
  width: number;
  /** Top edge (y grows downward). */
  y: number;
  height: number;
}

/**
 * Columns evenly spread across `width`, each `gap` wide apart, no wider than `maxBar`. `plotHeight`
 * is the drawing height; a zero value still gets a hairline so the month is visible.
 */
export function barGeometry(
  values: readonly number[],
  scale: Scale,
  width: number,
  plotHeight: number,
  options: { gapRatio?: number; maxBar?: number } = {},
): BarGeometry[] {
  const { gapRatio = 0.35, maxBar = 36 } = options;
  const count = values.length;
  if (!count || width <= 0) return [];
  const slot = width / count;
  const bar = Math.min(maxBar, slot * (1 - gapRatio));
  return values.map((value, index) => {
    const ratio = scale.max > 0 ? Math.max(0, value) / scale.max : 0;
    const height = value > 0 ? Math.max(2, ratio * plotHeight) : 1;
    return {
      x: slot * index + (slot - bar) / 2,
      width: bar,
      y: plotHeight - height,
      height,
    };
  });
}

/** The centre of each slot, for a line over the bars. */
export function slotCentres(count: number, width: number): number[] {
  if (!count || width <= 0) return [];
  const slot = width / count;
  return Array.from({ length: count }, (_, index) => slot * index + slot / 2);
}

export function pointY(
  value: number,
  scale: Scale,
  plotHeight: number,
): number {
  const ratio = scale.max > 0 ? Math.max(0, value) / scale.max : 0;
  return plotHeight - ratio * plotHeight;
}

/** The labels to draw under the columns: all of them when they fit, otherwise every nth. */
export function visibleLabelIndexes(
  count: number,
  width: number,
  minLabelWidth = 42,
): number[] {
  if (!count) return [];
  const fits = Math.max(1, Math.floor(width / minLabelWidth));
  const every = Math.ceil(count / fits);
  const indexes: number[] = [];
  for (let index = 0; index < count; index += every) indexes.push(index);
  return indexes;
}

export interface Arc {
  /** Radians from 12 o'clock, clockwise. */
  start: number;
  end: number;
  fraction: number;
}

/** Each value's share of the circle, in order; empty when every value is zero. */
export function donutArcs(values: readonly number[]): Arc[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return values.map(() => ({ start: 0, end: 0, fraction: 0 }));
  let angle = 0;
  return values.map(value => {
    const fraction = Math.max(0, value) / total;
    const start = angle;
    angle += fraction * Math.PI * 2;
    return { start, end: angle, fraction };
  });
}

const point = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.sin(angle),
  y: cy - radius * Math.cos(angle),
});

const fixed = (value: number): string =>
  (Math.round(value * 100) / 100).toString();

/**
 * An SVG path for a ring segment between `inner` and `outer` radii. A segment that is the whole
 * circle is drawn as two half-turns, because an arc cannot start and end at the same point.
 */
export function ringSegmentPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  start: number,
  end: number,
): string {
  const sweep = end - start;
  if (sweep <= 0) return '';
  if (sweep >= Math.PI * 2 - 1e-6) {
    const mid = start + Math.PI;
    return `${ringSegmentPath(
      cx,
      cy,
      inner,
      outer,
      start,
      mid,
    )} ${ringSegmentPath(
      cx,
      cy,
      inner,
      outer,
      mid,
      start + Math.PI * 2 - 1e-4,
    )}`;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const a = point(cx, cy, outer, start);
  const b = point(cx, cy, outer, end);
  const c = point(cx, cy, inner, end);
  const d = point(cx, cy, inner, start);
  return [
    `M ${fixed(a.x)} ${fixed(a.y)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${fixed(b.x)} ${fixed(b.y)}`,
    `L ${fixed(c.x)} ${fixed(c.y)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${fixed(d.x)} ${fixed(d.y)}`,
    'Z',
  ].join(' ');
}
