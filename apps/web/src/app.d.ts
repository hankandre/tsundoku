import type { SessionUser } from "$lib/server/auth";
import type { ServerRpc } from "$lib/server/rpc";

declare global {
  namespace App {
    interface Locals {
      user: SessionUser | null;
      rpc: ServerRpc;
    }
    interface PageData {
      user: SessionUser | null;
    }
    // interface Error {}
    // interface Platform {}
  }
}

export {};
