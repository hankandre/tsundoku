<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Authors · tsundoku</title>
</svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Authors</h1>
    <p class="text-sm text-muted-foreground">{data.authors.length} authors total.</p>
  </header>

  {#if data.authors.length === 0}
    <p class="text-sm text-muted-foreground">No authors yet — run a library scan to populate.</p>
  {:else}
    <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.authors as a (a.id)}
        <li>
          <a
            href={`/authors/${a.id}`}
            class="block rounded-md border border-border bg-card px-3 py-2 hover:border-ring"
          >
            <div class="font-medium truncate">{a.name}</div>
            <div class="text-xs text-muted-foreground">
              {a.bookCount} book{a.bookCount === 1 ? "" : "s"}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
