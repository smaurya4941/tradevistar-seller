/**
 * The knowledge base: articles grouped by category, a local search over question and answer text,
 * and the once-only bookkeeping for view counts and "helpful" votes.
 *
 * Answers are plain text. A view is counted once per article per app session; a "helpful" vote is
 * sent once per article per device, and the voted ids are remembered so a repeat tap does nothing.
 */
import { formatStatusLabel, type Faq } from '@tradevistar/seller-api';
import {
  deviceStorage,
  DeviceKeys,
  readJson,
  writeJson,
} from '@/core/storage/kv';

export interface FaqGroup {
  category: string;
  /** A readable name: "ORDER" → "Order". */
  title: string;
  faqs: Faq[];
}

const UNCATEGORISED = 'GENERAL';

/** Articles whose question or answer contains every typed word; an empty query keeps them all. */
export function filterFaqs(faqs: readonly Faq[], query: string): Faq[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...faqs];
  return faqs.filter(faq => {
    const haystack = `${faq.q} ${faq.a}`.toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

/** Articles grouped by category in the order the categories first appear. */
export function groupFaqs(faqs: readonly Faq[]): FaqGroup[] {
  const groups = new Map<string, FaqGroup>();
  for (const faq of faqs) {
    const category = faq.category?.trim() || UNCATEGORISED;
    let group = groups.get(category);
    if (!group) {
      group = { category, title: formatStatusLabel(category), faqs: [] };
      groups.set(category, group);
    }
    group.faqs.push(faq);
  }
  return [...groups.values()];
}

/* ------------------------------------------------------------------ once-only counters */

const viewedThisSession = new Set<string>();

/** True the first time an article is opened in this app session. */
export function shouldCountView(id: string): boolean {
  if (viewedThisSession.has(id)) return false;
  viewedThisSession.add(id);
  return true;
}

export function resetViewedForTests(): void {
  viewedThisSession.clear();
}

export function votedIds(): Set<string> {
  const stored = readJson<string[]>(deviceStorage, DeviceKeys.faqVotes);
  return new Set(Array.isArray(stored) ? stored : []);
}

export function hasVoted(id: string): boolean {
  return votedIds().has(id);
}

/** Remembers a vote; returns false when the article was already voted on (nothing to send). */
export function rememberVote(id: string): boolean {
  const ids = votedIds();
  if (ids.has(id)) return false;
  ids.add(id);
  writeJson(deviceStorage, DeviceKeys.faqVotes, [...ids]);
  return true;
}

/** Forgets a vote whose request failed, so the seller can try again. */
export function forgetVote(id: string): void {
  const ids = votedIds();
  if (ids.delete(id)) writeJson(deviceStorage, DeviceKeys.faqVotes, [...ids]);
}
