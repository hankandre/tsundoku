<script lang="ts">
  import BookCard from "./book-card.svelte";

  type Item = {
    id: string;
    title?: string | null;
    fileName: string;
    authors: string[];
    bookType: string;
    pageCount?: number | null;
    progress?: number | null;
  };
  let { items }: { items: Item[] } = $props();
</script>

{#if items.length > 0}
  <section class="space-y-4">
    <header class="flex items-baseline justify-between">
      <h2 class="font-display text-xl tracking-tight">Continue reading</h2>
      <a
        href="/books?sort=lastReadAt"
        class="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        See all →
      </a>
    </header>
    <ul class="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {#each items as item (item.id)}
        <li>
          <BookCard book={item} progress={item.progress} />
        </li>
      {/each}
    </ul>
  </section>
{/if}
