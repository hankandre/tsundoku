<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Headphones from "@lucide/svelte/icons/headphones";
  import FileText from "@lucide/svelte/icons/file-text";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Download from "@lucide/svelte/icons/download";
  import type { PageData } from "./$types";
  import { Button } from "$lib/components/ui/button";
  import BookCover from "$lib/components/library/book-cover.svelte";
  import FormatLabel from "$lib/components/ui/format-label.svelte";
  import BookShelves from "$lib/components/library/book-shelves.svelte";

  let { data }: { data: PageData } = $props();
  const b = $derived(data.book);
  let shelves = $state(data.shelves);
  let currentShelfIds = $state(data.shelfIds);

  // Re-sync if the route changes to a different book (SvelteKit reuses the
  // component when navigating between sibling [id]s).
  $effect(() => {
    shelves = data.shelves;
    currentShelfIds = data.shelfIds;
  });

  type ReaderInfo = {
    href: string;
    label: string;
    icon: typeof BookOpen;
  };

  const reader = $derived.by<ReaderInfo | null>(() => {
    switch (b.bookType) {
      case "PDF":
        return { href: `/pdf-reader/${b.id}`, label: "Open PDF", icon: FileText };
      case "EPUB":
      case "MOBI":
      case "AZW3":
      case "FB2":
        return { href: `/ebook-reader/${b.id}`, label: "Read", icon: BookOpen };
      case "CBX":
        return { href: `/cbx-reader/${b.id}`, label: "Open comic", icon: BookOpen };
      case "AUDIOBOOK":
        return { href: `/audiobook/${b.id}`, label: "Listen", icon: Headphones };
      default:
        return null;
    }
  });
</script>

<article class="space-y-10">
  <nav class="flex items-center gap-2 text-xs text-muted-foreground">
    <a href="/books" class="hover:text-foreground">All books</a>
    <span aria-hidden="true">/</span>
    <span class="font-mono uppercase tracking-wide">{b.bookType}</span>
  </nav>

  <!-- Spine hero: cover left, typography right -->
  <header class="grid gap-8 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-10 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
    <div>
      <BookCover bookId={b.id} title={b.title ?? b.fileName} format={b.bookType} eager />
    </div>

    <div class="space-y-6">
      <div class="space-y-3">
        <FormatLabel format={b.bookType} />
        <h1 class="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          {b.title ?? b.fileName}
        </h1>
        {#if b.authors.length}
          <p class="text-base text-muted-foreground">
            by <span class="text-foreground">{b.authors.join(", ")}</span>
          </p>
        {/if}
      </div>

      <div class="flex flex-wrap gap-3">
        {#if reader}
          {@const Icon = reader.icon}
          <Button href={reader.href} size="lg">
            <Icon size={14} />
            {reader.label}
          </Button>
        {/if}
        <Button href={`/books/${b.id}/edit`} variant="outline">
          <Pencil size={14} />
          Edit metadata
        </Button>
        <Button href={`/api/v1/books/${b.id}/download`} variant="ghost">
          <Download size={14} />
          Download
        </Button>
      </div>

      <div class="border-t border-border pt-6">
        <BookShelves bookId={b.id} bind:shelves bind:current={currentShelfIds} />
      </div>

      <dl
        class="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border pt-6 text-sm sm:grid-cols-2"
      >
        {#snippet row(label: string, value: string, mono = false)}
          <div class="flex flex-col gap-0.5">
            <dt class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </dt>
            <dd class={mono ? "font-mono text-xs break-all" : ""}>{value}</dd>
          </div>
        {/snippet}

        {@render row("Format", b.bookType)}
        {#if b.pageCount}{@render row("Pages", String(b.pageCount))}{/if}
        {#if b.rating}{@render row("Rating", b.rating.toFixed(1))}{/if}
        {@render row("Added", new Date(b.addedOn).toLocaleDateString())}
        {@render row("File", b.fileName, true)}
      </dl>
    </div>
  </header>
</article>
