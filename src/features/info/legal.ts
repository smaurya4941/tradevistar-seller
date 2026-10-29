/**
 * Terms and Privacy links. When the footer lists the page in its Legal column, the link opens the
 * in-app page (readable offline, and signed out); otherwise it falls back to the address in the
 * build's environment. The footer is read from the saved copy first, so a missing connection does
 * not change where the link goes.
 */
import {
  FOOTER_SLUGS,
  getFooter,
  type FooterContent,
} from '@tradevistar/seller-api';
import { env } from '@/config/env';
import { readStored } from '@/core/query/persistedQuery';
import { queryClient, queryKeys } from '@/core/query/queryClient';
import { deviceStorage } from '@/core/storage/kv';
import { FOOTER_FRESH_MS, FOOTER_KEEP_MS } from './data';
import { openExternal, openFooterPage } from './openLinks';

export type LegalDocument = 'terms' | 'privacy';

const SLUG: Record<LegalDocument, string> = {
  terms: FOOTER_SLUGS.terms,
  privacy: FOOTER_SLUGS.privacy,
};

const FALLBACK_URL: Record<LegalDocument, () => string> = {
  terms: () => env.termsUrl,
  privacy: () => env.privacyUrl,
};

/** True when the Legal column lists the page. */
export function legalColumnHas(
  footer: FooterContent | null | undefined,
  slug: string,
): boolean {
  return Boolean(footer?.columns?.LEGAL?.some(link => link.slug === slug));
}

async function loadFooter(): Promise<FooterContent | null> {
  try {
    return await queryClient.fetchQuery({
      queryKey: [...queryKeys.footer, 'content'],
      queryFn: ({ signal }) => getFooter(signal),
      staleTime: FOOTER_FRESH_MS,
    });
  } catch {
    const saved = readStored<FooterContent>('footer.content', deviceStorage);
    return saved && Date.now() - saved.at <= FOOTER_KEEP_MS ? saved.data : null;
  }
}

/** Opens the document: the in-app page when the footer has it, else the web address. */
export async function openLegalDocument(kind: LegalDocument): Promise<void> {
  const footer = await loadFooter();
  if (legalColumnHas(footer, SLUG[kind])) {
    openFooterPage(SLUG[kind]);
    return;
  }
  await openExternal(FALLBACK_URL[kind]());
}
