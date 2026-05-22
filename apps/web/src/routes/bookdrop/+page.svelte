<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  let {
    data,
    form,
  }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Bookdrop · tsundoku</title>
</svelte:head>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Bookdrop</h1>
    <p class="text-sm text-muted-foreground">
      Files dropped into the watched folder appear here. Pick a library to finalize, or delete to remove.
    </p>
  </header>

  {#if data.files.length === 0}
    <p class="text-sm text-muted-foreground">No files staged. Drop files into the BOOKDROP_PATH directory to see them here.</p>
  {:else}
    <ul class="divide-y divide-border rounded-lg border border-border bg-card">
      {#each data.files as f (f.id)}
        <li class="px-4 py-3 flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0 space-y-1">
            <div class="font-medium truncate">{f.fileName}</div>
            <div class="text-xs text-muted-foreground">
              {f.detectedType ?? "Unknown"} · {(f.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <form method="POST" action="?/finalize" use:enhance class="flex items-center gap-2 text-sm">
            <input type="hidden" name="id" value={f.id} />
            <select
              name="libraryId"
              required
              class="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="">— Library —</option>
              {#each data.libraries as lib (lib.id)}
                <option value={lib.id}>{lib.name}</option>
              {/each}
            </select>
            <button type="submit" class="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90">
              Finalize
            </button>
          </form>
          <form method="POST" action="?/delete" use:enhance
            onsubmit={(e) => { if (!confirm(`Delete "${f.fileName}" from bookdrop?`)) e.preventDefault(); }}
          >
            <input type="hidden" name="id" value={f.id} />
            <button type="submit" class="text-xs text-muted-foreground hover:text-destructive">
              Delete
            </button>
          </form>
        </li>
      {/each}
    </ul>
  {/if}

  {#if form && "error" in form && form.error}
    <p class="text-sm text-destructive">{form.error}</p>
  {/if}
</section>
