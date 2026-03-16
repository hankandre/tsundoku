import { describe, expect, it } from "bun:test";
import { app } from "./app";

describe("healthcheck route", () => {
  it("returns pong payload", async () => {
    const response = await app.request("/api/v1/healthcheck");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: number;
      message: string;
      data: {
        status: string;
      };
    };

    expect(body.status).toBe(200);
    expect(body.message).toBe("Pong");
    expect(body.data.status).toBe("UP");
  });

  it("rejects register without admin auth", async () => {
    const response = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "test",
        password: "password123",
        name: "Test",
        email: "test@example.com",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("validates login payload", async () => {
    const response = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ username: "" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain("Username");
  });
});
