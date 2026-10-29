import { ApiError, emitSellerEvent } from '@tradevistar/seller-api';
import { QueryClient } from '@tanstack/react-query';
import {
  cancelScheduledInvalidation,
  MUTATION_INVALIDATE_DEBOUNCE_MS,
  queryClient,
  scheduleActiveInvalidation,
  watchMutations,
} from '../queryClient';

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cancelScheduledInvalidation();
  jest.useRealTimers();
});

describe('defaults', () => {
  const retry = queryClient.getDefaultOptions().queries?.retry as (
    count: number,
    error: unknown,
  ) => boolean;

  it('does not retry a 4xx', () => {
    const error = new ApiError(404, { code: 'NOT_FOUND', message: 'x' });
    expect(retry(0, error)).toBe(false);
    expect(retry(0, new ApiError(422, { code: 'V', message: 'x' }))).toBe(
      false,
    );
  });

  it('retries a network failure or a 5xx twice, then stops', () => {
    const network = new ApiError(0, { code: 'NETWORK_ERROR', message: 'x' });
    const server = new ApiError(503, { code: 'X', message: 'x' });
    expect(retry(0, network)).toBe(true);
    expect(retry(1, server)).toBe(true);
    expect(retry(2, server)).toBe(false);
  });

  it('never retries a mutation', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });
});

describe('invalidation after a successful mutation', () => {
  it('invalidates active queries once, 250 ms after the last success', async () => {
    const client = freshClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const stop = watchMutations(client);

    const run = () =>
      client
        .getMutationCache()
        .build(client, { mutationFn: async () => 'ok' })
        .execute(undefined);

    await run();
    jest.advanceTimersByTime(MUTATION_INVALIDATE_DEBOUNCE_MS - 50);
    await run();
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(MUTATION_INVALIDATE_DEBOUNCE_MS - 1);
    expect(spy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ refetchType: 'active' });
    stop();
  });

  it('refetches an active query and leaves an inactive one alone', async () => {
    const client = freshClient();
    const activeFetch = jest.fn(async () => 'a');
    const idleFetch = jest.fn(async () => 'i');
    const observer = client.getQueryCache();
    const active = client
      .getQueryCache()
      .build(client, { queryKey: ['active'], queryFn: activeFetch });
    const idle = client
      .getQueryCache()
      .build(client, { queryKey: ['idle'], queryFn: idleFetch });
    await active.fetch();
    await idle.fetch();
    // An observer makes the query "active".
    const { QueryObserver } = jest.requireActual('@tanstack/react-query');
    const unsubscribe = new QueryObserver(client, {
      queryKey: ['active'],
      queryFn: activeFetch,
      staleTime: Infinity,
    }).subscribe(() => undefined);
    activeFetch.mockClear();
    idleFetch.mockClear();
    expect(observer.getAll()).toHaveLength(2);

    scheduleActiveInvalidation(client);
    jest.advanceTimersByTime(MUTATION_INVALIDATE_DEBOUNCE_MS);
    await Promise.resolve();

    expect(activeFetch).toHaveBeenCalledTimes(1);
    expect(idleFetch).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does nothing for a failed mutation', async () => {
    const client = freshClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const stop = watchMutations(client);

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => {
          throw new Error('nope');
        },
      })
      .execute(undefined)
      .catch(() => undefined);
    jest.advanceTimersByTime(MUTATION_INVALIDATE_DEBOUNCE_MS * 2);

    expect(spy).not.toHaveBeenCalled();
    stop();
  });

  it('stops listening once unsubscribed', async () => {
    const client = freshClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    watchMutations(client)();

    await client
      .getMutationCache()
      .build(client, { mutationFn: async () => 'ok' })
      .execute(undefined);
    jest.advanceTimersByTime(MUTATION_INVALIDATE_DEBOUNCE_MS * 2);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('API events', () => {
  it('has no listeners for events nobody subscribed to', () => {
    expect(() => emitSellerEvent('access:verification-required')).not.toThrow();
  });
});
