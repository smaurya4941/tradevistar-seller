/**
 * The footer and its pages (About, Help, Terms, Privacy…), written in Admin → Footer. Public, so
 * the sign-in screen can read them too. The app asks for the seller site's footer.
 */
import { api } from "../http/client";

/** Footer columns an admin can link a page from. LEGAL is the bottom bar (Privacy, Terms…). */
export type FooterColumn = "PLATFORM" | "COMPANY" | "SUPPORT" | "LEGAL";

export const FOOTER_COLUMNS: readonly FooterColumn[] = ["PLATFORM", "COMPANY", "SUPPORT", "LEGAL"];

export interface FooterLink {
  slug: string;
  label: string;
}

export interface FooterSettings {
  tagline: string;
  platformHeading: string;
  companyHeading: string;
  supportHeading: string;
  copyright: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  whatsappUrl: string | null;
  playStoreUrl?: string | null;
  appStoreUrl?: string | null;
}

export interface FooterContent {
  settings: FooterSettings;
  columns: Record<FooterColumn, FooterLink[]>;
}

export interface FooterPage {
  slug: string;
  column: FooterColumn;
  label: string;
  title: string;
  summary: string | null;
  /** Paragraphs, "## " headings, "- " / "1. " lists, **bold** and [text](url) links. */
  body: string;
  showContactForm: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  updatedAt: string;
}

export interface SuccessStory {
  id: string;
  name: string;
  company: string;
  quote: string;
  /** A picture of the person; the app draws an initial when it is missing. */
  imageUrl: string | null;
}

export interface FooterEnquiryInput {
  pageSlug: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  message: string;
}

export const getFooter = (signal?: AbortSignal) =>
  api.get<FooterContent>("/footer?audience=seller", { skipAuth: true, signal });

/** One published page; a 404 means it does not exist or was unpublished. */
export const getFooterPage = (slug: string, signal?: AbortSignal) =>
  api.get<FooterPage>(`/footer/pages/${encodeURIComponent(slug)}?audience=seller`, { skipAuth: true, signal });

export const listSuccessStories = (signal?: AbortSignal) =>
  api.get<SuccessStory[]>("/footer/success-stories", { skipAuth: true, signal });

/**
 * Sends the contact form on a page that has one; the message lands in Admin → Footer → Enquiries.
 * Throttled to 5 a minute. Pass the same key to retry an attempt whose answer was lost.
 */
export const sendFooterEnquiry = (input: FooterEnquiryInput, idempotencyKey?: string) =>
  api.post<{ id: string; received: true }>(
    "/footer/enquiries",
    { ...input, audience: "SELLER" },
    { skipAuth: true, idempotencyKey },
  );
