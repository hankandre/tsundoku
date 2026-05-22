<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Plus from "@lucide/svelte/icons/plus";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import { formatRules, type GroupRule } from "$lib/magic-shelves/types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let creating = $state(false);
</script>

<svelte:head>
  <title>Magic shelves · tsundoku</title>
</svelte:head>

<section class="space-y-10">
  <header class="space-y-1">
    <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      Section · Magic shelves
    </p>
    <div class="flex items-baseline justify-between gap-4">
      <h1 class="font-display text-3xl tracking-tight">Magic shelves</h1>
      <span class="font-mono text-xs tabular-nums text-muted-foreground">
        {data.shelves.length} {data.shelves.length === 1 ? "shelf" : "shelves"}
      </span>
    </div>
    <p class="max-w-[60ch] text-sm text-muted-foreground">
      Saved rules that pick books from the pile for you. The rule re-runs every time
      you open a shelf, so it stays current as you add and finish things.
    </p>
  </header>

  <!-- Create form: inline, mono caption, no card-in-card. -->
  <section aria-labelledby="new-shelf-heading" class="space-y-3 border-y border-border py-5">
    <h2 id="new-shelf-heading" class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      New shelf
    </h2>
    <form
      method="POST"
      action="?/create"
      use:enhance={() => {
        creating = true;
        return async ({ update }) => {
          await update({ reset: false });
          creating = false;
        };
      }}
      class="flex items-end gap-3"
    >
      <div class="flex-1 max-w-md space-y-1">
        <label for="magic-name" class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Name
        </label>
        <input
          id="magic-name"
          name="name"
          type="text"
          required
          placeholder="e.g. Recently audiobook'd"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <button
        type="submit"
        disabled={creating}
        class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Plus size={14} />
        {creating ? "Creating…" : "Create"}
      </button>
    </form>
  </section>

  <!-- Ledger of existing shelves. One row per shelf: name, rule expression, count, delete. -->
  <section aria-labelledby="ledger-heading" class="space-y-3">
    <h2 id="ledger-heading" class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      Your shelves
    </h2>

    {#if data.shelves.length === 0}
      <p class="text-sm text-muted-foreground italic">
        Nothing in the pile yet. The first shelf appears here once you create it.
      </p>
    {:else}
      <ul class="divide-y divide-border">
        {#each data.shelves as ms (ms.id)}
          {@const expression = formatRules(ms.rules as GroupRule)}
          <li class="group/row grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-x-4 gap-y-1 py-3 px-1">
            <Sparkles size={13} class="self-center shrink-0 text-muted-foreground/70" />
            <a
              href={`/magic-shelves/${ms.id}`}
              class="text-base font-medium truncate hover:text-primary focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-2"
            >
              {ms.name}
            </a>
            <span class="font-mono text-xs tabular-nums text-muted-foreground">
              {ms.bookCount}
            </span>
            <div class="flex items-center gap-1 justify-self-end">
              <a
                href={`/magic-shelves/${ms.id}`}
                aria-label="Open"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100"
              >
                <ArrowRight size={14} />
              </a>
              <form
                method="POST"
                action="?/delete"
                use:enhance
                onsubmit={(e) => {
                  if (!confirm(`Delete magic shelf "${ms.name}"? Your books aren't affected.`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={ms.id} />
                <button
                  type="submit"
                  aria-label="Delete shelf"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive group-hover/row:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </form>
            </div>
            <!-- Rule expression spans the full row beneath the name. Mono and quiet — it's what the row IS. -->
            <code class="col-start-2 col-end-5 truncate font-mono text-xs text-muted-foreground" title={expression}>
              {expression}
            </code>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if form && "error" in form && form.error}
    <p class="text-sm text-destructive">{form.error}</p>
  {/if}
</section>
