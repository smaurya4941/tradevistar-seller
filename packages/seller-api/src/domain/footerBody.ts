/**
 * Rules for the footer pages, shared with the web so both read a page the same way.
 *
 * A page body is plain text written in Admin → Footer: blank-line separated paragraphs, "## " and
 * "### " headings, "- " and "1. " lists, **bold** and [text](url) links. It is parsed here into
 * blocks and inline pieces and drawn by the app as native text — never HTML — and only site paths,
 * http(s), mailto and tel links become tappable.
 */
import type { FooterContent, FooterEnquiryInput, FooterLink, FooterSettings } from "../endpoints/footer";

/** Slugs the app links to by name (the seller footer's seed). An admin can rename or unpublish them. */
export const FOOTER_SLUGS = {
  terms: "terms-of-use",
  privacy: "privacy-policy",
  help: "help-support",
  faq: "faqs",
  successStories: "seller-success-stories",
} as const;

/** Web address of a footer page. */
export const footerPageHref = (slug: string): string => `/info/${encodeURIComponent(slug)}`;

/* ------------------------------------------------------------------ body */

export type FooterBlock =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

type ListBlock = { kind: "ul" | "ol"; items: string[] };

export function parseFooterBody(body: string | null | undefined): FooterBlock[] {
  const blocks: FooterBlock[] = [];
  let paragraph: string[] = [];
  let list = null as ListBlock | null;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join("\n") });
    if (list) blocks.push(list);
    paragraph = [];
    list = null;
  };

  for (const raw of (body ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: heading[1].length === 3 ? "h3" : "h2", text: heading[2] });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      const kind = bullet ? "ul" : "ol";
      if (paragraph.length || (list && list.kind !== kind)) flush();
      if (!list) list = { kind, items: [] };
      list.items.push(item[1]);
      continue;
    }
    if (list) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Where a link in a page may go: a page of this site, or an outside web, mail or phone address. */
export type SafeLink = { kind: "site"; href: string } | { kind: "external"; url: string };

export function safeLink(href: string): SafeLink | null {
  const value = href.trim();
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return { kind: "site", href: value };
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return { kind: "external", url: value };
  return null;
}

export type InlinePiece =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; link: SafeLink };

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

/** A line of body text as plain, bold and linked pieces. A link that is not safe stays plain text. */
export function parseInline(text: string): InlinePiece[] {
  const pieces: InlinePiece[] = [];
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      pieces.push({ kind: "bold", text: part.slice(2, -2) });
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const target = safeLink(link[2]);
      pieces.push(target ? { kind: "link", text: link[1], link: target } : { kind: "text", text: link[1] });
      continue;
    }
    pieces.push({ kind: "text", text: part });
  }
  return pieces;
}

/* ------------------------------------------------------------------ contact details */

export type ContactKind = "email" | "phone" | "address";

export interface ContactRow {
  kind: ContactKind;
  value: string;
  /** What tapping it opens; null for an address shown as text. */
  url: string | null;
}

/** A phone number as a tel: address, keeping only the digits and a leading plus. */
export function telUrl(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return /\d{3,}/.test(digits) ? `tel:${digits}` : null;
}

export function contactRows(page: {
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
}): ContactRow[] {
  const rows: ContactRow[] = [];
  const email = page.contactEmail?.trim();
  if (email) rows.push({ kind: "email", value: email, url: `mailto:${email}` });
  const phone = page.contactPhone?.trim();
  if (phone) rows.push({ kind: "phone", value: phone, url: telUrl(phone) });
  const address = page.contactAddress?.trim();
  if (address) rows.push({ kind: "address", value: address, url: null });
  return rows;
}

/* ------------------------------------------------------------------ social links */

export type SocialNetwork = "facebook" | "instagram" | "linkedin" | "whatsapp" | "x" | "youtube";

const SOCIAL_FIELDS: [SocialNetwork, keyof FooterSettings][] = [
  ["facebook", "facebookUrl"],
  ["instagram", "instagramUrl"],
  ["linkedin", "linkedinUrl"],
  ["whatsapp", "whatsappUrl"],
  ["x", "xUrl"],
  ["youtube", "youtubeUrl"],
];

/** The social profiles an admin filled in, in the web's order. Only http(s) addresses are kept. */
export function socialLinks(settings: FooterSettings | null | undefined): { network: SocialNetwork; url: string }[] {
  if (!settings) return [];
  return SOCIAL_FIELDS.flatMap(([network, field]) => {
    const url = settings[field];
    return typeof url === "string" && /^https?:\/\//i.test(url.trim()) ? [{ network, url: url.trim() }] : [];
  });
}

/** A column's links; empty when the footer has not loaded or the column has none. */
export const footerColumn = (
  footer: FooterContent | null | undefined,
  column: keyof FooterContent["columns"],
): FooterLink[] => footer?.columns?.[column] ?? [];

/** The page's slug if it appears in any column of the footer. */
export function footerHasSlug(footer: FooterContent | null | undefined, slug: string): boolean {
  if (!footer?.columns) return false;
  return Object.values(footer.columns).some((links) => links.some((link) => link.slug === slug));
}

/* ------------------------------------------------------------------ contact form */

/** Mirrors the API's CreateFooterEnquiryDto. */
export const ENQUIRY_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  emailMax: 254,
  phoneMin: 7,
  phoneMax: 19,
  companyMax: 160,
  messageMin: 10,
  messageMax: 2000,
  /** The message counter appears from here. */
  counterFrom: 1800,
} as const;

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const PHONE = /^\+?[0-9][0-9\s-]{6,18}$/;

export interface EnquiryForm {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  message: string;
}

export const EMPTY_ENQUIRY: Readonly<EnquiryForm> = Object.freeze({
  name: "",
  email: "",
  phone: "",
  companyName: "",
  message: "",
});

export type EnquiryField = keyof EnquiryForm;
export type EnquiryError = "nameInvalid" | "emailInvalid" | "phoneInvalid" | "companyLong" | "messageShort" | "messageLong";

export function validateEnquiry(form: EnquiryForm): Partial<Record<EnquiryField, EnquiryError>> {
  const errors: Partial<Record<EnquiryField, EnquiryError>> = {};
  const name = form.name.trim();
  if (name.length < ENQUIRY_LIMITS.nameMin || name.length > ENQUIRY_LIMITS.nameMax) errors.name = "nameInvalid";
  const email = form.email.trim();
  if (!EMAIL.test(email) || email.length > ENQUIRY_LIMITS.emailMax) errors.email = "emailInvalid";
  const phone = form.phone.trim();
  if (phone && !PHONE.test(phone)) errors.phone = "phoneInvalid";
  if (form.companyName.trim().length > ENQUIRY_LIMITS.companyMax) errors.companyName = "companyLong";
  const message = form.message.trim();
  if (message.length < ENQUIRY_LIMITS.messageMin) errors.message = "messageShort";
  else if (message.length > ENQUIRY_LIMITS.messageMax) errors.message = "messageLong";
  return errors;
}

/** The request body for the contact form, trimmed; null while the form is invalid. */
export function enquiryBody(pageSlug: string, form: EnquiryForm): FooterEnquiryInput | null {
  if (Object.keys(validateEnquiry(form)).length) return null;
  const phone = form.phone.trim();
  const companyName = form.companyName.trim();
  return {
    pageSlug,
    name: form.name.trim(),
    email: form.email.trim(),
    ...(phone ? { phone } : {}),
    ...(companyName ? { companyName } : {}),
    message: form.message.trim(),
  };
}

/** What a signed-in seller's form starts with, so they do not type what the app already knows. */
export function enquiryPrefill(
  user: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null | undefined,
  companyName?: string | null,
): EnquiryForm {
  if (!user) return { ...EMPTY_ENQUIRY };
  return {
    name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
    email: user.email ?? "",
    phone: user.phone ?? "",
    companyName: companyName ?? "",
    message: "",
  };
}
