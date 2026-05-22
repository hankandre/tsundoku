<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Audit log · Admin · tsundoku</title>
</svelte:head>

<section class="space-y-8">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div class="space-y-1">
      <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Section · Ledger
      </span>
      <h2 class="font-display text-2xl tracking-tight">Audit log</h2>
      <p class="text-sm text-muted-foreground">
        Showing the {data.limit} most recent entries. Authentication, library scans, and admin actions land here.
      </p>
    </div>
    <form method="GET" class="flex items-end gap-2">
      <div class="space-y-1.5">
        <Label for="limit">Show</Label>
        <Input
          id="limit"
          name="limit"
          type="number"
          min="1"
          max="500"
          value={data.limit}
          class="w-24"
        />
      </div>
      <Button type="submit" variant="secondary" size="sm">Apply</Button>
    </form>
  </header>

  {#if data.entries.length === 0}
    <div class="rounded-md border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
      No audit log entries yet.
    </div>
  {:else}
    <div class="overflow-hidden rounded-lg border border-border bg-card">
      <table class="w-full text-sm">
        <thead class="border-b border-border bg-muted/30 text-left">
          <tr>
            <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">When</th>
            <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Action</th>
            <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">User</th>
            <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Entity</th>
            <th class="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Detail</th>
          </tr>
        </thead>
        <tbody>
          {#each data.entries as e (e.id)}
            <tr class="border-t border-border align-top">
              <td class="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td class="px-4 py-2 font-medium">{e.action}</td>
              <td class="px-4 py-2">{e.username ?? "—"}</td>
              <td class="px-4 py-2 text-xs">
                {#if e.entityType}
                  <span class="font-mono">{e.entityType}</span>
                  {#if e.entityId}
                    <span class="text-muted-foreground"> #{e.entityId}</span>
                  {/if}
                {:else}
                  —
                {/if}
              </td>
              <td class="px-4 py-2 text-xs text-muted-foreground">{e.detail ?? ""}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
