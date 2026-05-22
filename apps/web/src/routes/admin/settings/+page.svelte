<script lang="ts">
  import type { PageData } from "./$types";
  import { settingsGroups } from "$lib/components/admin-settings/sections";
  import { cn } from "$lib/utils";

  let { data }: { data: PageData } = $props();

  const sourceLabel = $derived(
    data.oidcStatus?.source === "settings"
      ? "configured here"
      : data.oidcStatus?.source === "env"
        ? "bootstrap"
        : "not configured",
  );
</script>

<svelte:head>
  <title>Settings · Admin · tsundoku</title>
</svelte:head>

<header class="mb-8 flex flex-col gap-1">
  <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
    Section · Index
  </span>
  <h1 class="font-display text-3xl tracking-tight">Settings</h1>
</header>

<!-- Sub-lg: full grouped section list (the rail isn't rendered at this breakpoint). -->
<nav aria-label="Settings sections" class="space-y-8 lg:hidden">
  {#each settingsGroups as group (group.label)}
    <section>
      <h2 class="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {group.label}
      </h2>
      <ul class="divide-y divide-border border-y border-border">
        {#each group.sections as section (section.href)}
          <li>
            <a
              href={section.href}
              class={cn(
                "flex items-center gap-3 px-1 py-3 text-sm",
                "transition-colors hover:bg-accent/40",
              )}
            >
              <span class="flex-1">{section.label}</span>
              {#if section.comingSoon}
                <span
                  class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  soon
                </span>
              {/if}
              <span aria-hidden="true" class="text-muted-foreground">›</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</nav>

<!-- lg+: operator-status view (the rail handles navigation in the layout). -->
<section class="hidden space-y-10 lg:block">
  <!-- Build line -->
  <div class="font-mono text-xs text-muted-foreground">
    tsundoku{#if data.health?.version}
      <span class="text-muted-foreground/60"> · </span>v{data.health.version}{/if}
  </div>

  <!-- Authentication -->
  <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border pb-3">
    <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      Authentication
    </span>
    <span class="text-sm">
      {#if data.oidcStatus?.enabled}
        Local <span class="text-muted-foreground">+</span> OIDC
        <span class="font-mono text-xs text-muted-foreground">({sourceLabel})</span>
        {#if data.oidcStatus.issuer}
          <span class="text-muted-foreground">·</span>
          <span class="font-mono text-xs">{data.oidcStatus.issuer}</span>
        {/if}
      {:else}
        Local only
      {/if}
    </span>
    <a
      href="/admin/settings/authentication"
      class="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
    >
      Configure →
    </a>
  </div>

  <!-- Operator surfaces -->
  <div class="space-y-5">
    <article class="flex items-baseline justify-between gap-6 border-b border-border pb-3">
      <div class="min-w-0">
        <h2 class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Users
        </h2>
        <p class="mt-1 text-sm">
          <span class="font-mono tabular-nums">{data.counts.users}</span>
          {data.counts.users === 1 ? "reader" : "readers"}<span class="text-muted-foreground"
            >,</span
          >
          <span class="font-mono tabular-nums">{data.counts.admins}</span>
          {data.counts.admins === 1 ? "administrator" : "administrators"}.
        </p>
      </div>
      <a
        href="/admin/settings/users"
        class="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        Manage →
      </a>
    </article>

    <article class="flex items-baseline justify-between gap-6 border-b border-border pb-3">
      <div class="min-w-0">
        <h2 class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Libraries
        </h2>
        <p class="mt-1 text-sm">
          <span class="font-mono tabular-nums">{data.counts.libraries}</span>
          watched {data.counts.libraries === 1 ? "root" : "roots"}{#if data.counts.books !== null}<span
              class="text-muted-foreground"
              >,</span
            >
            <span class="font-mono tabular-nums">{data.counts.books.toLocaleString()}</span> books
            indexed{/if}.
        </p>
      </div>
      <a
        href="/libraries"
        class="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        Browse →
      </a>
    </article>
  </div>

  <!-- Recent activity -->
  <section class="space-y-3">
    <header class="flex items-baseline justify-between">
      <h2 class="font-display text-xl tracking-tight">Recent activity</h2>
      <a
        href="/admin/settings/audit-log"
        class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        See all →
      </a>
    </header>

    {#if data.recentAudit.length === 0}
      <p class="text-sm text-muted-foreground">
        No audit activity yet. The log fills as users sign in, libraries scan, and admins make
        changes.
      </p>
    {:else}
      <ul class="divide-y divide-border text-sm">
        {#each data.recentAudit as e (e.id)}
          <li class="grid gap-1 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
            <time
              class="font-mono text-xs tabular-nums text-muted-foreground"
              datetime={e.createdAt}
            >
              {new Date(e.createdAt).toLocaleString()}
            </time>
            <div class="min-w-0">
              <span class="font-mono text-xs">{e.action}</span>
              {#if e.username}<span class="text-muted-foreground"> · {e.username}</span>{/if}
              {#if e.entityType}<span class="text-muted-foreground"> · {e.entityType}</span>{/if}
              {#if e.detail}
                <div class="mt-0.5 text-xs text-muted-foreground">{e.detail}</div>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</section>
