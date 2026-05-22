import { HTTPException } from "hono/http-exception";
import { type } from "arktype";

// arktype validator — ships UUID parsing in core (`string.uuid`), so the
// regex lives in a tested library instead of here.
const uuidType = type("string.uuid");

export function isUuid(s: unknown): s is string {
  return !(uuidType(s) instanceof type.errors);
}

/**
 * Validates a path-param UUID, throwing HTTPException(400) when it's missing
 * or malformed. Use in route handlers in place of the old `Number(...)` +
 * `Number.isInteger(...)` integer-ID dance.
 */
export function requireUuid(value: string | undefined, paramName = "id"): string {
  const result = uuidType(value);
  if (result instanceof type.errors) {
    throw new HTTPException(400, { message: `Bad ${paramName}` });
  }
  return result;
}
