import { upgradeWebSocket, websocket as bunWebsocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { logger } from "../logger.ts";
import { verifyToken } from "../services/tokens.ts";
import { onTaskUpdate, type TaskRecord } from "../services/tasks.ts";

/**
 * Bun-native WebSocket replacement for Booklore's STOMP layer, wired through
 * Hono's `upgradeWebSocket` so the standard middleware stack (cors, logger,
 * authOptional) runs on the upgrade request.
 *
 * Wire format:
 *   ← server: { type: "event",  topic: string, payload: unknown }
 *   → client: { type: "auth",   token: string }
 *   → client: { type: "subscribe" | "unsubscribe", topic: string }
 *
 * Topics mirror Booklore's `model/websocket/Topic.java`.
 */

type WsState = {
  userId?: string;
  isAdmin?: boolean;
  topics: Set<string>;
};

const sockets = new Map<WSContext, WsState>();

export const TOPICS = {
  BOOK_ADD: "/queue/book-add",
  BOOK_UPDATE: "/queue/book-update",
  BOOK_COVER_UPDATE: "/queue/books-cover-update",
  BOOK_REMOVE: "/queue/books-remove",
  METADATA_UPDATE: "/queue/book-metadata-update",
  METADATA_BATCH_UPDATE: "/queue/book-metadata-batch-update",
  METADATA_BATCH_PROGRESS: "/queue/book-metadata-batch-progress",
  BOOKDROP_FILE: "/queue/bookdrop-file",
  LOG: "/queue/log",
  TASK_PROGRESS: "/queue/task-progress",
  SESSION_REVOKED: "/queue/session-revoked",
  LIBRARY_HEALTH: "/topic/library-health",
} as const;

export function publish(topic: string, payload: unknown): void {
  const msg = JSON.stringify({ type: "event", topic, payload });
  for (const [ws, state] of sockets) {
    if (!state.topics.has(topic)) continue;
    try {
      ws.send(msg);
    } catch (e) {
      logger.warn({ err: e }, "ws send failed");
    }
  }
}

onTaskUpdate((task: TaskRecord) => publish(TOPICS.TASK_PROGRESS, task));

/**
 * Hono route handler. Mount with `app.get("/ws", wsHandler)`.
 *
 * Optional auth at connect time via `?token=`; the `{ type: "auth", token }`
 * message variant is still supported for clients that can't set query params.
 */
export const wsHandler = upgradeWebSocket((c) => {
  const initialToken = c.req.query("token");
  const state: WsState = { topics: new Set() };
  return {
    async onOpen(_event, ws) {
      sockets.set(ws, state);
      if (initialToken) {
        try {
          const claims = await verifyToken(initialToken);
          state.userId = String(claims.sub ?? "");
          state.isAdmin = Boolean(claims.isAdmin);
        } catch {
          // connection still allowed; subscribe handler can require auth later
        }
      }
      logger.debug({ userId: state.userId }, "ws open");
    },
    async onMessage(event, ws) {
      let msg: { type?: string; topic?: string; token?: string };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "Malformed JSON" }));
        return;
      }
      switch (msg.type) {
        case "auth": {
          if (!msg.token) {
            ws.send(JSON.stringify({ type: "error", error: "Missing token" }));
            return;
          }
          try {
            const claims = await verifyToken(msg.token);
            state.userId = String(claims.sub ?? "");
            state.isAdmin = Boolean(claims.isAdmin);
            ws.send(JSON.stringify({ type: "auth-ok" }));
          } catch {
            ws.send(JSON.stringify({ type: "error", error: "Invalid token" }));
          }
          break;
        }
        case "subscribe": {
          if (!msg.topic) return;
          state.topics.add(msg.topic);
          ws.send(JSON.stringify({ type: "subscribed", topic: msg.topic }));
          break;
        }
        case "unsubscribe": {
          if (!msg.topic) return;
          state.topics.delete(msg.topic);
          break;
        }
        default:
          ws.send(JSON.stringify({ type: "error", error: "Unknown type" }));
      }
    },
    onClose(_event, ws) {
      sockets.delete(ws);
      logger.debug("ws close");
    },
  };
});

/** Bun.serve websocket handler — pass directly to `Bun.serve({ websocket })`. */
export const websocket = bunWebsocket;
