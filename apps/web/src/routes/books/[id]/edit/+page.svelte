<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  let {
    data,
    form,
  }: { data: PageData; form: ActionData } = $props();

  const b = $derived(data.book);
  let saving = $state(false);
  // metadata is a free-form record because the API doesn't yet expose typed
  // lock columns. Cast to a permissive shape for editor reads.
  const m = $derived((b.metadata ?? {}) as Record<string, unknown>);
</script>

<svelte:head>
  <title>Edit · {b.title ?? b.fileName} · tsundoku</title>
</svelte:head>

<section class="space-y-6 max-w-2xl">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold tracking-tight">Edit metadata</h1>
    <p class="text-sm text-muted-foreground">{b.fileName}</p>
  </header>

  <form
    method="POST"
    use:enhance={() => {
      saving = true;
      return ({ update }) => update().finally(() => { saving = false; });
    }}
    class="space-y-4"
  >
    <div class="grid sm:grid-cols-2 gap-4">
      <div class="space-y-1.5 sm:col-span-2">
        <label for="title" class="text-sm font-medium">Title</label>
        <input id="title" name="title" type="text" value={b.title ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5 sm:col-span-2">
        <label for="subtitle" class="text-sm font-medium">Subtitle</label>
        <input id="subtitle" name="subtitle" type="text" value={(m["subtitle"] as string | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5 sm:col-span-2">
        <label for="authors" class="text-sm font-medium">Authors <span class="text-muted-foreground">(comma-separated)</span></label>
        <input id="authors" name="authors" type="text" value={b.authors.join(", ")} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5 sm:col-span-2">
        <label for="categories" class="text-sm font-medium">Categories <span class="text-muted-foreground">(comma-separated)</span></label>
        <input id="categories" name="categories" type="text" value="" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5 sm:col-span-2">
        <label for="description" class="text-sm font-medium">Description</label>
        <textarea id="description" name="description" rows="5" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{(m["description"] as string | null) ?? ""}</textarea>
      </div>
      <div class="space-y-1.5">
        <label for="publisher" class="text-sm font-medium">Publisher</label>
        <input id="publisher" name="publisher" type="text" value={(m["publisher"] as string | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="publishedDate" class="text-sm font-medium">Published date</label>
        <input id="publishedDate" name="publishedDate" type="text" value={(m["publishedDate"] as string | null) ?? ""} placeholder="YYYY-MM-DD" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="isbn10" class="text-sm font-medium">ISBN-10</label>
        <input id="isbn10" name="isbn10" type="text" value={(m["isbn10"] as string | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="isbn13" class="text-sm font-medium">ISBN-13</label>
        <input id="isbn13" name="isbn13" type="text" value={(m["isbn13"] as string | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="asin" class="text-sm font-medium">ASIN</label>
        <input id="asin" name="asin" type="text" value={(m["asin"] as string | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="language" class="text-sm font-medium">Language</label>
        <input id="language" name="language" type="text" value={(m["language"] as string | null) ?? ""} placeholder="en, fr, ja…" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="pageCount" class="text-sm font-medium">Pages</label>
        <input id="pageCount" name="pageCount" type="number" min="0" value={b.pageCount ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="rating" class="text-sm font-medium">Rating</label>
        <input id="rating" name="rating" type="number" min="0" max="5" step="0.1" value={b.rating ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="ageRating" class="text-sm font-medium">Age rating</label>
        <input id="ageRating" name="ageRating" type="text" value={(m["ageRating"] as string | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="seriesName" class="text-sm font-medium">Series</label>
        <input id="seriesName" name="seriesName" type="text" value={(m["seriesName"] as string | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div class="space-y-1.5">
        <label for="seriesNumber" class="text-sm font-medium">Series number</label>
        <input id="seriesNumber" name="seriesNumber" type="number" step="0.5" min="0" value={(m["seriesNumber"] as number | null) ?? ""} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
    </div>

    <fieldset class="rounded-md border border-border bg-card p-3 space-y-1.5">
      <legend class="text-xs text-muted-foreground px-1">Lock from automatic updates</legend>
      <label class="flex gap-2 items-center text-sm">
        <input type="checkbox" name="titleLocked" checked={Boolean(m["titleLocked"])} />
        Title
      </label>
      <label class="flex gap-2 items-center text-sm">
        <input type="checkbox" name="descriptionLocked" checked={Boolean(m["descriptionLocked"])} />
        Description
      </label>
      <label class="flex gap-2 items-center text-sm">
        <input type="checkbox" name="authorsLocked" checked={Boolean(m["authorsLocked"])} />
        Authors
      </label>
    </fieldset>

    {#if form?.error}
      <p class="text-sm text-destructive">{form.error}</p>
    {/if}

    <div class="flex gap-2">
      <button
        type="submit"
        disabled={saving}
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <a href={`/books/${b.id}`} class="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted">Cancel</a>
    </div>
  </form>
</section>
