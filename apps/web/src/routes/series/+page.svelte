<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Series · tsundoku</title>
</svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Series</h1>
    <p class="text-sm text-muted-foreground">{data.series.length} series.</p>
  </header>

  {#if data.series.length === 0}
    <p class="text-sm text-muted-foreground">No series found. Edit a book's metadata to add it to a series.</p>
  {:else}
    <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.series as s (s.name)}
        <li>
          <a
            href={`/series/${encodeURIComponent(s.name)}`}
            class="block rounded-md border border-border bg-card px-3 py-2 hover:border-ring"
          >
            <div class="font-medium truncate">{s.name}</div>
            <div class="text-xs text-muted-foreground">
              {s.bookCount} book{s.bookCount === 1 ? "" : "s"}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
