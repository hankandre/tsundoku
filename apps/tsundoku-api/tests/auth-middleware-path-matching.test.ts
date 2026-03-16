import { describe, expect, it } from "bun:test";

const toRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const doubleStar = escaped.replaceAll("**", "::DOUBLE_STAR::");
  const singleStar = doubleStar.replaceAll("*", "[^/]+");
  const normalized = singleStar.replaceAll("::DOUBLE_STAR::", ".*");
  return new RegExp(`^${normalized}$`);
};

const isMatch = (path: string, list: RegExp[]) => list.some((regex) => regex.test(path));

const PUBLIC_PATHS = [
  "/ws/**",
  "/kobo/**",
  "/api/v1/auth/**",
  "/api/v1/public-settings",
  "/api/v1/setup",
  "/api/v1/setup/**",
  "/api/v1/healthcheck",
  "/api/v1/healthcheck/**",
  "/api/v1/version",
  "/api/v1/version/**",
];

const matchers = {
  public: PUBLIC_PATHS.map((pattern) => toRegex(pattern)),
};

describe("Auth middleware path matching", () => {
  describe("toRegex", () => {
    it("matches exact paths", () => {
      const regex = toRegex("/api/v1/setup");
      expect(regex.test("/api/v1/setup")).toBe(true);
    });

    it("matches wildcard single segment", () => {
      const regex = toRegex("/api/v1/auth/*");
      expect(regex.test("/api/v1/auth/login")).toBe(true);
      expect(regex.test("/api/v1/auth/register")).toBe(true);
    });

    it("matches wildcard multiple segments", () => {
      const regex = toRegex("/api/v1/auth/**");
      expect(regex.test("/api/v1/auth/login")).toBe(true);
      expect(regex.test("/api/v1/auth/register/verify")).toBe(true);
    });

    it("does not match paths with extra segments when exact is required", () => {
      const regex = toRegex("/api/v1/setup");
      expect(regex.test("/api/v1/setup/status")).toBe(false);
    });
  });

  describe("isMatch", () => {
    it("matches exact public paths", () => {
      expect(isMatch("/api/v1/setup", matchers.public)).toBe(true);
      expect(isMatch("/api/v1/healthcheck", matchers.public)).toBe(true);
      expect(isMatch("/api/v1/public-settings", matchers.public)).toBe(true);
    });

    it("matches wildcard paths", () => {
      expect(isMatch("/api/v1/auth/login", matchers.public)).toBe(true);
      expect(isMatch("/api/v1/auth/refresh", matchers.public)).toBe(true);
      expect(isMatch("/ws/socket", matchers.public)).toBe(true);
      expect(isMatch("/kobo/endpoint", matchers.public)).toBe(true);
    });

    it("matches nested paths under wildcard", () => {
      expect(isMatch("/api/v1/setup/status", matchers.public)).toBe(true);
      expect(isMatch("/api/v1/healthcheck/extra", matchers.public)).toBe(true);
    });

    it("does not match non-public paths", () => {
      expect(isMatch("/api/v1/libraries", matchers.public)).toBe(false);
      expect(isMatch("/api/v1/books", matchers.public)).toBe(false);
      expect(isMatch("/api/v1/users", matchers.public)).toBe(false);
    });
  });

  describe("edge cases from codebase", () => {
    it("/api/v1/setup matches as exact path", () => {
      const regex = toRegex("/api/v1/setup");
      expect(regex.test("/api/v1/setup")).toBe(true);
      expect(regex.test("/api/v1/setup/")).toBe(false);
    });

    it("/api/v1/setup/** matches nested paths", () => {
      const regex = toRegex("/api/v1/setup/**");
      expect(regex.test("/api/v1/setup/status")).toBe(true);
      expect(regex.test("/api/v1/setup/complete")).toBe(true);
    });
  });
});
