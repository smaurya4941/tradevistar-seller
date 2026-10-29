import {
  readStored,
  storedKey,
  updatedAtOf,
  withStoredAnswer,
  writeStored,
} from '../persistedQuery';
import { deviceStorage, userStorage } from '@/core/storage/kv';

beforeEach(() => {
  userStorage.clearAll();
  deviceStorage.clearAll();
});

const signal = new AbortController().signal;

describe('stored answers', () => {
  it('stores each successful answer and seeds the next query with it', async () => {
    const fetcher = jest.fn(async () => ({ total: 5 }));
    const first = withStoredAnswer('home.test', fetcher);
    expect(first.initialData).toBeUndefined();
    await expect(first.queryFn({ signal })).resolves.toEqual({ total: 5 });
    expect(readStored('home.test')?.data).toEqual({ total: 5 });

    const second = withStoredAnswer('home.test', fetcher);
    expect(second.initialData).toEqual({ total: 5 });
    expect(second.initialDataUpdatedAt).toBeGreaterThan(0);
  });

  it('keeps the old answer when a refresh fails', async () => {
    writeStored('home.test', { total: 1 });
    const failing = withStoredAnswer('home.test', async () => {
      throw new Error('offline');
    });
    await expect(failing.queryFn({ signal })).rejects.toThrow('offline');
    expect(readStored('home.test')?.data).toEqual({ total: 1 });
  });

  it('ignores a stored answer older than its limit', () => {
    writeStored('footer.content', { x: 1 }, deviceStorage);
    const stored = JSON.parse(
      deviceStorage.getString(storedKey('footer.content')) as string,
    );
    deviceStorage.set(
      storedKey('footer.content'),
      JSON.stringify({ ...stored, at: Date.now() - 25 * 3_600_000 }),
    );
    expect(
      withStoredAnswer(
        'footer.content',
        async () => 1,
        deviceStorage,
        24 * 3_600_000,
      ).initialData,
    ).toBeUndefined();
    expect(
      withStoredAnswer('footer.content', async () => 1, deviceStorage)
        .initialData,
    ).toEqual({ x: 1 });
  });

  it('keeps seller data and public data in separate stores', () => {
    writeStored('a', 1);
    writeStored('b', 2, deviceStorage);
    userStorage.clearAll();
    expect(readStored('a')).toBeUndefined();
    expect(readStored('b', deviceStorage)?.data).toBe(2);
  });

  it('survives corrupt storage', () => {
    userStorage.set(storedKey('bad'), 'not json');
    expect(readStored('bad')).toBeUndefined();
  });

  it('reports when an answer was last updated, live or stored', () => {
    expect(updatedAtOf(123, 'nothing')).toBe(123);
    expect(updatedAtOf(0, 'nothing')).toBeNull();
    writeStored('known', 1);
    expect(updatedAtOf(0, 'known')).toBeGreaterThan(0);
  });
});
