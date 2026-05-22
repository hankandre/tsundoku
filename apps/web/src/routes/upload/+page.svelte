<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  let {
    data,
    form,
  }: { data: PageData; form: ActionData } = $props();

  let uploading = $state(false);
</script>

<svelte:head>
  <title>Upload · tsundoku</title>
</svelte:head>

<section class="max-w-xl space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Upload a book</h1>
    <p class="text-sm text-muted-foreground">
      The file is added to the chosen library and indexed immediately.
    </p>
  </header>

  {#if data.libraries.length === 0}
    <p class="rounded-md border border-border bg-card p-4 text-sm">
      You need a library first.
      <a href="/libraries" class="text-primary underline">Create one</a>.
    </p>
  {:else}
    <form
      method="POST"
      enctype="multipart/form-data"
      use:enhance={() => {
        uploading = true;
        return ({ update }) => update().finally(() => { uploading = false; });
      }}
      class="space-y-4"
    >
      <div class="space-y-1.5">
        <label for="libraryId" class="text-sm font-medium">Library</label>
        <select
          id="libraryId"
          name="libraryId"
          required
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {#each data.libraries as lib (lib.id)}
            <option value={lib.id}>{lib.name}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-1.5">
        <label for="file" class="text-sm font-medium">File</label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.epub,.cbz,.cbr,.mobi,.azw3,.fb2,.m4b,.mp3"
          class="block w-full text-sm file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-4 file:py-2 file:mr-3 file:cursor-pointer hover:file:opacity-90"
        />
        <p class="text-xs text-muted-foreground">PDF, EPUB, CBZ/CBR, MOBI, AZW3, FB2, M4B, MP3. Max 1 GiB.</p>
      </div>

      {#if form?.error}
        <p class="text-sm text-destructive">{form.error}</p>
      {/if}
      {#if form?.ok}
        <p class="text-sm text-foreground">
          Uploaded as <code class="text-xs">{form.fileName}</code>.
          <a href={`/books/${form.bookId}`} class="text-primary underline">Open it</a>.
        </p>
      {/if}

      <button
        type="submit"
        disabled={uploading}
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload"}
      </button>
    </form>
  {/if}
</section>
