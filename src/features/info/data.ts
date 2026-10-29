/**
 * Server state for the help and legal pages. They are public and managed in Admin → Footer.
 *
 * The footer is fresh for 5 minutes in memory and kept on the device for 24 hours, so a legal page
 * opens offline. Each page is kept the same way, so a page read once opens without a connection.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getFooter,
  getFooterPage,
  listSuccessStories,
} from '@tradevistar/seller-api';
import { withStoredAnswer } from '@/core/query/persistedQuery';
import { queryKeys } from '@/core/query/queryClient';
import { deviceStorage } from '@/core/storage/kv';

export const FOOTER_FRESH_MS = 5 * 60_000;
export const FOOTER_KEEP_MS = 24 * 60 * 60_000;

export function useFooter() {
  return useQuery({
    queryKey: [...queryKeys.footer, 'content'],
    ...withStoredAnswer(
      'footer.content',
      getFooter,
      deviceStorage,
      FOOTER_KEEP_MS,
    ),
    staleTime: FOOTER_FRESH_MS,
  });
}

export function useFooterPage(slug: string) {
  return useQuery({
    queryKey: [...queryKeys.footer, 'page', slug],
    ...withStoredAnswer(
      `footer.page.${slug}`,
      signal => getFooterPage(slug, signal),
      deviceStorage,
      FOOTER_KEEP_MS,
    ),
    staleTime: FOOTER_FRESH_MS,
    // A page that does not exist (or was unpublished) will not appear by asking again.
    retry: (count, error) =>
      !(
        error instanceof Error &&
        'statusCode' in error &&
        error.statusCode === 404
      ) && count < 2,
  });
}

export function useSuccessStories() {
  return useQuery({
    queryKey: [...queryKeys.footer, 'stories'],
    ...withStoredAnswer(
      'footer.stories',
      listSuccessStories,
      deviceStorage,
      FOOTER_KEEP_MS,
    ),
    staleTime: FOOTER_FRESH_MS,
  });
}
