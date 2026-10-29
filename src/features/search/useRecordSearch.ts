/**
 * The search box's behaviour as a hook: a 300 ms pause before asking, at least 2 and at most 80
 * characters, and the previous request aborted on every keystroke, so a slow old answer can never
 * replace newer results. The text typed is never logged.
 */
import {
  searchableTerm,
  searchSellerRecords,
  SEARCH_LIMITS,
  type SellerSearchResult,
} from '@tradevistar/seller-api';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; term: string }
  | { status: 'done'; term: string; results: SellerSearchResult[] }
  | { status: 'error'; term: string };

export interface RecordSearch {
  state: SearchState;
  retry: () => void;
}

export function useRecordSearch(
  text: string,
  options: {
    search?: typeof searchSellerRecords;
    onResults?: (count: number) => void;
  } = {},
): RecordSearch {
  const { search = searchSellerRecords, onResults } = options;
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    const term = searchableTerm(text);
    if (!term) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ status: 'loading', term });
      searchRef
        .current(term, controller.signal)
        .then(results => {
          if (controller.signal.aborted) return;
          setState({ status: 'done', term, results });
          onResultsRef.current?.(results.length);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setState({ status: 'error', term });
        });
    }, SEARCH_LIMITS.debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { state, retry };
}
