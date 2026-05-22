import { getDb } from "@tsundoku/db";
import { env } from "./env.ts";

export const db = env.DATABASE_URL ? getDb(env.DATABASE_URL) : null;

export function requireDb() {
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}
