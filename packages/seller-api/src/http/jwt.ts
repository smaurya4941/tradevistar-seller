/**
 * Reads the `exp` claim of a JWT without verifying it. The server stays authoritative; this only
 * lets the client refresh ahead of expiry instead of eating a 401 first.
 *
 * Decodes base64url by hand because `atob` is not guaranteed on every JS runtime we ship to.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64UrlDecode(input: string): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const char of input.replace(/[=]+$/, "")) {
    const index = ALPHABET.indexOf(char === "+" ? "-" : char === "/" ? "_" : char);
    if (index === -1) throw new Error("Invalid base64url");
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  // The payload is UTF-8 JSON; claims we read are ASCII, but decode properly anyway.
  try {
    return decodeURIComponent(
      output
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    return output;
  }
}

/** Milliseconds since epoch at which the token expires, or undefined when unreadable. */
export function tokenExpiresAt(token: string): number | undefined {
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1] ?? "")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/** The session id (`sid` claim) the access token belongs to, or undefined when unreadable. */
export function tokenSessionId(token: string): string | undefined {
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1] ?? "")) as { sid?: unknown };
    return typeof payload.sid === "string" ? payload.sid : undefined;
  } catch {
    return undefined;
  }
}
