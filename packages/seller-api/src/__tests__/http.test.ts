import { base64url } from "../testing/b64";
import { parseSetCookie, refreshCookieName, tokenExpiresAt, tokenSessionId } from "../index";

describe("refresh cookie", () => {
  it("is named after the seller portal", () => {
    expect(refreshCookieName("seller")).toBe("tv_refresh_seller");
  });

  it("reads this portal's cookie and ignores the others", () => {
    const header =
      "tv_refresh_buyer=b-token; Path=/api/v1/auth; HttpOnly, tv_refresh_seller=s-token; Path=/api/v1/auth; HttpOnly";
    expect(parseSetCookie(header, "tv_refresh_seller")).toEqual({ value: "s-token" });
    expect(parseSetCookie(header, "tv_refresh_buyer")).toEqual({ value: "b-token" });
    expect(parseSetCookie(header, "tv_refresh_admin")).toBeUndefined();
  });

  it("survives the comma inside an Expires date", () => {
    const header =
      "tv_refresh_seller=abc.def; Path=/api/v1/auth; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; SameSite=Lax";
    expect(parseSetCookie(header, "tv_refresh_seller")).toEqual({ value: "abc.def" });
  });

  it("reports a cleared cookie as null", () => {
    expect(parseSetCookie("tv_refresh_seller=; Max-Age=0; Path=/", "tv_refresh_seller")).toEqual({ value: null });
    expect(
      parseSetCookie("tv_refresh_seller=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT", "tv_refresh_seller"),
    ).toEqual({ value: null });
  });

  it("returns undefined for an empty header", () => {
    expect(parseSetCookie(null, "tv_refresh_seller")).toBeUndefined();
    expect(parseSetCookie("", "tv_refresh_seller")).toBeUndefined();
  });
});

describe("jwt", () => {
  const token = (claims: object) => `h.${base64url(JSON.stringify(claims))}.s`;

  it("reads exp and sid without verifying", () => {
    const jwt = token({ exp: 1_800_000_000, sid: "session-1" });
    expect(tokenExpiresAt(jwt)).toBe(1_800_000_000_000);
    expect(tokenSessionId(jwt)).toBe("session-1");
  });

  it("returns undefined for junk", () => {
    expect(tokenExpiresAt("not-a-token")).toBeUndefined();
    expect(tokenSessionId("a.b")).toBeUndefined();
    expect(tokenExpiresAt(token({}))).toBeUndefined();
  });
});
