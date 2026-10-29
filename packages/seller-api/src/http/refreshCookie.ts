/**
 * The API scopes each portal's refresh cookie by name (`tv_refresh_<portal>`), so the buyer,
 * seller and admin sessions never overwrite one another.
 */
export function refreshCookieName(portal: string): string {
  return `tv_refresh_${portal}`;
}

export interface ParsedCookie {
  /** The value, or null when the server cleared the cookie. */
  value: string | null;
}

const COOKIE_START = /,\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=/;

/**
 * Pulls one cookie out of a `Set-Cookie` header value.
 *
 * Native stacks join repeated headers with ", ", and `Expires=Wed, 21 Oct 2026 07:28:00 GMT`
 * contains a comma too, so the header cannot simply be split on commas. A new cookie starts at a
 * comma followed by a `name=` token (which never contains a space); the comma inside a date is
 * followed by a day number and a space, so it never looks like one.
 *
 * Returns undefined when the header does not mention the cookie at all.
 */
export function parseSetCookie(header: string | null | undefined, name: string): ParsedCookie | undefined {
  if (!header) return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`(?:^|,)\\s*${escaped}=`).exec(header);
  if (!start) return undefined;

  const rest = header.slice(start.index + start[0].length);
  const end = rest.search(COOKIE_START);
  const segment = end === -1 ? rest : rest.slice(0, end);
  const [rawValue, ...attributeParts] = segment.split(";");
  const attributes = attributeParts.map((part) => part.trim().toLowerCase());

  let value: string;
  try {
    value = decodeURIComponent(rawValue.trim());
  } catch {
    value = rawValue.trim();
  }
  const expired = attributes.some(
    (attribute) =>
      /^max-age=(0|-\d+)$/.test(attribute) || /^expires=.*\b1970\b/.test(attribute),
  );
  return { value: value === "" || expired ? null : value };
}
