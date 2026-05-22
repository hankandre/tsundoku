<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-6">
  <header class="flex items-baseline justify-between">
    <h1 class="text-2xl font-semibold tracking-tight">Shelf #{data.shelfId}</h1>
    <span class="text-sm text-muted-foreground">{data.books.totalElements} books</span>
  </header>

  {#if data.books.content.length === 0}
    <p class="text-muted-foreground">No books on this shelf yet.</p>
  {:else}
    <ul class="divide-y divide-border rounded-lg border border-border bg-card">
      {#each data.books.content as b (b.id)}
        <li>
          <a href={`/books/${b.id}`} class="flex items-baseline gap-3 px-4 py-2 hover:bg-muted">
            <span class="font-medium truncate">{b.title ?? b.fileName}</span>
            {#if b.authors.length}
              <span class="text-sm text-muted-foreground truncate">{b.authors.join(", ")}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
