<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
  const s = $derived(data.series);
</script>

<svelte:head>
  <title>{s.name} · tsundoku</title>
</svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">{s.name}</h1>
    <p class="text-sm text-muted-foreground">{s.books.length} books</p>
  </header>

  <ul class="divide-y divide-border rounded-lg border border-border bg-card">
    {#each s.books as b (b.id)}
      <li>
        <a href={`/books/${b.id}`} class="flex items-baseline gap-3 px-4 py-2 hover:bg-muted">
          {#if b.seriesNumber != null}
            <span class="text-xs text-muted-foreground tabular-nums w-10">#{b.seriesNumber}</span>
          {/if}
          <span class="font-medium truncate">{b.title ?? b.fileName}</span>
          <span class="ml-auto text-xs text-muted-foreground">{b.bookType}</span>
        </a>
      </li>
    {/each}
  </ul>
</section>
