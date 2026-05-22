<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { makeBrowserClient } from "$lib/rpc";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const fileUrl = $derived(
    `/api/v1/files/${data.bookId}/stream${data.accessToken ? `?token=${encodeURIComponent(data.accessToken)}` : ""}`,
  );

  const rpc = $derived(makeBrowserClient(data.accessToken));

  let viewerEl: HTMLDivElement;
  let book: any = null;
  let rendition: any = null;
  let toc: Array<{ label: string; href: string }> = $state([]);
  let location = $state<string | null>(null);
  let percentage = $state(0);
  let title = $state<string>("EPUB");
  let error = $state<string | null>(null);
  let bookmarks = $state<Array<{ id: string; location: string; label: string | null }>>([]);
  let notes = $state<Array<{ id: string; cfi: string | null; selectedText: string | null; noteContent: string | null }>>([]);
  let panel = $state<"toc" | "notes" | "bookmarks">("toc");

  async function refreshBookmarks() {
    try {
      const r = await rpc.api.v1.books[":id"].bookmarks.$get({ param: { id: data.bookId } });
      if (r.ok) bookmarks = await r.json();
    } catch { /* best-effort */ }
  }
  async function refreshNotes() {
    try {
      const r = await rpc.api.v1.books[":id"].notes.$get({ param: { id: data.bookId } });
      if (r.ok) notes = await r.json();
    } catch { /* best-effort */ }
  }
  async function addBookmark() {
    if (!location) return;
    const label = prompt("Bookmark label (optional)");
    try {
      const r = await rpc.api.v1.books[":id"].bookmarks.$post({
        param: { id: data.bookId },
        json: { location, label },
      });
      if (r.ok) await refreshBookmarks();
    } catch { /* best-effort */ }
  }
  async function deleteBookmark(id: string, label: string) {
    if (!confirm(`Delete bookmark${label ? ` "${label}"` : ""}?`)) return;
    try {
      const r = await rpc.api.v1.bookmarks[":bookmarkId"].$delete({
        param: { bookmarkId: id },
      });
      if (r.ok) await refreshBookmarks();
    } catch { /* best-effort */ }
  }
  async function addNote() {
    if (!location) return;
    const noteContent = prompt("Note");
    if (!noteContent) return;
    try {
      const r = await rpc.api.v1.books[":id"].notes.$post({
        param: { id: data.bookId },
        json: { cfi: location, noteContent },
      });
      if (r.ok) await refreshNotes();
    } catch { /* best-effort */ }
  }
  async function deleteNote(id: string, preview: string) {
    const snippet = preview.length > 40 ? preview.slice(0, 40) + "…" : preview;
    if (!confirm(`Delete note${snippet ? ` "${snippet}"` : ""}?`)) return;
    try {
      const r = await rpc.api.v1.notes[":noteId"].$delete({ param: { noteId: id } });
      if (r.ok) await refreshNotes();
    } catch { /* best-effort */ }
  }

  async function persistProgress(cfi: string, pct: number) {
    try {
      await rpc.api.v1.books[":id"].progress.$put({
        param: { id: data.bookId },
        json: { epubProgress: cfi, finished: pct >= 0.99 },
      });
    } catch {
      // best-effort
    }
  }

  onMount(async () => {
    try {
      // Dynamic import keeps the heavy epubjs bundle out of the SSR pass.
      const ePubMod = await import("epubjs");
      const ePub = ePubMod.default ?? (ePubMod as any).ePub;
      book = ePub(fileUrl);
      rendition = book.renderTo(viewerEl, {
        width: "100%",
        height: "100%",
        flow: "paginated",
        manager: "default",
      });

      // Try restoring last position from API.
      try {
        const progRes = await fetch(`/api/v1/books/${data.bookId}/progress`);
        if (progRes.ok) {
          const prog = (await progRes.json()) as { epubProgress?: string | null } | null;
          if (prog?.epubProgress) {
            await rendition.display(prog.epubProgress);
          } else {
            await rendition.display();
          }
        } else {
          await rendition.display();
        }
      } catch {
        await rendition.display();
      }

      const navigation = await book.loaded.navigation;
      toc = navigation.toc.map((t: any) => ({ label: t.label.trim(), href: t.href }));
      const metadata = await book.loaded.metadata;
      title = metadata.title || "EPUB";

      // Generate locations for percentage; this can take a few seconds.
      await book.locations.generate(1024);

      rendition.on("relocated", (loc: any) => {
        const cfi = loc.start.cfi;
        location = cfi;
        percentage = book.locations.percentageFromCfi(cfi);
        void persistProgress(cfi, percentage);
      });

      void refreshBookmarks();
      void refreshNotes();

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight") rendition?.next();
        if (e.key === "ArrowLeft") rendition?.prev();
      };
      window.addEventListener("keyup", onKey);
      onDestroy(() => window.removeEventListener("keyup", onKey));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });

  onDestroy(() => {
    try {
      rendition?.destroy?.();
      book?.destroy?.();
    } catch {
      // ignore
    }
  });

  function goto(href: string) {
    rendition?.display(href);
  }
</script>

<svelte:head>
  <title>{title} · tsundoku</title>
</svelte:head>

<section class="grid grid-cols-[16rem_1fr] gap-3 h-[calc(100vh-9rem)]">
  <aside class="overflow-y-auto rounded-md border border-border bg-card p-3 space-y-3 text-sm">
    <h2 class="font-medium truncate" title={title}>{title}</h2>
    <nav class="flex gap-1 border-b border-border pb-1">
      {#each ["toc","notes","bookmarks"] as p (p)}
        <button
          type="button"
          onclick={() => (panel = p as typeof panel)}
          class={`text-xs px-2 py-0.5 rounded ${panel === p ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {p}
        </button>
      {/each}
    </nav>

    {#if panel === "toc"}
      {#if toc.length}
        <ul class="space-y-0.5">
          {#each toc as t (t.href)}
            <li>
              <button
                type="button"
                onclick={() => goto(t.href)}
                class="text-left w-full truncate hover:text-foreground text-muted-foreground"
              >
                {t.label}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-xs text-muted-foreground">Loading table of contents…</p>
      {/if}
    {:else if panel === "notes"}
      <button
        type="button"
        onclick={addNote}
        class="text-xs text-primary hover:underline"
      >
        + Note at current position
      </button>
      {#if notes.length === 0}
        <p class="text-xs text-muted-foreground">No notes yet.</p>
      {:else}
        <ul class="space-y-2">
          {#each notes as n (n.id)}
            <li class="space-y-0.5">
              <button
                type="button"
                onclick={() => n.cfi && goto(n.cfi)}
                class="text-left w-full text-xs text-foreground hover:underline"
              >
                {n.noteContent || "(empty)"}
              </button>
              <button
                type="button"
                onclick={() => deleteNote(n.id, n.noteContent ?? "")}
                class="text-[10px] text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <button
        type="button"
        onclick={addBookmark}
        class="text-xs text-primary hover:underline"
      >
        + Bookmark current position
      </button>
      {#if bookmarks.length === 0}
        <p class="text-xs text-muted-foreground">No bookmarks yet.</p>
      {:else}
        <ul class="space-y-2">
          {#each bookmarks as b (b.id)}
            <li class="space-y-0.5">
              <button
                type="button"
                onclick={() => goto(b.location)}
                class="text-left w-full text-xs text-foreground hover:underline"
              >
                {b.label || "Bookmark"}
              </button>
              <button
                type="button"
                onclick={() => deleteBookmark(b.id, b.label ?? "")}
                class="text-[10px] text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </aside>

  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 text-sm">
      <button
        type="button"
        onclick={() => rendition?.prev()}
        class="rounded-md border border-input px-3 py-1 hover:bg-muted"
      >
        ← Prev
      </button>
      <button
        type="button"
        onclick={() => rendition?.next()}
        class="rounded-md border border-input px-3 py-1 hover:bg-muted"
      >
        Next →
      </button>
      <span class="ml-auto text-xs text-muted-foreground tabular-nums">
        {Math.round(percentage * 100)}%
      </span>
    </div>

    <div
      bind:this={viewerEl}
      class="flex-1 rounded-md border border-border bg-background overflow-hidden"
    ></div>

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}
  </div>
</section>
