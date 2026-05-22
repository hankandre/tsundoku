<script lang="ts">
  import { enhance } from "$app/forms";
  import DirectoryPicker from "$lib/components/DirectoryPicker.svelte";
  import type { ActionData, PageData } from "./$types";

  let {
    data,
    form,
  }: { data: PageData; form: ActionData } = $props();

  let creating = $state(false);
  let pathFields = $state<string[]>([""]);

  // Which row is the picker assigned to? -1 = closed.
  let pickerRow = $state<number>(-1);

  function addPathField() {
    pathFields = [...pathFields, ""];
  }
  function removePathField(i: number) {
    pathFields = pathFields.filter((_, idx) => idx !== i);
    if (pathFields.length === 0) pathFields = [""];
  }
</script>

<section class="space-y-8">
  <header class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold tracking-tight">Libraries</h1>
  </header>

  {#if data.libraries.length === 0}
    <p class="text-muted-foreground text-sm">No libraries yet — create one below.</p>
  {:else}
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.libraries as lib (lib.id)}
        <li class="rounded-lg border border-border bg-card p-4 hover:border-ring transition">
          <div class="flex items-start justify-between gap-2">
            <a href={`/libraries/${lib.id}`} class="block space-y-1 flex-1 min-w-0">
              <div class="font-medium truncate">{lib.name}</div>
              <div class="text-xs text-muted-foreground">
                {lib.paths.length} path{lib.paths.length === 1 ? "" : "s"} · {lib.organizationMode.replace(/_/g, " ").toLowerCase()}
              </div>
            </a>
            <form
              method="POST"
              action="?/delete"
              use:enhance={() => {
                return ({ update }) => update();
              }}
              onsubmit={(e) => {
                if (!confirm(`Delete library "${lib.name}"? This removes the library and all of its books from tsundoku — files on disk are not touched.`)) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={lib.id} />
              <button
                type="submit"
                class="text-xs text-muted-foreground hover:text-destructive"
                aria-label="Delete library"
              >
                Delete
              </button>
            </form>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <DirectoryPicker
    open={pickerRow >= 0}
    initialPath={pickerRow >= 0 ? (pathFields[pickerRow] || "/") : "/"}
    onSelect={(p) => {
      if (pickerRow >= 0) pathFields[pickerRow] = p;
    }}
    onClose={() => (pickerRow = -1)}
  />

  <div class="rounded-lg border border-border bg-card p-5 space-y-4">
    <h2 class="text-lg font-medium">New library</h2>
    <form
      method="POST"
      action="?/create"
      use:enhance={() => {
        creating = true;
        return ({ update }) =>
          update().finally(() => {
            creating = false;
            pathFields = [""];
          });
      }}
      class="space-y-4"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label for="name" class="text-sm font-medium">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form?.name ?? ""}
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div class="space-y-1.5">
          <label for="icon" class="text-sm font-medium">Icon <span class="text-muted-foreground">(optional)</span></label>
          <input
            id="icon"
            name="icon"
            type="text"
            placeholder="lucide icon name"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="organizationMode" class="text-sm font-medium">Organization mode</label>
        <select
          id="organizationMode"
          name="organizationMode"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="BOOK_PER_FILE">One book per file</option>
          <option value="BOOK_PER_DIRECTORY">One book per directory</option>
          <option value="AUTO_DETECT">Auto-detect</option>
        </select>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium">Paths</span>
        <p class="text-xs text-muted-foreground">
          Folders on the server where books are stored. Use "Browse" to pick.
        </p>
        {#each pathFields as _, i (i)}
          <div class="flex gap-2">
            <input
              name="paths"
              type="text"
              placeholder="/data/books"
              bind:value={pathFields[i]}
              class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onclick={() => (pickerRow = i)}
              class="rounded-md border border-input px-3 py-2 text-xs hover:bg-muted"
            >
              Browse
            </button>
            <button
              type="button"
              onclick={() => removePathField(i)}
              class="text-xs text-muted-foreground hover:text-destructive px-2"
              aria-label="Remove path"
            >
              ✕
            </button>
          </div>
        {/each}
        <button
          type="button"
          onclick={addPathField}
          class="text-xs text-muted-foreground hover:text-foreground"
        >
          + Add path
        </button>
      </div>

      {#if form?.error}
        <p class="text-sm text-destructive">{form.error}</p>
      {/if}

      <button
        type="submit"
        disabled={creating}
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {creating ? "Creating…" : "Create library"}
      </button>
    </form>
  </div>
</section>
