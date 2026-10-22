import { describe, expect, it } from "vitest";
import { chromeFor, publicOrigin, safeNext, waitlistRoute } from "../siteMode";

describe("waitlistRoute", () => {
  it("shows the waitlist at the root", () => expect(waitlistRoute("/")).toEqual({ action: "rewrite", to: "/waitlist" }));

  it("keeps sign-in, the waitlist, admin and legal pages open", () => {
    for (const path of ["/waitlist", "/join/finish", "/signin", "/admin/waitlist", "/privacy", "/terms", "/api/auth/code/start", "/api/waitlist/join", "/api/admin/waitlist/export"]) {
      expect(waitlistRoute(path)).toEqual({ action: "allow" });
    }
  });

  it("closes the rest of the app", () => {
    expect(waitlistRoute("/matches")).toEqual({ action: "redirect", to: "/" });
    expect(waitlistRoute("/signup")).toEqual({ action: "redirect", to: "/" });
    expect(waitlistRoute("/waitlisted")).toEqual({ action: "redirect", to: "/" });
    expect(waitlistRoute("/api/matches")).toEqual({ action: "not-found" });
    expect(waitlistRoute("/api/profile")).toEqual({ action: "not-found" });
  });
});

describe("chromeFor", () => {
  it("lets the landing page draw itself", () => {
    expect(chromeFor("/waitlist", false)).toBe("none");
    expect(chromeFor("/", true)).toBe("none");
  });
  it("hides the app tabs in waitlist mode", () => {
    expect(chromeFor("/signin", true)).toBe("minimal");
    expect(chromeFor("/join/finish", false)).toBe("minimal");
    expect(chromeFor("/", false)).toBe("full");
    expect(chromeFor("/signin", false)).toBe("full");
  });
});

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/matches", "/")).toBe("/matches");
    expect(safeNext("//evil.example", "/")).toBe("/");
    expect(safeNext("/\\evil.example", "/")).toBe("/");
    expect(safeNext("https://evil.example", "/")).toBe("/");
    expect(safeNext(null, "/waitlist")).toBe("/waitlist");
  });
});

describe("publicOrigin", () => {
  it("uses the forwarded host", () => {
    expect(publicOrigin(new Headers({ host: "internal:3000", "x-forwarded-host": "raks.golf", "x-forwarded-proto": "https" }))).toBe("https://raks.golf");
    expect(publicOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});
