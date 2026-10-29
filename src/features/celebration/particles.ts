/**
 * The pieces of a celebration, as plain data. Each kind has its own look, as on the web:
 *
 * - LAUNCH, EVENT, SALE: two confetti cannons from the bottom corners and a steady rain of
 *   confetti; LAUNCH adds rockets climbing the screen, SALE adds balloons drifting up.
 * - NEW_FEATURE: twinkling gold stars and a light gold confetti.
 * - FESTIVAL: fireworks — bursts of sparks at a few places over the upper half.
 *
 * A piece moves along three keyframes (start, middle, end) over its duration, then starts again
 * after its delay for as long as the celebration plays. Everything is driven by the native
 * animation thread, so a few dozen pieces cost the UI thread nothing. Randomness is passed in so
 * the layout can be tested.
 */
import type { CelebrationKind } from '@tradevistar/seller-api';

export type PieceShape = 'confetti' | 'spark' | 'star' | 'emoji' | 'balloon';

export interface Piece {
  id: string;
  shape: PieceShape;
  color: string;
  /** The glyph of an emoji piece. */
  glyph?: string;
  size: number;
  /** Position at the start, middle and end of one run, in dp from the top-left of the screen. */
  x: [number, number, number];
  y: [number, number, number];
  durationMs: number;
  /** Wait before the first run, so the pieces do not all move together. */
  delayMs: number;
  /** Quiet time between runs. */
  pauseMs: number;
  /** Whole turns the piece spins during a run. */
  turns: number;
  /** Fixed tilt in degrees (a rocket points up and to the right). */
  tilt: number;
  /** Grows from nothing and back to nothing (stars, sparks). */
  twinkle: boolean;
}

export type Random = () => number;

export const CONFETTI_COLORS = [
  '#EC5D03',
  '#F59E0B',
  '#034FA6',
  '#2563EB',
  '#16A34A',
  '#DB2777',
  '#9333EA',
  '#FACC15',
];
export const GOLD_COLORS = ['#FACC15', '#FDE68A', '#F59E0B', '#FFFFFF'];
export const FIREWORK_COLORS = [
  '#F97316',
  '#FACC15',
  '#22D3EE',
  '#A855F7',
  '#F43F5E',
  '#4ADE80',
  '#FFFFFF',
];

/** Most pieces on screen at once, so even a modest phone keeps up. */
export const MAX_PIECES = 90;

const between = (random: Random, min: number, max: number) =>
  min + random() * (max - min);
const pick = <T>(random: Random, list: readonly T[]): T =>
  list[Math.floor(random() * list.length)] as T;

interface Screen {
  width: number;
  height: number;
}

function rain(
  random: Random,
  screen: Screen,
  count: number,
  colors: readonly string[],
  prefix: string,
): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const x0 = between(random, 0, screen.width);
    const sway = between(random, -50, 50);
    return {
      id: `${prefix}-rain-${i}`,
      shape: 'confetti',
      color: pick(random, colors),
      size: between(random, 7, 12),
      x: [x0, x0 + sway, x0 - sway / 2],
      y: [-20, screen.height * 0.5, screen.height + 20],
      durationMs: between(random, 3800, 6500),
      delayMs: between(random, 0, 4000),
      pauseMs: 0,
      turns: between(random, 2, 5),
      tilt: 0,
      twinkle: false,
    };
  });
}

/** Confetti shot from a bottom corner: up and across, then down. */
function cannon(
  random: Random,
  screen: Screen,
  fromLeft: boolean,
  count: number,
  prefix: string,
): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const reach =
      between(random, screen.width * 0.25, screen.width * 0.75) *
      (fromLeft ? 1 : -1);
    const x0 = fromLeft ? 0 : screen.width;
    return {
      id: `${prefix}-cannon-${fromLeft ? 'l' : 'r'}-${i}`,
      shape: 'confetti',
      color: pick(random, CONFETTI_COLORS),
      size: between(random, 7, 11),
      x: [x0, x0 + reach * 0.7, x0 + reach],
      y: [
        screen.height,
        screen.height * between(random, 0.1, 0.5),
        screen.height + 30,
      ],
      durationMs: between(random, 2400, 3600),
      delayMs: between(random, 0, 500),
      pauseMs: between(random, 6000, 9000),
      turns: between(random, 2, 4),
      tilt: 0,
      twinkle: false,
    };
  });
}

function rockets(random: Random, screen: Screen, count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const x0 = between(random, screen.width * 0.08, screen.width * 0.9);
    return {
      id: `rocket-${i}`,
      shape: 'emoji',
      glyph: '🚀',
      color: '#000000',
      size: between(random, 28, 40),
      x: [x0, x0 + 20, x0 + 40],
      y: [screen.height + 30, screen.height * 0.45, -60],
      durationMs: between(random, 2200, 3400),
      delayMs: i * 900,
      pauseMs: between(random, 800, 2000),
      turns: 0,
      tilt: 0,
      twinkle: false,
    };
  });
}

function balloons(random: Random, screen: Screen, count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const x0 = between(random, screen.width * 0.05, screen.width * 0.95);
    const sway = between(random, 14, 34);
    return {
      id: `balloon-${i}`,
      shape: 'balloon',
      color: pick(random, CONFETTI_COLORS),
      size: between(random, 22, 32),
      x: [x0, x0 + sway, x0 - sway / 2],
      y: [screen.height + 60, screen.height * 0.5, -90],
      durationMs: between(random, 6500, 9500),
      delayMs: i * 1200 + between(random, 0, 600),
      pauseMs: between(random, 0, 1500),
      turns: 0,
      tilt: 0,
      twinkle: false,
    };
  });
}

function stars(random: Random, screen: Screen, count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const x0 = between(random, 0, screen.width);
    const y0 = between(random, 0, screen.height);
    return {
      id: `star-${i}`,
      shape: 'star',
      color: pick(random, GOLD_COLORS),
      size: between(random, 10, 24),
      x: [x0, x0 + between(random, -8, 8), x0 + between(random, -14, 14)],
      y: [y0, y0 - 14, y0 - 30],
      durationMs: between(random, 1500, 2800),
      delayMs: between(random, 0, 2600),
      pauseMs: between(random, 100, 900),
      turns: between(random, -0.3, 0.3),
      tilt: 0,
      twinkle: true,
    };
  });
}

/** One firework: sparks fly out from a point, then sag under their own weight. */
function firework(random: Random, screen: Screen, index: number): Piece[] {
  const cx = between(random, screen.width * 0.18, screen.width * 0.82);
  const cy = between(random, screen.height * 0.14, screen.height * 0.42);
  const color = pick(random, FIREWORK_COLORS);
  const delay = index * 700 + between(random, 0, 300);
  const sparks = 22;
  return Array.from({ length: sparks }, (_, i) => {
    const angle = (Math.PI * 2 * i) / sparks;
    const reach = between(random, 50, 110);
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach;
    return {
      id: `firework-${index}-${i}`,
      shape: 'spark',
      color: random() < 0.8 ? color : '#FFFFFF',
      size: between(random, 3, 5),
      x: [cx, cx + dx * 0.8, cx + dx],
      y: [cy, cy + dy * 0.8, cy + dy + 28],
      durationMs: between(random, 1000, 1400),
      delayMs: delay,
      pauseMs: 3500,
      turns: 0,
      tilt: 0,
      twinkle: true,
    };
  });
}

export function buildPieces(
  kind: CelebrationKind,
  screen: Screen,
  random: Random = Math.random,
): Piece[] {
  let pieces: Piece[];
  switch (kind) {
    case 'LAUNCH':
      pieces = [
        ...cannon(random, screen, true, 16, kind),
        ...cannon(random, screen, false, 16, kind),
        ...rain(random, screen, 30, CONFETTI_COLORS, kind),
        ...rockets(random, screen, 4),
      ];
      break;
    case 'EVENT':
      pieces = [
        ...cannon(random, screen, true, 18, kind),
        ...cannon(random, screen, false, 18, kind),
        ...rain(random, screen, 36, CONFETTI_COLORS, kind),
      ];
      break;
    case 'SALE':
      pieces = [
        ...cannon(random, screen, true, 14, kind),
        ...cannon(random, screen, false, 14, kind),
        ...rain(random, screen, 24, CONFETTI_COLORS, kind),
        ...balloons(random, screen, 6),
      ];
      break;
    case 'NEW_FEATURE':
      pieces = [
        ...stars(random, screen, 26),
        ...rain(random, screen, 14, GOLD_COLORS, kind),
      ];
      break;
    case 'FESTIVAL':
      pieces = [0, 1, 2, 3].flatMap(index => firework(random, screen, index));
      break;
  }
  return pieces.slice(0, MAX_PIECES);
}

/** The headline and its emoji, by kind. */
export const CELEBRATION_EMOJI: Record<CelebrationKind, string> = {
  LAUNCH: '🚀',
  NEW_FEATURE: '✨',
  EVENT: '🎉',
  FESTIVAL: '🪔',
  SALE: '🛍️',
};
