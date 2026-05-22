<script lang="ts">
  import type { PageData } from "./$types";
  import Bookmark from "@lucide/svelte/icons/bookmark";
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.shelf.name} · Shelves · tsundoku</title>
</svelte:head>

<section class="space-y-6">
  <header class="space-y-1">
    <div class="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <a href="/shelves" class="hover:text-foreground">Shelves</a>
      <span aria-hidden="true">·</span>
      <span class="tabular-nums">{data.books.totalElements}</span>
      <span>{data.books.totalElements === 1 ? "book" : "books"}</span>
    </div>
    <h1 class="flex items-center gap-2 font-display text-3xl tracking-tight">
      <Bookmark size={20} class="text-muted-foreground" aria-hidden="true" />
      {data.shelf.name}
    </h1>
  </header>

  {#if data.books.content.length === 0}
    <p class="border-y border-dashed border-border py-6 text-center text-xs italic text-muted-foreground">
      No books on this shelf yet.
    </p>
  {:else}
    <ul class="divide-y divide-border">
      {#each data.books.content as b (b.id)}
        <li>
          <a href={`/books/${b.id}`} class="flex items-baseline gap-3 py-2 hover:text-primary">
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
