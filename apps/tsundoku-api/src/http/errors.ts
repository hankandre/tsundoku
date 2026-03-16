import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { z } from "zod";
import type { ErrorResponse } from "../types/error-response";

export const errorBody = (
  status: number,
  message: string,
  details?: string[],
): ErrorResponse => ({
  status,
  message,
  timestamp: new Date().toISOString(),
  details,
});

export const fail = (
  status: number,
  message: string,
  details?: string[],
): never => {
  throw new HTTPException(status as any, {
    res: new Response(JSON.stringify(errorBody(status, message, details)), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    }),
  });
};

export function assertIsDefined<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === null || value === undefined) {
    fail(400, message);
  }
}

export const handleValidationError: any = (result: any, c: Context) => {
  if (result.success === false && result.error) {
    return c.json(errorBody(400, z.prettifyError(result.error)), 400);
  }
};
