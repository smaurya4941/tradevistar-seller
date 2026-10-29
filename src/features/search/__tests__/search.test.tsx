import type { SellerSearchResult } from '@tradevistar/seller-api';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { translate } from '@/i18n';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ isReady: () => false }),
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

const mockOpenRoute = jest.fn();
jest.mock('@/app/navigation/openHref', () => ({
  openRoute: (...args: unknown[]) => mockOpenRoute(...args),
}));

const mockSearch = jest.fn();
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  searchSellerRecords: (...args: unknown[]) => mockSearch(...args),
}));

const mockOpenURL = jest.fn(async () => undefined);
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: {
    openURL: (...args: unknown[]) => mockOpenURL(...(args as [])),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    getInitialURL: jest.fn(async () => null),
  },
}));

import { clearRecentSearches, loadRecentSearches } from '../recentSearches';
import { SearchScreen } from '../SearchScreen';
import { useRecordSearch, type SearchState } from '../useRecordSearch';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const result = (
  over: Partial<SellerSearchResult> = {},
): SellerSearchResult => ({
  type: 'ORDER',
  id: 'o1',
  title: 'TV-100',
  subtitle: 'Acme · ₹5,000',
  href: '/seller/dashboard/orders?order=o1',
  ...over,
});

function Probe({
  text,
  onState,
}: {
  text: string;
  onState: (state: SearchState) => void;
}) {
  const { state } = useRecordSearch(text);
  onState(state);
  return null;
}

describe('useRecordSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearch.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  const run = (text: string) => {
    const states: SearchState[] = [];
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe text={text} onState={s => states.push(s)} />);
    });
    return { renderer, states, last: () => states[states.length - 1] };
  };

  it('waits 300 ms of quiet before asking', async () => {
    mockSearch.mockResolvedValue([result()]);
    const probe = run('steel');
    await act(async () => jest.advanceTimersByTime(299));
    expect(mockSearch).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch.mock.calls[0][0]).toBe('steel');
    await act(async () => undefined);
    expect(probe.last()).toMatchObject({ status: 'done', term: 'steel' });
  });

  it('does not search for fewer than two characters', async () => {
    const probe = run(' a ');
    await act(async () => jest.advanceTimersByTime(1_000));
    expect(mockSearch).not.toHaveBeenCalled();
    expect(probe.last()).toEqual({ status: 'idle' });
  });

  it('sends at most 80 characters', async () => {
    mockSearch.mockResolvedValue([]);
    run('x'.repeat(200));
    await act(async () => jest.advanceTimersByTime(300));
    expect(mockSearch.mock.calls[0][0]).toHaveLength(80);
  });

  it('aborts the previous request when the text changes, so a slow old answer cannot win', async () => {
    const signals: AbortSignal[] = [];
    let resolveSlow!: (value: SellerSearchResult[]) => void;
    mockSearch.mockImplementationOnce((_term: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<SellerSearchResult[]>(resolve => {
        resolveSlow = resolve;
      });
    });
    mockSearch.mockImplementationOnce(
      async (_term: string, signal: AbortSignal) => {
        signals.push(signal);
        return [result({ id: 'new', title: 'newer' })];
      },
    );
    const states: SearchState[] = [];
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe text="ste" onState={s => states.push(s)} />);
    });
    await act(async () => jest.advanceTimersByTime(300));
    act(() => {
      renderer.update(<Probe text="steel" onState={s => states.push(s)} />);
    });
    expect(signals[0].aborted).toBe(true);
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => undefined);
    // The slow first answer arrives last and is ignored.
    await act(async () => resolveSlow([result({ id: 'old', title: 'older' })]));
    const final = states[states.length - 1];
    expect(final).toMatchObject({ status: 'done', term: 'steel' });
    expect(JSON.stringify(final)).toContain('newer');
    expect(JSON.stringify(final)).not.toContain('older');
  });

  it('reports an error and tries again on retry', async () => {
    mockSearch
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValueOnce([]);
    let retry!: () => void;
    const states: SearchState[] = [];
    function Retry() {
      const search = useRecordSearch('steel');
      retry = search.retry;
      states.push(search.state);
      return null;
    }
    act(() => {
      create(<Retry />);
    });
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => undefined);
    expect(states[states.length - 1]).toMatchObject({ status: 'error' });
    act(() => retry());
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => undefined);
    expect(states[states.length - 1]).toMatchObject({ status: 'done' });
  });

  it('counts results through onResults, without the text', async () => {
    mockSearch.mockResolvedValue([result(), result({ id: 'o2' })]);
    const onResults = jest.fn();
    function Counted() {
      useRecordSearch('steel', { onResults });
      return null;
    }
    act(() => {
      create(<Counted />);
    });
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => undefined);
    expect(onResults).toHaveBeenCalledWith(2);
  });
});

/* ------------------------------------------------------------------ screen */

const has = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(node => node.props.testID === id).length > 0;
const press = (renderer: ReactTestRenderer, id: string) =>
  act(() => {
    renderer.root
      .find(
        node =>
          node.props.testID === id && typeof node.props.onPress === 'function',
      )
      .props.onPress();
  });
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

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clearRecentSearches();
  });
  afterEach(() => jest.useRealTimers());

  async function type(renderer: ReactTestRenderer, value: string) {
    await act(async () => {
      renderer.root
        .find(
          node =>
            node.props.testID === 'search-input' && node.props.onChangeText,
        )
        .props.onChangeText(value);
    });
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => undefined);
  }

  const show = async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<SearchScreen />);
    });
    return renderer;
  };

  it('starts with a prompt when there are no recent searches', async () => {
    const renderer = await show();
    expect(words(renderer)).toContain(t('search.emptyTitle'));
  });

  it('groups results by type with a tag on each row', async () => {
    mockSearch.mockResolvedValue([
      result(),
      result({
        type: 'PRODUCT',
        id: 'p1',
        title: 'Steel pipe',
        subtitle: 'SKU-1',
        href: '/seller/dashboard/products?q=Steel+pipe',
      }),
    ]);
    const renderer = await show();
    await type(renderer, 'steel');
    expect(has(renderer, 'search-group-ORDER')).toBe(true);
    expect(has(renderer, 'search-group-PRODUCT')).toBe(true);
    expect(words(renderer)).toContain('TV-100');
    expect(words(renderer)).toContain(t('search.type.PRODUCT'));
  });

  it('opens the screen a result belongs to, keeping its parameters', async () => {
    mockSearch.mockResolvedValue([result()]);
    const renderer = await show();
    await type(renderer, 'tv-100');
    press(renderer, 'search-result-ORDER-o1');
    expect(mockOpenRoute).toHaveBeenCalledWith({
      name: 'Main',
      params: { screen: 'Orders', query: { order: 'o1' } },
    });
  });

  it('remembers a search the seller acted on, newest first', async () => {
    mockSearch.mockResolvedValue([result()]);
    const renderer = await show();
    await type(renderer, 'tv-100');
    press(renderer, 'search-result-ORDER-o1');
    expect(loadRecentSearches()).toEqual(['tv-100']);
  });

  it('offers "Open on web" for a result the app cannot place', async () => {
    mockSearch.mockResolvedValue([
      result({
        id: 'x',
        type: 'PAYOUT',
        href: '/seller/dashboard/somewhere-new?x=1',
      }),
    ]);
    const renderer = await show();
    await type(renderer, 'payout');
    press(renderer, 'search-result-PAYOUT-x');
    expect(mockOpenRoute).not.toHaveBeenCalled();
    expect(has(renderer, 'search-open-web')).toBe(true);
  });

  it('never offers a link outside the portal', async () => {
    mockSearch.mockResolvedValue([
      result({ id: 'y', type: 'PAYOUT', href: 'https://evil.example/steal' }),
    ]);
    const renderer = await show();
    await type(renderer, 'payout');
    press(renderer, 'search-result-PAYOUT-y');
    expect(mockOpenRoute).not.toHaveBeenCalled();
    const open = renderer.root.find(
      node =>
        node.props.testID === 'search-open-web' &&
        typeof node.props.onAction === 'function',
    );
    await act(async () => open.props.onAction());
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it("says there are no results for the term, in the seller's account", async () => {
    mockSearch.mockResolvedValue([]);
    const renderer = await show();
    await type(renderer, 'zzzz');
    expect(words(renderer)).toContain(t('search.noResults', { term: 'zzzz' }));
  });

  it('shows the error state with a retry', async () => {
    mockSearch.mockRejectedValue(new Error('net'));
    const renderer = await show();
    await type(renderer, 'steel');
    expect(words(renderer)).toContain(t('search.error'));
  });

  it('asks for a second character instead of searching on one', async () => {
    const renderer = await show();
    await type(renderer, 'a');
    expect(mockSearch).not.toHaveBeenCalled();
    expect(words(renderer)).toContain(t('search.minLength', { count: 2 }));
  });

  it('shows the recent searches before typing, and clears them', async () => {
    mockSearch.mockResolvedValue([result()]);
    let renderer = await show();
    await type(renderer, 'tv-100');
    press(renderer, 'search-result-ORDER-o1');
    renderer = await show();
    expect(has(renderer, 'search-recent')).toBe(true);
    press(renderer, 'search-clear-recent');
    expect(has(renderer, 'search-recent')).toBe(false);
    expect(loadRecentSearches()).toEqual([]);
  });
});
