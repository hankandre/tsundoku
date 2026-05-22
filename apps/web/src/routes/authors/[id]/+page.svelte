<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
  const a = $derived(data.author);
</script>

<svelte:head>
  <title>{a.name} · tsundoku</title>
</svelte:head>

<section class="space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold tracking-tight">{a.name}</h1>
    <p class="text-sm text-muted-foreground">{a.books.length} books</p>
  </header>

  {#if a.bio}
    <p class="text-sm">{a.bio}</p>
  {/if}

  {#if a.books.length === 0}
    <p class="text-sm text-muted-foreground">No books for this author in your accessible libraries.</p>
  {:else}
    <ul class="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each a.books as b (b.id)}
        <li>
          <a
            href={`/books/${b.id}`}
            class="block rounded-md border border-border bg-card overflow-hidden hover:border-ring"
          >
            <img
              src={`/covers/${b.id}`}
              alt=""
              loading="lazy"
              class="aspect-2/3 w-full bg-muted object-cover"
              onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
            />
            <div class="p-2">
              <div class="text-sm font-medium truncate">{b.title ?? b.fileName}</div>
              <div class="text-xs text-muted-foreground">{b.bookType}</div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
