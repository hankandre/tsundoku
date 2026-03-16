import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("auth endpoints", () => {
  describe("POST /api/v1/auth/login", () => {
    it("returns 400 when username is missing", async () => {
      const response = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "password123" }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when password is missing", async () => {
      const response = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin" }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when username and password are empty", async () => {
      const response = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "", password: "" }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when payload is empty object", async () => {
      const response = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("returns 400 when refresh token is missing", async () => {
      const response = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when refresh token is empty string", async () => {
      const response = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "" }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/register", () => {
    it("returns 403 when no admin token", async () => {
      const response = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "newuser",
          password: "password123",
          name: "New User",
          email: "new@example.com",
        }),
      });

      expect(response.status).toBe(403);
    });
  });
});

describe("setup endpoints", () => {
  describe("GET /api/v1/setup/status", () => {
    it("returns setup status", async () => {
      const response = await app.request("/api/v1/setup/status");
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        status: number;
        data: boolean;
      };
      expect(body.status).toBe(200);
      expect(typeof body.data).toBe("boolean");
    });
  });

  describe("POST /api/v1/setup", () => {
    it("returns 403 when user already exists (validation skipped)", async () => {
      const response = await app.request("/api/v1/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "password123",
          name: "Test User",
          email: "test@example.com",
        }),
      });

      expect(response.status).toBe(403);
    });
  });
});
