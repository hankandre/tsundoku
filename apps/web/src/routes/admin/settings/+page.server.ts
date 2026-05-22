import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

type Health = { status: string; version?: string; timestamp?: string };

export const load: PageServerLoad = async ({ locals }) => {
  const { rpc } = locals;
  // The /admin layout.server.ts gates this on isAdmin.
  const [usersRes, librariesRes, recentAuditRes, oidcStatusRes, healthRes, libStatsRes] =
    await Promise.all([
      rpc.api.v1.users.$get(),
      rpc.api.v1.libraries.$get(),
      rpc.api.v1["audit-log"].$get({ query: { limit: "8" } }),
      rpc.api.v1.auth.oidc.status.$get(),
      rpc.api.v1.health.$get(),
      rpc.api.v1.stats.libraries.$get(),
    ]);
  if (!usersRes.ok) throw error(usersRes.status, "Failed to load users");
  if (!librariesRes.ok) throw error(librariesRes.status, "Failed to load libraries");
  const users = await usersRes.json();
  const libraries = await librariesRes.json();
  const recentAudit = recentAuditRes.ok ? await recentAuditRes.json() : [];
  const oidcStatus = oidcStatusRes.ok
    ? ((await oidcStatusRes.json()) as {
        enabled: boolean;
        issuer: string | null;
        source: "settings" | "env" | "none";
      })
    : null;
  const health = healthRes.ok ? ((await healthRes.json()) as Health) : null;
  const libStats = libStatsRes.ok
    ? ((await libStatsRes.json()) as { totalBooks: number })
    : null;

  return {
    counts: {
      users: users.length,
      admins: users.filter((u) => u.permissions.admin).length,
      libraries: libraries.length,
      books: libStats?.totalBooks ?? null,
    },
    recentAudit,
    oidcStatus,
    health,
  };
};
