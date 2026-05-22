<script lang="ts">
  /**
   * Server-side directory picker. Walks the api process's filesystem via the
   * /_internal/fs/list proxy and returns the chosen absolute path through
   * the `onSelect` callback.
   *
   * Browsers can't expose the server's disk (the native file picker only
   * sees the client machine), so self-hosted apps that ingest from a path
   * have to ship their own. Sonarr/Radarr/Plex all do this the same way.
   *
   * Usage:
   *   <DirectoryPicker open={pickerOpen} onSelect={(p) => …} onClose={() => …} />
   */

  import {
    breadcrumbs,
    buildDirectoryListUrl,
    childPath,
    type DirectoryEntry,
    type DirectoryListResponse,
  } from "$lib/directory-picker";

  type Props = {
    open: boolean;
    initialPath?: string;
    onSelect: (path: string) => void;
    onClose: () => void;
  };

  let { open = false, initialPath, onSelect, onClose }: Props = $props();

  // Track open transitions so we can re-seed `current` from a fresh `initialPath`
  // each time the picker is reopened — props change on the same component
  // instance, so $state(initialPath) alone would freeze on the first value.
  let current = $state<string>("/");
  let wasOpen = $state(false);

  let entries = $state<DirectoryEntry[]>([]);
  let writable = $state<boolean>(false);
  let parent = $state<string | null>(null);
  let showHidden = $state(false);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  async function load(p: string) {
    loading = true;
    errorMsg = null;
    try {
      const url = buildDirectoryListUrl({
        origin: location.origin,
        path: p,
        showHidden,
      });
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        errorMsg = `Failed to list (${res.status})`;
        entries = [];
        writable = false;
        return;
      }
      const data = (await res.json()) as DirectoryListResponse;
      current = data.path;
      parent = data.parent;
      writable = data.writable;
      entries = data.entries;
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Network error";
    } finally {
      loading = false;
    }
  }

  function openDirectory(path: string | null) {
    if (path) void load(path);
  }

  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
  }

  function selectCurrent() {
    onSelect(current);
    onClose();
  }

  // Reseed + load when the picker transitions closed → open.
  $effect(() => {
    if (open && !wasOpen) {
      current = initialPath || "/";
      void load(current);
    }
    wasOpen = open;
  });

  // Reload when showHidden flips.
  $effect(() => {
    if (open) void load(current);
    // intentionally not in the dependency-explicit form — we want this to
    // re-run on showHidden changes too. The `if (open)` guard prevents a
    // wasted fetch while closed.
    void showHidden;
  });

</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dp-title"
    tabindex="-1"
    onclick={closeOnBackdrop}
    onkeydown={closeOnEscape}
  >
    <div class="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="dp-title" class="text-sm font-medium">Choose folder</h2>
        <button
          type="button"
          onclick={onClose}
          class="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      <div class="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <nav class="flex flex-wrap items-center gap-x-1">
          {#each breadcrumbs(current) as crumb, i (crumb.path)}
            {#if i > 0}<span class="text-border">/</span>{/if}
            <button
              type="button"
              onclick={() => openDirectory(crumb.path)}
              class="hover:text-foreground"
            >
              {crumb.name}
            </button>
          {/each}
        </nav>
      </div>

      <ul class="max-h-96 divide-y divide-border overflow-y-auto">
        {#if parent}
          <li>
            <button
              type="button"
              onclick={() => openDirectory(parent)}
              class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
            >
              <span class="text-muted-foreground">↩</span>
              <span class="text-muted-foreground">..</span>
            </button>
          </li>
        {/if}
        {#if loading}
          <li class="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</li>
        {:else if errorMsg}
          <li class="px-4 py-6 text-center text-sm text-destructive">{errorMsg}</li>
        {:else if entries.length === 0}
          <li class="px-4 py-6 text-center text-sm text-muted-foreground">
            No subfolders here.
          </li>
        {:else}
          {#each entries as e (e.name)}
            <li>
              <button
                type="button"
                onclick={() => openDirectory(childPath(current, e.name))}
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <span class="text-muted-foreground">📁</span>
                <span class="flex-1 truncate">{e.name}</span>
                {#if e.isMount}
                  <span class="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    mount
                  </span>
                {/if}
              </button>
            </li>
          {/each}
        {/if}
      </ul>

      <footer class="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" bind:checked={showHidden} />
          Show hidden
        </label>
        <div class="flex items-center gap-2">
          {#if !writable}
            <span class="text-xs text-amber-600 dark:text-amber-400">
              Not writable
            </span>
          {/if}
          <code class="hidden truncate text-xs text-muted-foreground sm:inline">{current}</code>
          <button
            type="button"
            onclick={onClose}
            class="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onclick={selectCurrent}
            class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Use this folder
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}
