/**
 * Celebrations: each kind has its own look, pieces stay inside sane bounds and under the cap; the
 * host starts a due celebration once, marks it played, waits for a future one, stays quiet in the
 * background, and the overlay ends on time or when the seller closes it.
 */
import type { SiteNotice } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildPieces, MAX_PIECES } from '../particles';

const SCREEN = { width: 360, height: 780 };
const seeded = (): (() => number) => {
  let seed = 42;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
};

describe('buildPieces', () => {
  const shapes = (kind: Parameters<typeof buildPieces>[0]) =>
    new Set(buildPieces(kind, SCREEN, seeded()).map(piece => piece.shape));

  it('gives every kind its own look', () => {
    expect(shapes('LAUNCH')).toEqual(new Set(['confetti', 'emoji']));
    expect(shapes('EVENT')).toEqual(new Set(['confetti']));
    expect(shapes('SALE')).toEqual(new Set(['confetti', 'balloon']));
    expect(shapes('NEW_FEATURE')).toEqual(new Set(['star', 'confetti']));
    expect(shapes('FESTIVAL')).toEqual(new Set(['spark']));
  });

  it('adds rockets only to a launch', () => {
    const glyphs = (kind: Parameters<typeof buildPieces>[0]) =>
      buildPieces(kind, SCREEN, seeded())
        .filter(piece => piece.glyph)
        .map(piece => piece.glyph);
    expect(glyphs('LAUNCH')).toContain('🚀');
    expect(glyphs('SALE')).toEqual([]);
  });

  it.each(['LAUNCH', 'NEW_FEATURE', 'EVENT', 'FESTIVAL', 'SALE'] as const)(
    'keeps %s within the cap with usable timings',
    kind => {
      const pieces = buildPieces(kind, SCREEN, seeded());
      expect(pieces.length).toBeGreaterThan(10);
      expect(pieces.length).toBeLessThanOrEqual(MAX_PIECES);
      expect(new Set(pieces.map(piece => piece.id)).size).toBe(pieces.length);
      for (const piece of pieces) {
        expect(piece.durationMs).toBeGreaterThan(500);
        expect(piece.delayMs).toBeGreaterThanOrEqual(0);
        expect(piece.pauseMs).toBeGreaterThanOrEqual(0);
        expect(piece.size).toBeGreaterThan(0);
      }
    },
  );

  it('shoots cannon confetti from the bottom corners, up and across', () => {
    const cannons = buildPieces('EVENT', SCREEN, seeded()).filter(piece =>
      piece.id.includes('cannon'),
    );
    expect(cannons.length).toBeGreaterThan(0);
    for (const piece of cannons) {
      expect(piece.y[0]).toBe(SCREEN.height);
      expect(piece.y[1]).toBeLessThan(SCREEN.height);
      expect([0, SCREEN.width]).toContain(piece.x[0]);
    }
  });

  it('bursts fireworks outward from one point in the upper half', () => {
    const sparks = buildPieces('FESTIVAL', SCREEN, seeded()).filter(piece =>
      piece.id.startsWith('firework-0-'),
    );
    expect(new Set(sparks.map(piece => piece.x[0])).size).toBe(1);
    expect(sparks[0]?.y[0]).toBeLessThan(SCREEN.height / 2);
    expect(new Set(sparks.map(piece => piece.x[2])).size).toBeGreaterThan(5);
  });
});

// ── the host and the overlay ───────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-10-11T10:00:00Z');
let mockFeed: { notices: Partial<SiteNotice>[]; skew: number } | undefined;
let mockActive = true;
jest.mock('@/features/notices/data', () => ({
  useSiteNotices: () => ({ data: mockFeed }),
}));
jest.mock('@/core/useAppActive', () => ({ useAppActive: () => mockActive }));
const mockReduceMotion = jest.fn(() => false);
jest.mock('@/core/useReduceMotion', () => ({
  useReduceMotion: () => mockReduceMotion(),
}));

import { CelebrationHost } from '../CelebrationHost';
import { resetCelebrated } from '../celebrated';
import { CelebrationOverlay } from '../CelebrationOverlay';

const announcement = (
  patch: Partial<SiteNotice> = {},
): Partial<SiteNotice> => ({
  id: 'n1',
  kind: 'ANNOUNCEMENT',
  title: 'Launch day',
  message: 'We are live',
  eventAt: new Date(NOW + 5_000).toISOString(),
  celebration: 'LAUNCH',
  celebrationMinutes: 1,
  ...patch,
});

const mounted: ReactTestRenderer[] = [];
async function mount(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
  });
  mounted.push(renderer);
  return renderer;
}
// A host left mounted would react to the next test's notices and play them first.
afterEach(async () => {
  await act(async () => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
});
const shown = (renderer: ReactTestRenderer) =>
  renderer.root.findAll(node => node.props.testID === 'celebration').length > 0;

describe('CelebrationHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    resetCelebrated();
    mockActive = true;
    mockReduceMotion.mockReturnValue(false);
    mockFeed = { notices: [announcement()], skew: 0 };
  });
  afterEach(() => jest.useRealTimers());

  it('waits for the event time, then plays', async () => {
    const renderer = await mount(<CelebrationHost />);
    expect(shown(renderer)).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(5_001);
    });
    expect(shown(renderer)).toBe(true);
  });

  it('plays at once when the event time has passed but the window has not', async () => {
    mockFeed = {
      notices: [
        announcement({ eventAt: new Date(NOW - 10_000).toISOString() }),
      ],
      skew: 0,
    };
    expect(shown(await mount(<CelebrationHost />))).toBe(true);
  });

  it('judges the time on the server clock', async () => {
    // The phone runs 2 minutes behind the server: the event is already 55 s old on the server.
    mockFeed = {
      notices: [
        announcement({ eventAt: new Date(NOW + 65_000).toISOString() }),
      ],
      skew: 120_000,
    };
    expect(shown(await mount(<CelebrationHost />))).toBe(true);
  });

  it('plays nothing once the window is over, or without a celebration', async () => {
    mockFeed = {
      notices: [
        announcement({ eventAt: new Date(NOW - 120_000).toISOString() }),
      ],
      skew: 0,
    };
    expect(shown(await mount(<CelebrationHost />))).toBe(false);
    mockFeed = { notices: [announcement({ celebration: null })], skew: 0 };
    expect(shown(await mount(<CelebrationHost />))).toBe(false);
  });

  it('plays a celebration once: closing it does not bring it back', async () => {
    mockFeed = {
      notices: [announcement({ eventAt: new Date(NOW - 1_000).toISOString() })],
      skew: 0,
    };
    const renderer = await mount(<CelebrationHost />);
    expect(shown(renderer)).toBe(true);
    const close = renderer.root.find(
      node => node.props.testID === 'celebration-close' && node.props.onPress,
    );
    await act(async () => close.props.onPress());
    expect(shown(renderer)).toBe(false);
    // A fresh mount (a restart) knows it has played.
    expect(shown(await mount(<CelebrationHost />))).toBe(false);
  });

  it('stays quiet while the app is in the background', async () => {
    mockActive = false;
    mockFeed = {
      notices: [announcement({ eventAt: new Date(NOW - 1_000).toISOString() })],
      skew: 0,
    };
    expect(shown(await mount(<CelebrationHost />))).toBe(false);
  });
});

describe('CelebrationOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockReduceMotion.mockReturnValue(false);
  });
  afterEach(() => jest.useRealTimers());

  const pieceCount = (renderer: ReactTestRenderer) =>
    new Set(
      renderer.root
        .findAll(node => Boolean(node.props.piece))
        .map(node => (node.props.piece as { id: string }).id),
    ).size;

  it('ends on time', async () => {
    const onDone = jest.fn();
    await mount(
      <CelebrationOverlay
        kind="EVENT"
        title="Hi"
        message=""
        until={NOW + 4_000}
        onDone={onDone}
      />,
    );
    await act(async () => {
      jest.advanceTimersByTime(3_900);
    });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('closes from the card and from the close button', async () => {
    const onDone = jest.fn();
    const renderer = await mount(
      <CelebrationOverlay
        kind="SALE"
        title="Sale"
        message="Big"
        until={NOW + 60_000}
        onDone={onDone}
      />,
    );
    for (const id of ['celebration-card', 'celebration-close']) {
      const node = renderer.root.find(
        n => n.props.testID === id && n.props.onPress,
      );
      await act(async () => node.props.onPress());
    }
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it('shows the headline for its kind and the announcement text', async () => {
    const renderer = await mount(
      <CelebrationOverlay
        kind="FESTIVAL"
        title="Diwali"
        message="Happy Diwali"
        until={NOW + 60_000}
        onDone={jest.fn()}
      />,
    );
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Happy celebrations!');
    expect(text).toContain('Diwali');
    expect(text).toContain('Happy Diwali');
  });

  it('keeps the card but drops the moving pieces for reduced motion', async () => {
    const moving = await mount(
      <CelebrationOverlay
        kind="EVENT"
        title="Hi"
        message=""
        until={NOW + 60_000}
        onDone={jest.fn()}
      />,
    );
    const movingCount = pieceCount(moving);
    expect(movingCount).toBeGreaterThan(10);
    mockReduceMotion.mockReturnValue(true);
    const calm = await mount(
      <CelebrationOverlay
        kind="EVENT"
        title="Hi"
        message=""
        until={NOW + 60_000}
        onDone={jest.fn()}
      />,
    );
    expect(pieceCount(calm)).toBeLessThan(movingCount);
    expect(
      calm.root.findAll(node => node.props.testID === 'celebration-card')
        .length,
    ).toBeGreaterThan(0);
  });
});
